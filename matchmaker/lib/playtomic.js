// matchmaker/lib/playtomic.js
// Playtomic API client for the matchmaker daemon: headless login + refresh, one authed choke
// point (authedFetch) with 401-retry / transient-backoff, and fetchOpenMatches. The Firebase
// chat WRITER is deliberately DISABLED here (sendChatMessage throws) — it's gated behind the
// pilot approval flow + the read-only RTDB confirmations listed in the spec's writer gate.
//
// Auth-path red-team must-fixes implemented: content-validation (not just 200), expiry-fails-
// closed, AUTH_DEAD persisted latch + login-failure cap, single-flight refresh, refresh
// precedence (.tokens.json over .env seed), auth fetches exempt from the request mutex (no
// re-entrant deadlock), candidate-URL walk + cache, backoff honoring Retry-After.
import {
  parseExpiryMs, accessTokenUsable, validAuthResponse, validateMatchesPayload,
  hasContactPII, matchesWindow,
} from './authcore.js';

export const LOGIN_CANDIDATES = [
  'https://manager.playtomic.io/api/v3/auth/login',
  'https://api.playtomic.io/v3/auth/login',
  'https://manager.playtomic.io/api/auth/login',
  'https://api.app.playtomic.io/v3/auth/login',
];
export const REFRESH_CANDIDATES = [
  'https://manager.playtomic.io/api/v3/auth/refresh',
  'https://api.playtomic.io/v3/auth/token',
  'https://manager.playtomic.io/api/auth/refresh',
];
const MATCHES_BASE = 'https://manager.playtomic.io/api/v1/matches';

// The login body shape (captured 10 Aug 2026). email/password + a scoped requested_user_scopes
// are required (bare {email,password} -> 400 INVALID_TOKEN_SCOPE). For the DAEMON we request the
// manager scope directly ({role: ROLE_TENANT_MANAGER, scope_id: <tenant>}) so one login yields a
// manager-scoped token that sees ALL club matches + player PII. token_generation_mode fixed.
export const TOKEN_GENERATION_MODE = 'USER_PERMISSION';
export const DEFAULT_MANAGER_ROLE = 'ROLE_TENANT_MANAGER';

const DEFAULTS = {
  refreshSkewMs: 300_000,      // refresh 5 min before expiry (never let a token die mid-poll)
  requestTimeoutMs: 20_000,
  maxLoginFailures: 3,         // lifetime cap before AUTH_DEAD latch (persisted)
  maxTransientRetries: 4,
  baseBackoffMs: 1000,
  maxBackoffMs: 60_000,
  headers: {
    'X-Requested-With': 'com.playtomic.web',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36',
    'Origin': 'https://manager.playtomic.io',
    'Referer': 'https://manager.playtomic.io/',
    'Accept': 'application/json',
  },
};

export class AuthDeadError extends Error { constructor(m) { super(m); this.name = 'AuthDeadError'; this.authDead = true; } }
class TransientError extends Error { constructor(m, retryAfterMs) { super(m); this.transient = true; this.retryAfterMs = retryAfterMs; } }

class Mutex {
  constructor() { this._p = Promise.resolve(); }
  run(fn) { const r = this._p.then(() => fn()); this._p = r.then(() => {}, () => {}); return r; }
}

export class PlaytomicClient {
  constructor({ store, env, fetchFn = globalThis.fetch, now = () => Date.now(), sleep, log = () => {}, config = {} } = {}) {
    this.store = store;
    this.env = env || {};
    this.fetch = fetchFn;
    this.now = now;
    this.sleep = sleep || ((ms) => new Promise(r => setTimeout(r, ms)));
    this.log = log;
    this.cfg = { ...DEFAULTS, ...config };
    this.tenantId = this.env.PLAYTOMIC_TENANT_ID;
    this._mutex = new Mutex();           // serializes DATA requests only
    this._refreshInFlight = null;        // single-flight refresh
  }

