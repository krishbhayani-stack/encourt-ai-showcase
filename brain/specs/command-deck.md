# Spec — Command Deck (session dashboard)

Ground truth for the `command-deck` skill. Written 2026-07-31 after Krish approved the deck
and set the operating rules below. The deck is the visual front door to the whole system:
KPI tiles, a command input, and every skill click-to-run.

## Krish's rules (decided 31 Jul 2026)

1. **Nothing runs on a timer.** Krish explicitly rejected scheduled runs (the pre-existing
   `nightly-purep2p-desk-sheet` scheduled task was disabled, not deleted). Skills run when he
   clicks them on the deck or asks. Never create a scheduled task without a fresh explicit ask.
2. **The deck opens every session.** Constitution rule 13. Render from the newest numbers
   already in `brain/facts.md` — a session-start render does NOT do a live pull.
3. **Refresh is on demand.** The deck's "Refresh live numbers" button (or any ask for fresh
   numbers) triggers a LIGHT pull: Playtomic Benefits member counts via the `playtomic-live-pull`
   spec; BSport only if its newest snapshot is >2 days old. Then re-render. A tile refresh needs
   no brief; append to facts.md only if a materially new fact emerged.
4. **Re-render after number-changing runs.** Any skill run or pull that changes numbers ends
   with a fresh deck render (alongside the vault-sync close-out).
5. **Replies live IN the deck (31 Jul).** In the pinned deck session, every reply re-renders
   the deck with the answer written into the CONSOLE zone as `▸` ops-log lines (mono, ≤8 lines,
   newest render wins). Chat text outside the deck stays to a one-line echo. Krish does not
   want to see code or long chat prose in that session — the dashboard IS the interface.
6. **The deck speaks (31 Jul, from the @dhaibuilds guides).** Voice output via
   `scripts/speak.sh` (macOS `say`, Daniel en_GB, rate 172 — offline and free; auto-upgrades
   to ElevenLabs when ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID env vars exist). In the deck
   session: speak a 1-2 sentence headline of each reply after rendering, and a short greeting
   when a session opens. Keep spoken lines shorter than console lines — headline, not the log.
   Voice INPUT is Krish-side (mac dictation / local whisper into the command bar) — never
   cloud STT. The guides' other builds were mapped 31 Jul: memory/search/files/computer-
   control already exist here in stronger form (facts.md entry) — do not rebuild them.

## Structure (the pinned template)

Template: `.claude/skills/command-deck/template.html` — rendered via the
`mcp__visualize__show_widget` tool, title `encourt_command_deck` (keep the title stable; it is
the deck's identity). `{{TOKEN}}` slots are filled by the skill; everything else is pinned.

**Theme (Krish, 31 Jul): Jarvis-dark HUD.** Self-contained dark panel (`#070e1a`, cyan
`#38d4f5` accents, mono uppercase HUD labels, subtle glow borders, pulsing live dot) — it
deliberately does NOT blend into the host app's light theme. Green `#3ef5a8` = good, amber
`#f5c038` = stale/behind. Keep this look; a plain white deck reads as broken to Krish.

| Zone | Content | Behaviour |
|---|---|---|
| Header | Title + date line ({{DATE_LINE}}) + "Refresh live numbers" button | Button → sendPrompt(light-refresh instruction) |
| Command bar | Text input + Send | Enter/click → sendPrompt(typed text) |
| Quick chips | This week vs budget · New lapses · Tomorrow's P2P sheet · Failed payments · Sync vault | Each → sendPrompt |
| KPI tiles | North star (static <north star>/mo net) · Members ({{MEMBERS_*}}) · Pilates ({{PILATES_*}}) · Occupancy line ({{OCC_*}}) | Click a tile → sendPrompt drill-down |
| Skills grid | All skills in `.claude/skills/` (11 at time of writing), name + one-liner + cadence badge | Click a card → sendPrompt("Run the <skill> skill") |

Tile sub-line colours: green `#0ca30c` when ahead of milestone, amber `#BA7517` when stale or
behind, default `var(--text-secondary)` otherwise. Snapshot dates always shown on tiles; a
snapshot older than ~2 weeks is labelled stale.

## Data sources per tile

- **North star**: `brain/targets-and-kpis.md` §North star (static unless the budget changes).
- **Members**: newest census/benefits counts in facts.md (tier order Access · Off-Peak ·
  Platinum), vs the CURRENT month's milestone row.
- **Pilates**: newest teamup-pilates-pull facts entry (BSport until 23 Sep 2026) (live recurring £/mo, live subs, class
  fill, failed payments).
- **Occupancy line**: the CURRENT month's column of the ramp table in targets-and-kpis.md
  (peak · off-peak). The drill-down prompt embeds the current month's targets.

## Maintenance

- New/removed skill in `.claude/skills/` → update the template's skills grid + the count.
- Template changes are code changes: commit them.
- The deck never invents numbers: every tile value must trace to facts.md or
  targets-and-kpis.md. If a source is unreachable, show the stale date and say so.

---
Linked: [[command-deck]]
