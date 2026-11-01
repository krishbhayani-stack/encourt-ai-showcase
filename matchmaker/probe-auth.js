// matchmaker/probe-auth.js  —  READ-ONLY auth prober. Run: node probe-auth.js
// Determines which login/refresh endpoint is live and whether headless login yields a
// manager-scoped token (matches with player email/phone). NEVER sends a chat message, never
// writes to RTDB, never mutates member state. Bounded attempts (one bare login per candidate)
// so wrong credentials cannot storm the account. Persists the resolved live URLs to state.json.
import { loadEnv } from './lib/env.js';
import { Store } from './lib/tokenstore.js';
import { LOGIN_CANDIDATES, REFRESH_CANDIDATES, LOGIN_BODY_BASE } from './lib/playtomic.js';
import { validAuthResponse, parseExpiryMs, validateMatchesPayload, hasContactPII, matchesWindow } from './lib/authcore.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';

const DIR = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(DIR, '.env'));
const store = new Store(DIR);
const TID = env.PLAYTOMIC_TENANT_ID;
const HEADERS = {
  'X-Requested-With': 'com.playtomic.web',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36',
  'Origin': 'https://manager.playtomic.io', 'Referer': 'https://manager.playtomic.io/', 'Accept': 'application/json',
};

async function jfetch(url, opts = {}, timeoutMs = 20000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) }, signal: ac.signal });
    const ct = res.headers.get('content-type') || '';
    let json = null, text = null;
    if (ct.includes('application/json')) { try { json = await res.json(); } catch {} }
    else { try { text = (await res.text()).slice(0, 200); } catch {} }
    return { status: res.status, ct, json, text };
  } catch (e) { return { status: 0, ct: '', json: null, text: null, err: e.name === 'AbortError' ? 'timeout' : e.message }; }
  finally { clearTimeout(t); }
}

const looksChallenged = (r) => r.status === 0 || (!r.ct.includes('application/json') && (r.text || '').match(/captcha|recaptcha|challenge|<!doctype html/i));

async function probeLogin(email, password) {
  const attempts = [];
  let success = null;
  for (const url of LOGIN_CANDIDATES) {
    const r = await jfetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...LOGIN_BODY_BASE, email, password }) });
    const gotToken = r.status >= 200 && r.status < 300 && validAuthResponse(r.ct, r.json);
    attempts.push({ url, status: r.status, gotToken, challenged: !!looksChallenged(r), err: r.err || null, expFmtOk: gotToken ? Number.isFinite(parseExpiryMs(r.json.access_token_expiration)) : null });
    if (gotToken) { success = { url, tokens: r.json, body: 'bare {email,password}' }; break; }
  }
  return { attempts, success };
}

async function probeScope(accessToken) {
  const { from, to } = matchesWindow(new Date().toISOString().slice(0, 10));
  const qs = new URLSearchParams({ disable_price_calculation: 'true', tenant_id: TID, is_playtomic_managed: 'true', has_players: 'true', from_start_date: from, to_start_date: to, match_status: 'PENDING', competition_mode: '', page: '0', size: '5', sort: 'start_date,asc' });
  const r = await jfetch(`https://manager.playtomic.io/api/v1/matches?${qs}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (r.status < 200 || r.status >= 300) return { status: r.status, managerScopeOk: false, note: `matches call returned ${r.status}` };
  const v = validateMatchesPayload(r.json);
  const pii = v.matches.length > 0 ? hasContactPII(v.matches) : null;
  return { status: r.status, matchesReturned: v.total, valid: v.matches.length, drift: v.drift, hasPII: pii, managerScopeOk: v.ok && (pii === true || v.total === 0), note: pii === null ? '0 open matches now — scope check inconclusive (retry when matches exist)' : (pii ? 'manager-scoped (email/phone present)' : 'NO PII — token lacks manager scope') };
}

// The base ROLE_CUSTOMER token can't see player PII. The manager exchanges it for a
// tenant-scoped token via requested_user_scopes:[{role:<MANAGER_ROLE>, scope_id:<tenant>}].
// Discover which role + grant yields a PII-capable token (we hold a valid token for our own tenant).
async function probeTenantExchange(base, email, password, availableScopes) {
  const url = 'https://manager.playtomic.io/api/v3/auth/login';
  // use the exact (role, scope_id) pairs the login response said we're entitled to,
  // preferring the manager role; fall back to a small guessed set.
  const pairs = [];
  for (const s of (availableScopes || [])) for (const role of (s.roles || [])) if (role !== 'ROLE_CUSTOMER') pairs.push({ role, scope_id: s.scope_id });
  if (!pairs.length) pairs.push({ role: 'ROLE_TENANT_MANAGER', scope_id: TID });
  const rank = (r) => ['ROLE_TENANT_MANAGER', 'ROLE_ORGANIZATION_OWNER', 'ROLE_ORGANIZATION_MANAGER', 'ROLE_ACTIVITY_MANAGER'].indexOf(r);
  pairs.sort((a, b) => (rank(a.role) < 0 ? 99 : rank(a.role)) - (rank(b.role) < 0 ? 99 : rank(b.role)));
  const attempts = [];
  for (const { role, scope_id } of pairs) {
    const scoped = { requested_user_scopes: [{ role, scope_id }], token_generation_mode: 'USER_PERMISSION' };
    const variants = [
      { name: 'email+password+scope', headers: { 'Content-Type': 'application/json' }, body: { ...scoped, email, password } },
      { name: 'refresh+scope', headers: { 'Content-Type': 'application/json' }, body: { ...scoped, refresh_token: base.refresh_token } },
      { name: 'bearer+scope', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${base.access_token}` }, body: scoped },
    ];
    for (const v of variants) {
      if (v.name === 'refresh+scope' && !base.refresh_token) continue;
      const r = await jfetch(url, { method: 'POST', headers: v.headers, body: JSON.stringify(v.body) });
      const got = r.status >= 200 && r.status < 300 && validAuthResponse(r.ct, r.json);
      let pii = null;
      if (got) { const sc = await probeScope(r.json.access_token); pii = sc.hasPII; if (sc.hasPII === true) return { role, scope_id, method: v.name, tokens: r.json, scope: sc, attempts }; }
      attempts.push({ role, scope_id, method: v.name, status: r.status, got, pii });
    }
  }
  return { attempts, none: true };
}