  // ---- low-level fetch with hard timeout ---------------------------------
  async _fetch(url, opts = {}) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.cfg.requestTimeoutMs);
    try { return await this.fetch(url, { ...opts, signal: ac.signal }); }
    finally { clearTimeout(t); }
  }
  _headers(extra) { return { ...this.cfg.headers, ...extra }; }

  // ---- AUTH_DEAD latch ---------------------------------------------------
  _latchAuthDead(reason) {
    this.store.saveState({ authDead: true, authDeadReason: reason, authDeadAt: this.now() });
    this.log('AUTH_DEAD', reason);
  }
  assertNotAuthDead() {
    if (this.store.loadState().authDead) throw new AuthDeadError('AUTH_DEAD latched — refusing to auth');
  }

  // ---- login (walks candidates, validates CONTENT, caps failures) --------
  async login() {
    this.assertNotAuthDead();
    const email = this.env.PLAYTOMIC_EMAIL, password = this.env.PLAYTOMIC_PASSWORD;
    if (!email || !password) throw new AuthDeadError('no PLAYTOMIC_EMAIL/PASSWORD in .env');
    const st = this.store.loadState();
    const role = this.env.PLAYTOMIC_MANAGER_ROLE || st.managerRole || DEFAULT_MANAGER_ROLE;
    const bodies = [
      {                                                                // direct manager-scoped login
        requested_user_scopes: [{ role, scope_id: this.tenantId }],
        token_generation_mode: TOKEN_GENERATION_MODE, email, password,
      },
    ];
    const urls = st.liveLoginUrl ? [st.liveLoginUrl, ...LOGIN_CANDIDATES.filter(u => u !== st.liveLoginUrl)] : [...LOGIN_CANDIDATES];

    let sawTerminal = false;
    for (const url of urls) {
      for (const body of bodies) {
        let res;
        try { res = await this._fetch(url, { method: 'POST', headers: this._headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) }); }
        catch { continue; }                                            // network/timeout — try next
        const ct = res.headers.get('content-type') || '';
        let json = null; try { json = await res.json(); } catch {}
        if (res.ok && validAuthResponse(ct, json)) {
          this.store.saveTokens(json);
          this.store.saveState({ liveLoginUrl: url, loginBody: stripCreds(body), loginFailCount: 0 });
          this.log('login ok', url);
          return json;
        }
        if (res.status === 401 || res.status === 400) sawTerminal = true; // bad creds-ish
      }
    }
    if (sawTerminal) {
      const n = (this.store.loadState().loginFailCount || 0) + 1;
      this.store.saveState({ loginFailCount: n });
      if (n >= this.cfg.maxLoginFailures) { this._latchAuthDead(`login rejected ${n}x (bad credentials?)`); throw new AuthDeadError('login rejected — check .env credentials'); }
      throw new AuthDeadError('login rejected (credentials?)');
    }
    throw new TransientError('all login endpoints unreachable');
  }

  // ---- refresh (single-flight; validates CONTENT; falls back to login) ---
  _refreshSingleFlight() {
    if (this._refreshInFlight) return this._refreshInFlight;
    this._refreshInFlight = this._doRefreshOrLogin().finally(() => { this._refreshInFlight = null; });
    return this._refreshInFlight;
  }
  async _doRefreshOrLogin() {
    this.assertNotAuthDead();
    const tokens = this.store.loadTokens();
    // precedence: on-disk refresh token wins; .env seed only when disk has none
    const refreshTok = (tokens && tokens.refresh_token) || this.env.PLAYTOMIC_REFRESH_TOKEN || null;
    if (refreshTok) {
      try { return await this._refresh(refreshTok); }
      catch (e) { if (e.transient) throw e; this.log('refresh failed, falling back to login', e.message); }
    }
    return this.login();
  }
  async _refresh(refreshTok) {
    const st = this.store.loadState();
    const urls = st.liveRefreshUrl ? [st.liveRefreshUrl, ...REFRESH_CANDIDATES.filter(u => u !== st.liveRefreshUrl)] : [...REFRESH_CANDIDATES];
    let invalidGrant = false;
    for (const url of urls) {
      let res;
      try { res = await this._fetch(url, { method: 'POST', headers: this._headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ refresh_token: refreshTok }) }); }
      catch { continue; }
      const ct = res.headers.get('content-type') || '';
      let json = null; try { json = await res.json(); } catch {}
      if (res.ok && validAuthResponse(ct, json)) {
        // persist rotated refresh_token immediately (carry old if response omits it)
        if (!json.refresh_token && tokensRefresh(this.store)) json.refresh_token = tokensRefresh(this.store);
        this.store.saveTokens(json);
        this.store.saveState({ liveRefreshUrl: url });
        return json;
      }
      if (res.status === 401 || res.status === 400) invalidGrant = true; // rotated/expired
    }
    if (invalidGrant) { const e = new Error('refresh invalid_grant'); e.invalidGrant = true; throw e; }
    throw new TransientError('all refresh endpoints unreachable');
  }

  // ---- the only thing that hands out a live bearer -----------------------
  async getAccessToken() {
    this.assertNotAuthDead();
    const tokens = this.store.loadTokens();
    if (accessTokenUsable(tokens, this.now(), this.cfg.refreshSkewMs)) return tokens.access_token;
    const fresh = await this._refreshSingleFlight();
    if (!fresh || !fresh.access_token) throw new AuthDeadError('no access token after refresh/login');
    return fresh.access_token;
  }

  // ---- THE authed choke point for every DATA request ---------------------
  // Serialized by the mutex (one data request in flight). Auth calls above do NOT use the mutex.
  async authedFetch(url, opts = {}) {
    return this._mutex.run(() => this._authedFetchInner(url, opts));
  }
  async _authedFetchInner(url, opts) {
    let attempt = 0;
    for (;;) {
      const token = await this.getAccessToken();     // may refresh-ahead (auth path, no mutex)
      let res;
      try { res = await this._fetch(url, { ...opts, headers: this._headers({ ...(opts.headers || {}), Authorization: `Bearer ${token}` }) }); }
      catch (e) {                                     // timeout/network → transient
        if (++attempt > this.cfg.maxTransientRetries) throw new TransientError('request failed after retries: ' + e.message);
        await this._backoff(attempt); continue;
      }
      if (res.status === 401) {
        await this._refreshSingleFlight();            // one forced refresh
        const token2 = await this.getAccessToken();
        const res2 = await this._fetch(url, { ...opts, headers: this._headers({ ...(opts.headers || {}), Authorization: `Bearer ${token2}` }) });
        if (res2.status === 401) { this._latchAuthDead('two consecutive 401s on a data request'); throw new AuthDeadError('data request 401 after refresh'); }
        return res2;
      }
      if (res.status === 429 || res.status >= 500) {
        if (++attempt > this.cfg.maxTransientRetries) throw new TransientError(`status ${res.status} after retries`);
        await this._backoff(attempt, res.headers.get('retry-after')); continue;
      }
      return res;
    }
  }
  async _backoff(attempt, retryAfter) {
    let ms = Math.min(this.cfg.maxBackoffMs, this.cfg.baseBackoffMs * 2 ** (attempt - 1));
    const ra = Number(retryAfter);
    if (Number.isFinite(ra) && ra > 0) ms = Math.min(this.cfg.maxBackoffMs, ra * 1000);
    ms = Math.floor(ms / 2 + Math.random() * (ms / 2));   // full-ish jitter
    await this.sleep(ms);
  }

  // ---- read open matches for a playing date ('YYYY-MM-DD') ---------------
  async fetchOpenMatches(dateStr) {
    const { from, to } = matchesWindow(dateStr);       // ≤3-day window, UTC
    const raw = [];
    for (let page = 0; page < 20; page++) {            // page to exhaustion (don't trust size)
      const qs = new URLSearchParams({
        disable_price_calculation: 'true', tenant_id: this.tenantId, is_playtomic_managed: 'true',
        has_players: 'true', from_start_date: from, to_start_date: to, match_status: 'PENDING',
        competition_mode: '', page: String(page), size: '100', sort: 'start_date,asc',
      });
      const res = await this.authedFetch(`${MATCHES_BASE}?${qs}`);
      if (!res.ok) throw new Error(`matches ${res.status}`);
      const chunk = await res.json();
      if (!Array.isArray(chunk) || chunk.length === 0) { if (page === 0) return this._finishMatches(chunk); break; }
      raw.push(...chunk);
      if (chunk.length < 100) break;
    }
    return this._finishMatches(raw);
  }
  _finishMatches(json) {
    const v = validateMatchesPayload(json);
    if (!v.ok) { this.store.saveState({ lastDrift: v.drift, lastDriftAt: this.now() }); const e = new Error('SCHEMA_DRIFT: ' + v.drift); e.schemaDrift = true; e.detail = v; throw e; }
    // scope-downgrade alarm: matches present but no contact PII => token lost manager scope
    if (v.matches.length > 0 && !hasContactPII(v.matches)) { const e = new Error('SCOPE_DOWNGRADE: matches have no email/phone'); e.scopeDowngrade = true; throw e; }
    this.store.saveState({ lastGoodPollAt: this.now() });
    return v.matches;
  }

  // ---- WRITER: DISABLED this phase ---------------------------------------
  async sendChatMessage() {
    throw new Error('sendChatMessage is DISABLED — the Firebase writer is gated behind the pilot approval flow and the read-only RTDB confirmations (see spec writer gate).');
  }
}

function stripCreds(body) { const b = { ...body }; delete b.email; delete b.password; return b; }
function tokensRefresh(store) { const t = store.loadTokens(); return t && t.refresh_token; }
