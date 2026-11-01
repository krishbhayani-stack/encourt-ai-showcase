# Spec — Open-Match Consolidation ("Matchmaker" daemon)

Ground truth for the 24/7 near-miss match consolidator. Commissioned by Krish 10 Aug 2026 from
a member's idea (9 Aug): under-filled open matches at adjacent times often COULD fill if
someone moved 30 minutes — so detect the near-misses and ping the players automatically.
Status: **SPEC DRAFT — discovery items open, nothing built, nothing sent.**

## Locked rules (Krish, 10 Aug 2026)

| Rule | Value |
|---|---|
| Time window for a proposed move | **±30 min only** |
| Level rule | **Strict fit** — a player is only proposed into a match whose stated range contains their level. No stretch, no overlap-only. |
| Rollout | **Pilot week first**: daemon runs 24/7 from day one but queues every message for Krish's one-tap approval. Flip to full auto only after Krish signs off the pilot. |
| Runtime | **24/7 localhost daemon** (Krish: "like I'm building a business") — NOT scheduled Claude sessions. Poll loop, default every 10 min, config-tunable. |
| Placement | **Completely separate from Jarvis** (Krish, 10 Aug: "dont bring jarvis into this"). Own top-level `matchmaker/` dir, own process, own port, own dashboard. Shares nothing with the deck app. |
| AI at runtime | **None.** Detection, scoring, and message templating are deterministic code (constitution rule 3). Claude builds/maintains; the daemon runs alone. |

## What it does (loop)

1. Pull open matches + bookings for today + tomorrow (≤3-day windows — trap 15 in
   [[playtomic-live-pull]] spec; all times UTC→BST +1h).
2. Find **near-miss sets**: an under-filled open match plus players in other under-filled
   matches within ±30 min on any court whose levels strict-fit its range.
3. Score proposals: prefer moves that (a) complete a match to 4/4, (b) free a whole court slot
   (resellable), (c) move the fewest players. Deterministic scorer — same input, same output.
4. Ledger check: NEVER re-ping the same player about the same match; max 1 ping per player per
   day; quiet hours (no sends 21:30–08:30, queue for morning).
5. Pilot mode: proposal + drafted message → approval queue (dashboard + notification to Krish).
   Auto mode: send via Playtomic channel, log to ledger.
6. Every send, skip, failure, and pull error → append-only ledger + dashboard. Pull failures
   or schema drift → alert Krish, never fail silent.

## Architecture

```
matchmaker/                   ← top-level, standalone — NOT part of jarvis/
  daemon.js                   ← poll loop + scorer + sender (deterministic only)
  rules.json                  ← ±30 / strict-fit / caps / quiet hours / poll interval
  ledger.jsonl                ← append-only: every proposal, ping, approval, skip, error
  .env                        ← Playtomic credentials — KRISH pastes these himself, never Claude
  public/                     ← its own dashboard (own port, e.g. localhost:4880): live
                                proposals, approval queue (pilot), sent log, AUTO/PILOT
                                toggle, kill switch
  launchd plist               ← auto-start on boot, restart on crash, survives reboots
```

