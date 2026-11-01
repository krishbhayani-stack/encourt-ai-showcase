// matchmaker/test/playtomic.test.js — auth core + client state machine (mock fetch, no network).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseExpiryMs, accessTokenUsable, validAuthResponse, validateMatchesPayload,
  normalizeMatch, hasContactPII, isSafePathSegment, matchesWindow,
} from '../lib/authcore.js';
import { Store } from '../lib/tokenstore.js';
import { PlaytomicClient, AuthDeadError } from '../lib/playtomic.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}  ${x}`); } };
const freshDir = () => new Store(mkdtempSync(join(tmpdir(), 'mm-')));
const NOW = Date.parse('2026-08-11T12:00:00Z');
const mkRes = (status, body, ct = 'application/json', retryAfter = null) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: (h) => { h = h.toLowerCase(); if (h === 'content-type') return ct; if (h === 'retry-after') return retryAfter; return null; } },
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
const validTokens = (exp = '2026-08-11T13:00:00') => ({ access_token: 'ACCESSxxxx', refresh_token: 'REFRESHxxxx', access_token_expiration: exp, user_id: 42 });

// ---------- pure: expiry (FAILS CLOSED) ----------
console.log('authcore — expiry parsing (fails closed):');
ok('naive-UTC parses as UTC', parseExpiryMs('2026-08-11T13:00:00') === Date.parse('2026-08-11T13:00:00Z'));
ok('explicit Z respected', parseExpiryMs('2026-08-11T13:00:00Z') === Date.parse('2026-08-11T13:00:00Z'));
ok('epoch seconds', parseExpiryMs(1786000000) === 1786000000 * 1000);
ok('null -> NaN', Number.isNaN(parseExpiryMs(null)));
ok('empty string -> NaN', Number.isNaN(parseExpiryMs('')));
ok('garbage -> NaN', Number.isNaN(parseExpiryMs('not-a-date')));
ok('fresh token usable', accessTokenUsable(validTokens(), NOW, 300000) === true);
ok('expired token NOT usable', accessTokenUsable(validTokens('2026-08-11T12:01:00'), NOW, 300000) === false);
ok('missing expiry NOT usable (fail closed)', accessTokenUsable({ access_token: 'x' }, NOW, 300000) === false);
ok('no token NOT usable', accessTokenUsable(null, NOW, 300000) === false);

// ---------- pure: auth response content-validation ----------
console.log('\nauthcore — content validation (200 is not success):');
ok('valid json+token+exp', validAuthResponse('application/json', validTokens()) === true);
ok('html interstitial rejected', validAuthResponse('text/html', '<!doctype html>') === false);
ok('json but no token rejected', validAuthResponse('application/json', { error: 'x' }) === false);
ok('json token but bad expiry rejected', validAuthResponse('application/json', { access_token: 'abcdefgh', access_token_expiration: 'x' }) === false);

// ---------- pure: matches payload ----------
console.log('\nauthcore — matches payload guard + normalize:');
const rawMatch = (over = {}) => ({ match_id: 'm1', start_date: '2026-08-11T14:00:00', end_date: '2026-08-11T15:30:00', min_level: 2.0, max_level: 3.0, min_players_per_team: 2, max_players_per_team: 2, resource_name: 'Padel 5', owner_id: 7, status: 'PENDING', teams: [{ players: [{ user_id: 9, name: 'A', level_value: 2.5, email: 'a@x.com', phone: '07x' }] }], ...over });
{
  const v = validateMatchesPayload([rawMatch()]);
  ok('valid array -> ok, normalized', v.ok && v.matches.length === 1 && v.matches[0].teams[0].players[0].id === 9 && v.matches[0].teams[0].players[0].level === 2.5);
  ok('empty array -> ok + empty (not drift)', validateMatchesPayload([]).ok === true && validateMatchesPayload([]).matches.length === 0);
  ok('non-array -> drift', validateMatchesPayload({ error: 'oops' }).drift === 'not_array');
  const mixed = [rawMatch(), rawMatch({ min_level: 5, max_level: 3 }), rawMatch({ match_id: null }), rawMatch({ min_level: 'x' })];
  ok('>25% bad -> systemic drift', validateMatchesPayload(mixed).ok === false);
  const oneBad = [rawMatch(), rawMatch(), rawMatch(), rawMatch({ match_id: null })];
  const v2 = validateMatchesPayload(oneBad);
  ok('one bad row -> skip, keep going', v2.ok && v2.matches.length === 3 && v2.skipped === 1);
  ok('hasContactPII true when email present', hasContactPII(v.matches) === true);
  ok('hasContactPII false when no email/phone', hasContactPII([normalizeMatch(rawMatch({ teams: [{ players: [{ user_id: 1, name: 'N', level_value: 2 }] }] }))]) === false);
}

// ---------- pure: misc ----------
console.log('\nauthcore — id safety + window:');
ok('safe id ok', isSafePathSegment('abc-123_DE'));
ok('slash rejected', !isSafePathSegment('a/b'));
ok('dotdot rejected', !isSafePathSegment('a..b'));
{
  const w = matchesWindow('2026-08-11');
  ok('window from = prev 23:00', w.from === '2026-08-10T23:00:00');
  ok('window to = day 22:59:59.999', w.to === '2026-08-11T22:59:59.999');
}

