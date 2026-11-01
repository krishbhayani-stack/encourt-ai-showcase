# Spec — Jarvis App (localhost command deck)

Ground truth for the standalone voice dashboard in `jarvis/`. Commissioned by Krish 31 Jul 2026
("no more widget and chat — the real thing"), built from the @dhaibuilds guides' architecture but
wired to OUR brain instead of Groq. Supersedes the in-chat widget deck (spec: command-deck.md —
its zone structure, tile data sources, and Krish rules still apply to the app's UI).

## Architecture

```
Krish speaks/types ──▶ localhost:4870 (jarvis/server.js, Express)
                          │  POST /api/chat ──▶ Claude Agent SDK query()
                          │       cwd = V2 encourt-ai  → CLAUDE.md + all skills load
                          │       auth = existing Claude Code login (no API key)
                          │       streams SSE back to the page
                          │  POST /api/tts ──▶ ElevenLabs (if .env keys) else macOS `say`
                          │  GET  /api/deck ──▶ deck-state.json + live skills list + briefs
                          └─ public/ = Jarvis HUD (dark cyan theme from command-deck spec)
```

- **The brain is Claude Code itself** — the SDK spawns real sessions in this repo, so every
  skill, the constitution, facts.md, and browser plumbing rules apply. Never bolt on a second
  model (Groq etc.) — that was the guide's approach, rejected 31 Jul (facts.md).
- **Session continuity**: server captures `session_id` from the SDK init message, persists it
  to `jarvis/.session`, passes `resume` on later chats. "New session" endpoint clears it.
- **Permissions**: `permissionMode: "bypassPermissions"` — the app runs on Krish's own machine
  with his own repo; he asked for full autonomy. Noted risk: chat commands can run Bash.

## API contract (server.js ↔ public/)

| Endpoint | In | Out |
|---|---|---|
| GET `/api/health` | — | `{ok, uptime}` |
| GET `/api/deck` | — | `{date, tiles, skills:[{name,desc,cadence}], briefs:[{file,mtime}]}` — tiles from `jarvis/deck-state.json`; skills scanned from `.claude/skills/*/SKILL.md` descriptions; briefs = newest 8 in `reports/briefs/` |
| POST `/api/chat` | `{message}` | SSE: `{type:'session',id}` `{type:'text',text}` `{type:'tool',name}` `{type:'done'}` `{type:'error',error}` |
| POST `/api/chat/new` | — | clears `.session` |
| POST `/api/tts` | `{text}` | ElevenLabs mp3 (`audio/mpeg`) when `ELEVENLABS_API_KEY`+`ELEVENLABS_VOICE_ID` set in `jarvis/.env`; else speaks via `say -v Daniel -r 172` server-side and returns `{local:true}` |
| GET `/api/briefs/:file` | — | serves the brief (basename-sanitized, briefs dir only) |

`jarvis/deck-state.json` holds the tile values + snapshot dates. Any Claude session that
changes club numbers updates this file as part of the deck re-render convention (command-deck
spec rule 4 now means: update deck-state.json).

## Voice

- **Output**: ElevenLabs when Krish adds his key to `jarvis/.env` (he creates the account
  himself — we never handle his signup); offline mac `say` until then. Speak the reply
  (capped ~2 sentences / 400 chars) after it lands; boot greeting on page load.
- **Input**: Web Speech API, always-on continuous recognition with auto-restart, mute button
  with visual state, ambient pulse while listening (the guide's design — Krish chose it
  knowingly; Chrome's Web Speech STT is cloud-side, unlike our earlier local-whisper stance).

## Run

`cd jarvis && npm install && npm start` → http://127.0.0.1:4870. Dev entry also in
`.claude/launch.json` (name: jarvis). Server binds 127.0.0.1 only — never expose the port;
/api/chat has unauthenticated repo-level power.

## Working view (v6, 31 Jul — Krish: "completely take over the full screen")

- While the ACTIVE task runs, a full-screen overlay takes over: big current-step headline,
  full-height step timeline (left rail), and the live log/streaming reply (right pane). The task
  tabs and command bar are REPARENTED into the overlay so voice/typing keep working full-screen;
  they move back to the deck when the task ends. (The overlay lives OUTSIDE .deck in the DOM —
  the deck's clip-path would clip a position:fixed child.)
- "▁ deck" minimizes (task keeps running; floating bottom-right pill shows elapsed + current step,
  click to re-expand). A new command always un-minimizes. "■ stop" interrupts the task.
- Spoken narration cadence: first step immediately, then ≤1 line per 9s, "still working" nudge
  at 18s quiet. Only the active task narrates; TTS queue backlog suppresses narration.
- Contextual surfacing: queries mentioning skills / revenue-KPI-members-etc / briefs flag the
  matching deck panel, which scrolls into view and flash-glows when the deck returns. A short
  pure "show/open/pull up …" command (≤6 words) is answered instantly on-device — panel flash +
  one spoken line, NO Claude session spawned.

## Deliverables & rich text (v7, 3 Aug — Krish: "same as a Claude Code session")

- The on-screen brief renders as safe rich text (line-based renderer, DOM nodes only, zero
  innerHTML): ## headings, ▹ bullets, numbered rows, **bold**, `code`, and bare repo-relative
  file paths become clickable links served via GET /api/file?p= (Content-Type by extension,
  403 outside PROJECT_ROOT — prefix-checked after resolve).
- Reply protocol gains a fourth sentinel: brief → ===SPEAK=== → ===NEXT=== → ===FILES===
  ("- <repo-relative-path> — <description>" per deliverable). FILES lines render as artifact
  cards ("deliverables" row): extension glyph, basename, description, OPEN (browser via
  /api/file) + FINDER (POST /api/reveal → `open -R`, same sanitization) buttons.
- Persona mentions deliverables in the spoken bullets ("The PDF is on your screen now, sir").

## HUD skin (v8, 22 Aug — Krish: "build my launch command deck the exact same way" as the
@joshdwhitehouse TikTok JARVIS)

Frontend-only rebuild of `public/index.html` to the film-HUD layout; the JS engine and every
API above are unchanged. Layout is a fixed full-viewport HUD, no page scroll:

- **Header**: arc icon + spaced `J.A.R.V.I.S` wordmark + subtitle left; right column of
  readouts — LOCAL (live ticking clock), PRESENCE `DECK`, STATUS `SYSTEMS ONLINE` — then the
  deck statusLine as a small right-aligned briefing paragraph, then the vault line.
- **Left rail — COMM LOG**: the conversation. User bubbles amber with a `KRISH` label,
  replies teal-bordered with a `J.A.R.V.I.S` label; task tabs sit above the log (scroll-capped).
- **Center stage**: layered CSS arc-reactor (tick ring / conic segments / dashed ring / radial
  36-bar voice burst / glowing core — burst + core recolor by state), state stack
  (`J.A.R.V.I.S` / STANDBY · LISTENING · HEARING YOU · AWAKE · RESPONDING / hint line),
  ENGAGE↔DISENGAGE bordered button (= the old Mic toggle; **space bar also toggles** unless
  typing), pills (wake toggle, Voice, New session), command bar with the hear-bubble above it.
- **Right rail — WORKSHOP**: `WAITING ON YOU` = deck alerts as amber cards, first 4 shown,
  rest behind `+N MORE`; `READINGS` = KPI tiles as glass cards (thin 200-weight numbers,
  tone-coloured left border, click-to-run kept); `ON THE GLASS` = the 8 newest briefs docked
  as cards; `FULL BRIEF` in the panel head opens the newest brief.
- **Bottom strip**: all skills as compact click-to-run cards (horizontal scroll).
- **Working view**: same reparenting takeover, restyled as a glowing "ON THE GLASS" glass
  frame with corner brackets and a scanline.
- Viewfinder corner brackets frame the viewport; palette is mint-teal on near-black
  (`--hud #7ff0dd`); fonts Share Tech Mono / Orbitron (wordmark) / Inter 200 (big numbers).

## Film-HUD v9 (24 Aug — Krish: "full rebuild deepdive", ground-up rewrite)

Frontend rewritten from scratch against a 56-frame pixel spec of the reference video, with
a 6-agent recon fleet (video spec, GitHub + social landscape, HUD design language, voice
latency, business grounding) plus a Hermes advisory memo (`reports/raw/hermes/
2026-08-24-jarvis-rebuild-advice.md`) feeding the design. Landscape brief:
`reports/briefs/2026-08-24-jarvis-landscape-comparison.md`.

- **Palette/type now video-exact**: navy-black `#050B14`, mint `#7FF7D4` / bright teal
  `#35E0C2` blooms, amber `#F0B24E` cards + STATUS chip; JetBrains Mono chrome, Quicksand 300
  hero numerals. Rails start lower than the header (video layout); briefing paragraph
  top-right with mint-highlighted figures (new `briefing` field in deck-state.json,
  passed through /api/deck); PRESENCE reads `HERE`.
- **ON THE GLASS overlay** — the signature: a new optional `===GLASS===` sentinel
  (persona-specified, parsed client-side between brief and ===SPEAK===) carrying
  `key: value` lines (title/kicker/hero/unit/sub/footer, or `bars: A £1 | B £2`). Renders a
  centered etched-glass stat window (teal border + bloom, double frame, scanline fill,
  count-up hero), HUD dims to 13% behind, auto-docks into the WORKSHOP rail as a mini-tile
  when narration ends (reopenable; capped at 4). Reading tiles open the same overlay on
  click with a RUN DEEP DIVE button (`noDock`); replayed tasks dock silently.
- **Reactor v2**: 6 layers per the frame spec — bezel ticks + sparse long ticks, rotating
  conic segments, dashed ring, 44-bar spectrum fan (GPU-only: rotate/translate/scaleY with
  `transform-origin: 50% 100%`), gear-tooth iris, breathing core. All ring masks
  `circle closest-side`.
- **Voice engine upgrades** (from the latency research): server-side TTS disk cache
  (`jarvis/.tts-cache/`, sha1 of voice|model|text, ≤600 chars — acks serve in ~12ms after
  first render); per-bullet TTS enqueue (first bullet audible sooner); barge-in — space/
  ENGAGE or a new command kills current speech + queue via `stopSpeaking()` (task unaffected);
  mic reopens 220ms after audio ends; speech `network` errors back off exponentially
  (1s→4s→…→30s, reset on result); persona now asks for a ≤6-word first progress note.
- **On-device fastpaths** (zero model round-trip): `sitrep` speaks the statusLine + top
  alert; `new session` / `clear the deck` = the New-session button; show-me commands as v6.
- **Boot theatre**: ~1.3s staged power-on (ENCOURT SYSTEMS → J.A.R.V.I.S CORE →
  INITIALIZING), click-to-skip, then staggered panel rise.
- COMM LOG header gains the video's live pill + two-digit message counter; WAITING ON YOU
  cards get index chips and expand on hover; brief chips show the brief's first heading
  (server extracts `head` in newestBriefs()).
- deck-state.json refreshed to the day's numbers (tiles + waiting-on-you cards).

## Rules

- No timers, ever (Krish). All runs click/voice-initiated.
- The app never invents numbers: tiles come from deck-state.json, which traces to facts.md.
- Long skill runs stream progress via the tool events; the page must stay responsive.
- Facts, briefs, and vault-sync conventions are the SDK sessions' job, not the server's.

---
Linked: [[command-deck]]