- Auth: daemon holds its own token via login/refresh against the Playtomic API (NOT the Chrome
  tab — a daemon can't ride a browser session). Credentials in `.env`, filled by Krish.
- Binds 127.0.0.1 only. No dependency on the jarvis server in either direction.
- Unofficial API caveat applies: endpoints can change without notice. The daemon must detect
  schema drift (missing fields → alert + pause, never guess).

## DISCOVERY — findings (10 Aug 2026, read-only in the live manager tab)

**tenant_id (Encourt):** `<TENANT_ID>`

### The one call that powers the whole detector
`GET /api/v1/matches` (bearer-gated) with these params returns EVERYTHING needed in a single
authorized request per poll — no per-player follow-up calls:
```
disable_price_calculation=true
tenant_id=<tid>
is_playtomic_managed=true
has_players=true
from_start_date=<localdate-1>T23:00      to_start_date=<date>T22:59:59.999   (UTC, BST +1h)
match_status=PENDING                      ← PENDING = open / not-yet-full matches (the target)
competition_mode=&page=0&size=25&sort=start_date,asc
```
Each match object carries: `match_id`, `start_date`/`end_date`, `min_level`/`max_level` (the
range, e.g. 2.33–3.33), `min_players_per_team`/`max_players_per_team`, `resource_name`+`court_id`,
`owner_id`, `status`/`game_status`, and `teams[].players[]` where **each player** has
`user_id`, `name`, `email`, `phone`, `level_value`, `level_confidence`, `preferred_position`,
`is_premium`. Fill count = sum of `players` across teams vs `max_players_per_team × teams`.

| # | Question | Finding |
|---|---|---|
| D1 | Club→player message channel? | **CONFIRMED — and it's FIREBASE** (corrects an earlier note that said "native, no Firebase"). Per-match **Chat** thread (Edit match → Chat tab). Messages flow through **Firebase Realtime Database**, project `fir-playtomic`, `https://fir-playtomic.firebaseio.com` (that's why no `/api` call fires on send). Send path is multi-step (see Auth + Send below): Playtomic bearer → `POST /api/v1/chats/tokens` mints a Firebase **custom token** → exchange for a Firebase ID token → write the message to the match's RTDB thread. `sendThreadMessage` in `chats-*.js` keys by `match_id`. Exact RTDB message path = the one remaining unknown (confirm empirically when logged in, read-only). |
| D2 | Level ranges + per-player levels? | **CONFIRMED.** `min_level`/`max_level` on the match = the range; `level_value` per player in the same payload. Strict-fit = `match.min_level ≤ player.level_value ≤ match.max_level`. No extra call needed. (Standalone per-user level also exists at `GET /api/v1/levels?user_id=<id>&sport_id=PADEL` if ever needed.) |
| D4 | Who created vs joined? | **CONFIRMED.** `owner_id` on the match = creator; other players in `teams[].players[]` joined. Lets templates address the right person. |
| D3 | 24/7 login/refresh flow? | **RESOLVED (endpoints found 10 Aug).** API base `REACT_APP_API_URL="/api"` (same-origin on manager.playtomic.io). Auth module (`auth-*.js`) builds `${base}/login` and `${base}/refresh`; login body fields = `email`, `password` (+ `tenant_id`, `client_id`); tokens are tenant-scoped (`accessTokens.tenant[<tid>]`). Exact base version (candidates `/api/v3/auth`, `/api/auth`) to be confirmed by the auth prober trying each and reporting which 200s. Bearer confirmed working (raw call 401s without, 200s with). |

### Auth + Send flow (ground truth, 10 Aug 2026)

**Auth (headless, primary):** `POST {base}/login` `{email,password}` → `{access_token, refresh_token,
access_token_expiration,…}` (tenant-scoped). Refresh via `POST {base}/refresh` `{refresh_token}`.
`base` from `/api` + auth version — prober confirms exact path. Creds from `matchmaker/.env`.

**Read matches:** `GET /api/v1/matches?…&match_status=PENDING` with `Authorization: Bearer <access>`.

**Send a chat message (Firebase, multi-step):**
1. `POST /api/v1/chats/tokens` (bearer) → Firebase **custom token**.
2. `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=<FIREBASE_CHAT_API_KEY>`
   `{token, returnSecureToken:true}` → Firebase **ID token**.
3. Write message to the match thread in RTDB `https://fir-playtomic.firebaseio.com/…/<match_id>/…`
   (REST `PUT`/`POST …/path.json?auth=<idToken>` or SDK). **Exact RTDB path = open item** —
   confirm read-only from the logged-in browser's Firebase traffic before wiring the writer.

**Firebase chat config (PUBLIC web identifiers, safe to record):**
`project_id=fir-playtomic` · `database_url=https://fir-playtomic.firebaseio.com` ·
`api_key=<FIREBASE_WEB_API_KEY>` · `auth_domain=fir-playtomic.firebaseapp.com` ·
`app_id=<FIREBASE_APP_ID>` · `sender_id=<FIREBASE_SENDER_ID>`.

## AUTH DECISION (LOCKED, Krish 10 Aug 2026): headless login → fallback refresh token

The daemon gets its own bearer token around the clock:
1. **Primary — headless API login.** Daemon logs into the Playtomic API with Encourt's
   email+password from `matchmaker/.env` (Krish pastes once, Claude never sees them), stores the
   access+refresh tokens, auto-refreshes before expiry.
2. **Fallback — captured refresh token.** IF Playtomic gates non-browser login (captcha/2FA),
   Krish logs in once in the browser, we capture the long-lived refresh token into `.env`, daemon
   refreshes access tokens off it. If the refresh token later rotates/expires → daemon pauses and
   alerts Krish to re-capture.

Build step 1 of the daemon = probe whether headless login works; report which path is live.
Credentials ALWAYS in `.env`, filled by Krish — never handled by Claude, never committed
(`matchmaker/.env` in .gitignore).

## Message templates — WARM CLUB VOICE (locked default, Krish 10 Aug 2026)

Posts into the under-filled match's **shared chat thread**. `{curly}` fields auto-filled from the
one `/api/v1/matches` call. Krish may reword during the pilot.

- **Standard** (2+ already in the short match, thread-addressed):
  > Hi 👋 Encourt here. Your {start_time} game still needs {needed} to go ahead. There's a
  > {min}–{max} game at {alt_time} today that just needs {alt_needed} more — hop over and you'll
  > all get a proper game 🎾 Happy to switch you across? Reply here and we'll sort it.

