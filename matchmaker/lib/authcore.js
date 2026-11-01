// matchmaker/lib/authcore.js
// PURE helpers for the Playtomic client — no IO, no network, no clock reads (now is passed in).
// Everything here is unit-tested in test/playtomic.test.js. These encode the red-team must-fixes
// that are pure logic: expiry-fails-closed, content-validation, schema-drift, id-segment safety.

// --- token expiry (FAILS CLOSED) ------------------------------------------
// Parse access_token_expiration to epoch ms. Playtomic sends naive-UTC (no tz suffix), e.g.
// "2026-08-11T15:04:05". Anything missing / unparseable / wrong-typed -> NaN, and callers MUST
// treat NaN as "already expired" (never valid-forever). Also accepts epoch numbers + RFC3339.
export function parseExpiryMs(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? (v > 1e12 ? v : v * 1000) : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  if (!s) return NaN;
  const hasTz = /[zZ]$|[+-]\d\d:?\d\d$/.test(s);
  const ms = Date.parse(hasTz ? s : s + 'Z');
  return Number.isFinite(ms) ? ms : NaN;
}

// Is the cached access token usable at nowMs, leaving skewMs of head-room? FAILS CLOSED:
// no token, or non-finite/expired-looking expiry -> false (forces refresh/login).
export function accessTokenUsable(tokens, nowMs, skewMs) {
  if (!tokens || typeof tokens.access_token !== 'string' || !tokens.access_token) return false;
  const exp = parseExpiryMs(tokens.access_token_expiration);
  if (!Number.isFinite(exp)) return false;
  return nowMs + skewMs < exp;
}

// --- auth response content-validation -------------------------------------
// A 200 is NOT success. A same-origin proxy can 200 an HTML interstitial -> "Bearer undefined".
// Require JSON + a real access_token + a parseable expiration before trusting/caching anything.
export function validAuthResponse(contentType, body) {
  if (typeof contentType !== 'string' || !contentType.toLowerCase().includes('application/json')) return false;
  if (!body || typeof body !== 'object') return false;
  if (typeof body.access_token !== 'string' || body.access_token.length < 8) return false;
  if (!Number.isFinite(parseExpiryMs(body.access_token_expiration))) return false;
  return true;
}

// --- matches payload normalization + validation ---------------------------
// The real API player fields are user_id/level_value/name/email/phone and match fields are
// min_players_per_team/max_players_per_team/resource_name/owner_id. The scorer expects the
// sanitized shape {id,level,conf} + {min_per_team,max_per_team,court,owner}. normalizeMatch maps
// API -> scorer shape while KEEPING name/email/phone for messaging + the scope-downgrade check.
export function normalizeMatch(raw) {
  return {
    match_id: raw.match_id,
    start_date: raw.start_date, end_date: raw.end_date,
    min_level: raw.min_level, max_level: raw.max_level,
    min_per_team: raw.min_players_per_team, max_per_team: raw.max_players_per_team,
    court: raw.resource_name || null, court_id: raw.court_id || null,
    owner: raw.owner_id || null, status: raw.status, game_status: raw.game_status,
    teams: (raw.teams || []).map(t => ({
      players: (t.players || []).map(p => ({
        id: p.user_id, level: p.level_value, conf: p.level_confidence,
        name: p.name, email: p.email || null, phone: p.phone || null,
      })),
    })),
  };
}

function isFiniteNum(n) { return typeof n === 'number' && Number.isFinite(n); }

// Validate ONE raw API match. Returns true only if the fields the pipeline depends on are sane.
export function isValidRawMatch(m) {
  if (!m || typeof m !== 'object') return false;
  if (!m.match_id) return false;
  if (!Number.isFinite(Date.parse(String(m.start_date))) || !Number.isFinite(Date.parse(String(m.end_date)))) return false;
  if (!isFiniteNum(m.min_level) || !isFiniteNum(m.max_level)) return false;
  if (m.min_level > m.max_level) return false;
  if (m.min_level < 0 || m.max_level > 7) return false;
  const maxPer = m.max_players_per_team;
  if (!isFiniteNum(maxPer) || maxPer < 1) return false;
  if (!Array.isArray(m.teams)) return false;
  for (const t of m.teams) {
    if (!t || !Array.isArray(t.players)) return false;
    for (const p of t.players) {
      if (p == null || p.user_id == null) return false;
      if (typeof p.name !== 'string') return false;
      if (!isFiniteNum(p.level_value)) return false;
    }
  }
  return true;
}

// The whole-payload guard. The matches endpoint returns a BARE ARRAY (confirmed 10 Aug).
// Not-an-array -> systemic drift (NOT "empty"). Empty array -> legitimately no open matches.
// >25% bad rows -> systemic drift. One bad row -> skip it, keep going.
export function validateMatchesPayload(json) {
  if (!Array.isArray(json)) return { ok: false, drift: 'not_array', matches: [], skipped: 0, total: 0 };
  const good = [];
  let bad = 0;
  for (const m of json) { if (isValidRawMatch(m)) good.push(m); else bad++; }
  const total = json.length;
  const systemic = total > 0 && bad / total > 0.25;
  return {
    ok: !systemic,
    drift: systemic ? 'high_bad_ratio' : null,
    matches: good.map(normalizeMatch),
    skipped: bad,
    total,
  };
}

// Runtime scope check: once we have matches, at least some player must carry email or phone,
// or the token silently lost manager scope (SCOPE_DOWNGRADE) — distinct from "no matches".
export function hasContactPII(normalizedMatches) {
  for (const m of normalizedMatches) {
    for (const t of m.teams) {
      for (const p of t.players) { if (p.email || p.phone) return true; }
    }
  }
  return false;
}

// --- id-segment safety (writer phase, cheap to include now) ---------------
// threadId/messageId get interpolated into an RTDB REST path; a stray '/' or '.' would redirect
// the write. Allow only a conservative id charset.
export function isSafePathSegment(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= 128 && /^[A-Za-z0-9_.:-]+$/.test(s) && !s.includes('..');
}

// --- date-window helper (≤3 day windows; UTC ISO) -------------------------
// Build from_start_date/to_start_date for a playing date D (local): (D-1)T23:00 .. DT22:59:59.999
// as the spec/trap requires. dateStr is 'YYYY-MM-DD'. Returns { from, to }.
export function matchesWindow(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const prev = new Date(d.getTime() - 24 * 3600 * 1000);
  const iso = (dt, hh, mm, ss, ms) =>
    `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}` +
    `T${hh}:${mm}:${ss}${ms}`;
  return { from: iso(prev, '23', '00', '00', ''), to: iso(d, '22', '59', '59', '.999') };
}