// ---------- client: login + content validation ----------
console.log('\nclient — login:');
{
  const store = freshDir();
  const client = new PlaytomicClient({ store, env: { PLAYTOMIC_EMAIL: 'e', PLAYTOMIC_PASSWORD: 'p', PLAYTOMIC_TENANT_ID: 'T' }, fetchFn: async () => mkRes(200, validTokens()), now: () => NOW, sleep: async () => {} });
  const t = await client.login();
  ok('login saves valid tokens', t.access_token === 'ACCESSxxxx' && store.loadTokens().access_token === 'ACCESSxxxx');
  ok('login caches live url', store.loadState().liveLoginUrl != null);
}
{
  const store = freshDir();
  const client = new PlaytomicClient({ store, env: { PLAYTOMIC_EMAIL: 'e', PLAYTOMIC_PASSWORD: 'p', PLAYTOMIC_TENANT_ID: 'T' }, fetchFn: async () => mkRes(200, '<!doctype html>login', 'text/html'), now: () => NOW, sleep: async () => {} });
  let threw = false; try { await client.login(); } catch { threw = true; }
  ok('200 HTML interstitial NOT treated as login success', threw && store.loadTokens() === null);
}

// ---------- client: getAccessToken uses cache, refreshes when stale ----------
console.log('\nclient — token lifecycle:');
{
  const store = freshDir(); store.saveTokens(validTokens());
  let calls = 0;
  const client = new PlaytomicClient({ store, env: {}, fetchFn: async () => { calls++; return mkRes(200, validTokens()); }, now: () => NOW, sleep: async () => {} });
  const tok = await client.getAccessToken();
  ok('fresh cached token used without any fetch', tok === 'ACCESSxxxx' && calls === 0);
}
{
  const store = freshDir(); store.saveTokens(validTokens('2026-08-11T12:01:00')); // ~expired within skew
  let refreshed = 0;
  const client = new PlaytomicClient({ store, env: {}, fetchFn: async (url) => { refreshed++; return mkRes(200, validTokens('2026-08-11T13:30:00')); }, now: () => NOW, sleep: async () => {} });
  const tok = await client.getAccessToken();
  ok('near-expiry token triggers refresh-ahead', refreshed === 1 && parseExpiryMs(store.loadTokens().access_token_expiration) > NOW);
}

// ---------- client: 401 -> refresh -> retry once ----------
console.log('\nclient — 401 retry + AUTH_DEAD latch:');
{
  const store = freshDir(); store.saveTokens(validTokens());
  const script = [mkRes(401, { error: 'expired' }), mkRes(200, validTokens('2026-08-11T13:30:00')), mkRes(200, { ok: true })];
  let i = 0;
  const client = new PlaytomicClient({ store, env: {}, fetchFn: async () => script[i++], now: () => NOW, sleep: async () => {} });
  const res = await client.authedFetch('https://x/data');
  ok('401 -> single refresh -> retry succeeds', res.status === 200 && i === 3);
}
{
  const store = freshDir(); store.saveTokens(validTokens());
  const script = [mkRes(401, { error: 'e' }), mkRes(200, validTokens('2026-08-11T13:30:00')), mkRes(401, { error: 'e' })];
  let i = 0;
  const client = new PlaytomicClient({ store, env: {}, fetchFn: async () => script[i++], now: () => NOW, sleep: async () => {} });
  let dead = false; try { await client.authedFetch('https://x/data'); } catch (e) { dead = e instanceof AuthDeadError; }
  ok('two 401s -> AuthDeadError thrown', dead);
  ok('AUTH_DEAD latched to disk', store.loadState().authDead === true);
  // latch persists: a fresh client refuses to auth
  const client2 = new PlaytomicClient({ store, env: { PLAYTOMIC_EMAIL: 'e', PLAYTOMIC_PASSWORD: 'p' }, fetchFn: async () => { throw new Error('should not fetch'); }, now: () => NOW, sleep: async () => {} });
  let refused = false; try { await client2.getAccessToken(); } catch (e) { refused = e instanceof AuthDeadError; }
  ok('latched AUTH_DEAD survives restart (no login attempt)', refused);
}

// ---------- client: refresh precedence (.tokens.json over .env seed) ----------
console.log('\nclient — refresh precedence + mode fail-closed:');
{
  const store = freshDir();
  store.saveTokens({ access_token: 'OLD', access_token_expiration: '2026-08-11T12:01:00', refresh_token: 'DISK_REFRESH' });
  let usedRefresh = null;
  const client = new PlaytomicClient({ store, env: { PLAYTOMIC_REFRESH_TOKEN: 'ENV_SEED' }, fetchFn: async (url, opts) => { usedRefresh = JSON.parse(opts.body).refresh_token; return mkRes(200, validTokens('2026-08-11T13:30:00')); }, now: () => NOW, sleep: async () => {} });
  await client.getAccessToken();
  ok('disk refresh_token wins over .env seed', usedRefresh === 'DISK_REFRESH');
}
ok('mode defaults to PILOT (fail closed) on empty state', freshDir().loadState().mode === 'PILOT');
{
  const store = freshDir(); store.saveState({ mode: 'GARBAGE' });
  ok('unknown mode -> PILOT (never AUTO)', store.loadState().mode === 'PILOT');
  store.saveState({ mode: 'AUTO' });
  ok('explicit AUTO honored', store.loadState().mode === 'AUTO');
}

// ---------- store: single-instance lock ----------
console.log('\nstore — single-instance lock:');
{
  const store = freshDir();
  const rel = store.acquireLock();
  let second = false; try { store.acquireLock(); } catch (e) { second = e.code === 'ELOCKED'; }
  ok('second acquire on live pid -> ELOCKED', second);
  rel();
  let third = true; try { const r2 = store.acquireLock(); r2(); } catch { third = false; }
  ok('after release, lock re-acquirable', third);
}

// ---------- writer stays disabled ----------
console.log('\nclient — writer disabled:');
{
  const client = new PlaytomicClient({ store: freshDir(), env: {} });
  let threw = false; try { await client.sendChatMessage('m1', 'hi', 'id1'); } catch { threw = true; }
  ok('sendChatMessage throws (disabled)', threw);
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