- **Solo** (only 1 player in the short match, name them):
  > Hi {name} 👋 Encourt here. Your {start_time} game hasn't filled — but there's a {min}–{max}
  > game at {alt_time} with {alt_filled} already in, so you'd make up the group 🎾 Want me to
  > switch you over? Just reply here.

Fields: `{start_time}`/`{alt_time}` = match start_date → local time (BST); `{needed}`/`{alt_needed}`
= open spots; `{min}`–`{max}` = target match level range; `{alt_filled}` = players already in
target; `{name}` = player name. Always names a concrete alternative, quiet-hours-gated,
one ping per player per match (ledger), never pressures.

## Build plan

1. ~~Spec~~ (this file) ✅
2. ~~Discovery~~ (D1–D4, read-only) ✅ 10 Aug — all endpoints confirmed, schema verified live.
3. ~~Scorer + golden tests~~ ✅ 10 Aug — `matchmaker/lib/scorer.js` (deterministic merge finder),
   `matchmaker/lib/messages.js` (warm-voice renderer), 13 passing tests incl. the originating scenario +
   edge cases (level-fit, ±30 boundary, full/empty, court-freeing, no-double-book). `npm test`.
4. ~~Playtomic client + auth prober~~ ✅ 10 Aug. `lib/playtomic.js` (login/refresh/getAccessToken/
   authedFetch/fetchOpenMatches/validateMatchesPayload), `probe-auth.js`, `verify-live.js`.
   **HEADLESS MANAGER LOGIN SOLVED**: POST `/api/v3/auth/login`
   `{requested_user_scopes:[{role:'ROLE_TENANT_MANAGER',scope_id:<tenant>}],
   token_generation_mode:'USER_PERMISSION',email,password}` → manager token, all matches + PII.
   Refresh endpoints reject the token → daemon re-logins on expiry (cheap). Live-verified against real open matches, PII ok, scorer 0 false-positive merges. Writer stays disabled.
5. ~~Daemon + ledger + rules.json~~ ✅ 10 Aug. `daemon.js` + `lib/daemon.js` + `lib/ledger.js` +
   `rules.json`. tick() = fetchOpenMatches(today+tomorrow)→findMerges(±30/strict)→dedup ledger
   (deterministic proposalId, 6h cooldown, 1/player/day cap)→queue to `queue.json`. Fail-closed:
   AUTH_DEAD latch, KILL file, PILOT default, quiet hours (DST-aware), drift/scope alerts,
   single-instance lock, heartbeat, graceful shutdown. 15 tests; live `--once` proven. NO sends.
6. **Firebase WRITER** — the 3-step send (chats/tokens → signInWithCustomToken → RTDB write). GATED
   on the writer read-only confirmations (onCreate-vs-onWrite, threadId source, message shape) +
   all writer must-fixes. Built only when those land.
7. ~~Dashboard~~ ✅ 10 Aug (own port 4880, standalone). `server.js` + `public/index.html`: mode
   pill, daemon health, approval queue with drafted messages, PILOT↔AUTO toggle, persisted KILL
   switch, Approve/Dismiss (live from ledger). launch.json "matchmaker" config. Verified in browser.
   Still needed: **launchd plist** for 24/7 autostart.
8. **Pilot week** (Krish approves every send) → **sign-off** → AUTO.

Each phase ends with a facts.md entry. Nothing sends until pilot mode is live and Krish approves.

## Hardening requirements (from the 10-Aug design + red-team workflow — 22 findings, 17 must-fix)

### AUTH / READ client — bake in NOW (`lib/playtomic.js`, `probe-auth.js`)
- **AUTH_DEAD is a persisted latch.** Write it to `state.json`; on boot if set, DO NOT try
  login/refresh — stay paused, re-alert only. Cap lifetime login failures (≤3) before latching.
  `401 invalid_credentials` is terminal — never retry/backoff (else a wrong password → launchd
  crash-loop → login storm → account captcha-lock, which also kills the fallback path).
- **Expiry math fails CLOSED.** If `access_token_expiration` is missing/NaN/unparseable → treat
  token as already expired (force refresh/login), never as valid-forever. Validate parsed instant
  is finite AND plausibly future before caching.
- **Validate response CONTENT, not just HTTP 200.** Require `Content-Type: application/json` +
  `access_token` + expiration present before treating any login/refresh 200 as success or caching
  its URL. A same-origin proxy can 200 an HTML interstitial → `Bearer undefined`.
- **Single-instance lock.** O_EXCL pidfile / flock at startup; if held, exit immediately. The
  ledger + token files are only safe under one process. launchd overlap + manual runs are routine.
- **No mutex self-deadlock.** Auth (login/refresh) fetches are EXEMPT from the one-in-flight
  request mutex (else the 401-retry deadlocks). Mutex acquire has a timeout that throws.