async function probeRefresh(refreshToken) {
  if (!refreshToken) return { skipped: 'no refresh_token from login' };
  const attempts = [];
  let liveUrl = null, rotated = null;
  for (const url of REFRESH_CANDIDATES) {
    const r = await jfetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) });
    const ok = r.status >= 200 && r.status < 300 && validAuthResponse(r.ct, r.json);
    attempts.push({ url, status: r.status, ok });
    if (ok) { liveUrl = url; rotated = !!r.json.refresh_token && r.json.refresh_token !== refreshToken; break; }
  }
  return { attempts, liveUrl, rotated };
}

async function main() {
  console.log('▸ Matchmaker auth prober (READ-ONLY — sends nothing)\n');
  if (!env.PLAYTOMIC_EMAIL || !env.PLAYTOMIC_PASSWORD) {
    console.error('✗ matchmaker/.env is missing PLAYTOMIC_EMAIL / PLAYTOMIC_PASSWORD. Fill it and re-run.');
    process.exit(2);
  }
  if (!TID) { console.error('✗ PLAYTOMIC_TENANT_ID missing from .env'); process.exit(2); }

  const login = await probeLogin(env.PLAYTOMIC_EMAIL, env.PLAYTOMIC_PASSWORD);
  const report = { at: new Date().toISOString(), login: login.attempts };

  if (!login.success) {
    const challenged = login.attempts.some(a => a.challenged);
    const rejected = login.attempts.some(a => a.status === 401 || a.status === 400);
    report.mode = challenged ? 'fallback-needed' : (rejected ? 'credentials-rejected' : 'endpoints-unreachable');
    console.log('LOGIN attempts:'); for (const a of login.attempts) console.log(`  ${a.status}  token=${a.gotToken}  challenged=${a.challenged}  ${a.url}${a.err ? '  (' + a.err + ')' : ''}`);
    console.log(`\n✗ Headless login did not yield a token → ${report.mode}`);
    if (report.mode === 'fallback-needed') console.log('  Login looks captcha/challenge-gated. Fallback: capture a refresh_token in-browser into .env PLAYTOMIC_REFRESH_TOKEN.');
    if (report.mode === 'credentials-rejected') console.log('  The endpoint rejected the login — double-check PLAYTOMIC_EMAIL/PASSWORD in matchmaker/.env.');
    writeReport(report); process.exit(1);
  }

  console.log('LOGIN attempts:'); for (const a of login.attempts) console.log(`  ${a.status}  token=${a.gotToken}  ${a.url}`);
  console.log(`\n✓ Headless login works → ${login.success.url}  (body: ${login.success.body})`);

  // Inspect the login response for scope hints (redacting token values), and query the user's
  // tenant/org memberships to learn the exact (role, scope_id) to request for a manager token.
  {
    const tk = login.success.tokens;
    const safeKeys = {}; for (const k of Object.keys(tk)) safeKeys[k] = /token|secret/i.test(k) ? '<redacted>' : tk[k];
    console.log('\nLOGIN RESPONSE fields:', JSON.stringify(safeKeys).slice(0, 800));
    const uid = tk.user_id;
    const meCands = [
      `https://manager.playtomic.io/api/v3/users/me`,
      `https://manager.playtomic.io/api/v1/users/me`,
      `https://manager.playtomic.io/api/v3/users/${uid}`,
      `https://manager.playtomic.io/api/v1/tenants?user_id=${uid}`,
      `https://manager.playtomic.io/api/v1/organizations?user_id=${uid}`,
    ];
    report.membership = [];
    for (const url of meCands) {
      const r = await jfetch(url, { headers: { Authorization: `Bearer ${tk.access_token}` } });
      let hint = null;
      if (r.json) { const s = JSON.stringify(r.json); hint = s.length > 600 ? (s.slice(0, 600) + '…') : s; }
      report.membership.push({ url: url.replace('https://manager.playtomic.io', ''), status: r.status, sample: hint });
      console.log(`  ${r.status}  ${url.replace('https://manager.playtomic.io', '')}${hint ? '  ' + hint.slice(0, 300) : ''}`);
    }
  }
  report.liveLoginUrl = login.success.url;
  report.tokenExpiry = login.success.tokens.access_token_expiration;
  report.userId = login.success.tokens.user_id ?? null;

  const baseScope = await probeScope(login.success.tokens.access_token);
  report.baseScope = baseScope;
  console.log(`\nBASE TOKEN SCOPE: matches=${baseScope.matchesReturned}  ${baseScope.note}`);

  // If the base token lacks PII, find the tenant-scoped exchange.
  let effectiveTokens = login.success.tokens;
  let effectiveScope = baseScope;
  if (baseScope.hasPII !== true && baseScope.matchesReturned > 0) {
    console.log('\n▸ Base token lacks manager scope — probing tenant-token exchange…');
    const ex = await probeTenantExchange(login.success.tokens, env.PLAYTOMIC_EMAIL, env.PLAYTOMIC_PASSWORD, login.success.tokens.available_scopes);
    report.tenantExchange = { role: ex.role || null, scope_id: ex.scope_id || null, method: ex.method || null, attempts: ex.attempts };
    if (ex.role) {
      console.log(`✓ Tenant-scoped token via role=${ex.role} scope_id=${ex.scope_id} (${ex.method}) — matches=${ex.scope.matchesReturned}, PII visible`);
      effectiveTokens = ex.tokens; effectiveScope = ex.scope;
      report.managerRole = ex.role; report.exchangeMethod = ex.method;
    } else {
      console.log('✗ No tested role yielded a PII-capable token:');
      for (const a of ex.attempts) console.log(`  role=${a.role} ${a.method} status=${a.status} token=${a.got} pii=${a.pii}`);
    }
  }

  const refresh = await probeRefresh(effectiveTokens.refresh_token);
  report.refresh = refresh;
  if (refresh.liveUrl) console.log(`\n✓ Refresh works → ${refresh.liveUrl}  (rotates token: ${refresh.rotated})`);
  else console.log(`\n⚠ Refresh: ${refresh.skipped || 'no candidate returned a token'} (daemon can re-login+re-exchange instead)`);

  const managerOk = effectiveScope.hasPII === true;
  report.mode = managerOk ? 'headless-works' : 'headless-login-ok-scope-open';
  store.saveState({ liveLoginUrl: login.success.url, liveRefreshUrl: refresh.liveUrl || null, managerRole: report.managerRole || null, exchangeMethod: report.exchangeMethod || null, probeMode: report.mode, probedAt: report.at });
  writeReport(report);

  console.log('\n─────────────────────────────────────────');
  console.log(managerOk
    ? `RESULT: headless-works ✓  (login + tenant exchange role=${report.managerRole}). Resolved to state.json.`
    : 'RESULT: login works, tenant scope UNRESOLVED — see attempts above.');
}

function writeReport(report) {
  try {
    mkdirSync(join(DIR, 'logs'), { recursive: true });
    const f = join(DIR, 'logs', `probe-${report.at.replace(/[:.]/g, '-')}.json`);
    writeFileSync(f, JSON.stringify(report, null, 1), { mode: 0o600 });
    chmodSync(f, 0o600);
    console.log(`\n  (report written to matchmaker/logs/${f.split('/').pop()})`);
  } catch (e) { console.error('  (could not write report log:', e.message, ')'); }
}

main().catch(e => { console.error('✗ prober error:', e.message); process.exit(3); });