- **Refresh precedence:** `.tokens.json` refresh_token wins whenever present; `.env`
  `PLAYTOMIC_REFRESH_TOKEN` is a one-time seed only, used when `.tokens.json` has none.
- **Runtime scope-downgrade alarm.** When a poll returns matches, require the PII fields the
  pipeline needs (email/phone); their absence = `SCOPE_DOWNGRADE` alert (distinct from empty).
  Persistent-zero against a historically-active tenant also alerts (don't call it "healthy").
- **Single-flight refresh** (module promise, cleared in finally) + persist rotated refresh_token
  atomically BEFORE next request. **401 → one refresh+retry; second 401 → AUTH_DEAD.**
- **Schema-drift guard** (`validateMatchesPayload`): envelope-key check distinguishes drift from
  legitimately-empty; per-match skip for one bad record; >25% bad or envelope-changed →
  SCHEMA_DRIFT, snapshot raw to `logs/` (chmod 600, PII), PAUSE, send nothing.
- **Read traps** (from [[playtomic-live-pull]]): query window ≤3 days (endpoint silently truncates
  wide windows); page to exhaustion (don't trust size=25 / server sort); match people by
  `user_id` NEVER name; times UTC→BST +1h. Naive-UTC expiry: append `Z` only if no tz suffix.
- **Resilience:** AbortController timeout (~20s) every fetch; full-jitter backoff on 429/5xx
  honoring Retry-After; heartbeat watchdog (no good cycle in ~3× poll interval → PAUSED alert).
  Atomic token/ledger writes (tmp+fsync+rename, chmod 600); ledger parse-fail → fail-closed.

### WRITER gate — the send path stays DISABLED until ALL of these are met (mostly the CRITICALs)
- **onCreate vs onWrite (CRITICAL):** before enabling sends, capture read-only proof that a
  re-PUT of an identical node does NOT re-fire the push/unread fan-out. If it's onWrite,
  PUT-overwrite is NOT idempotent → retry policy must be read-thread-first-skip-if-present.
- **Per-send thread read-back (CRITICAL):** every send first GETs the target thread, asserts it
  exists + contains the intended `user_id` + links the intended `match_id`; abort+alert on
  mismatch. Never trust `threadId == match_id`; resolve + pin the derivation from a captured send.
- **Kill switch persisted + checked late (CRITICAL):** disk-backed (`KILL` file / state field);
  checked at startup (fail-closed) AND immediately before the PUT, after every await; honor
  SIGTERM. A kill stops the very next write, not the next cycle.
- **PILOT vs AUTO fails CLOSED (CRITICAL):** absent/corrupt/unknown mode → PILOT (queue), never
  AUTO. AUTO requires an explicit well-formed Krish-set flag. Unit-test corrupt state → PILOT.
- **Quiet hours** (club-local, DST-aware) checked immediately before send; qualifying messages
  HELD not dropped, released when the window opens.
- **Idempotent stable id:** `stableMessageId` = pure hash of `(match_id + user_id + proposal
  version)`, no time/random. Write-ahead the ledger ('pending' before write → confirmed/unconfirmed
  after). Restart reconciles from the pending entry, never re-decides.
- **Custom-token identity check:** validate the Firebase custom token is a non-empty JWT AND its
  `uid` == the club `user_id` before use.
- **Path-segment validation:** strict format check on threadId/messageId (no `/` `.` control
  chars), URL-encode segments — an unofficial API could drift a slash into the path.
- **Multi-node writes atomic:** if the app must write >1 RTDB node (not just `/messages`), use one
  multi-location PATCH, never sequential PUTs. Confirm one-vs-many read-only first.
- **Ambiguity policy:** a 4xx (server rejected, nothing written) = safe to retry once after ID-token
  refresh; a timeout/5xx = genuinely ambiguous → mark ledger 'unconfirmed', never blind-retry.
- **Reissued-match dedup:** secondary key `(sorted player-uid-set + start_date + court)` so a
  cancelled/recreated match (new match_id) doesn't reset ping history within a cooldown.

### Confirmed send mechanics (for when the writer is built)
1. `POST /api/v1/chats/tokens` (bearer) → Firebase custom token.
2. `POST identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=<FIREBASE_CHAT_API_KEY>`
   `{token, returnSecureToken:true}` → Firebase ID token (1h). Keep alive via
   `securetoken.googleapis.com/v1/token` (grant_type=refresh_token, form-encoded).
3. RTDB write, `?auth=<idToken>` in the query. Playtomic RTDB is denormalized across
   `/messages /threads /user-threads /users /devices` (per ex-Playtomic engineer's public writeup);
   likely write only `/messages/{threadId}/{stableId}` and let Cloud Functions fan out — CONFIRM.

Linked: [[playtomic-live-pull]]
