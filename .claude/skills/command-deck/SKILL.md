---
name: command-deck
description: Renders the Encourt command deck — KPI tiles from the newest facts.md numbers, a command input, and every skill click-to-run. Runs at the START of every session (constitution rule 13), after any number-changing run, and when Krish says "open the dashboard", "show the deck", or clicks "Refresh live numbers".
---

# Command Deck

Ground truth: `brain/specs/command-deck.md` — read it first; it holds Krish's rules (no
timers, on-demand refresh), the zone structure, and the per-tile data sources.

## Steps

1. **Gather numbers (no live pull)**: tail of `brain/facts.md` for the newest member counts,
   Pilates read, and anything red-flagged; `brain/targets-and-kpis.md` for the current month's
   occupancy ramp column and milestone row.
2. **Fill the template**: `.claude/skills/command-deck/template.html` — replace every
   `{{TOKEN}}` (date line, tile labels/values/sub-lines/styles, occupancy drill-down prompt).
   Colour rules and staleness labelling per the spec.
3. **Render** via `mcp__visualize__show_widget`, title exactly `encourt_command_deck`
   (stable identity), suitable loading messages.
4. **Live refresh only when asked** (button click or explicit ask): light Playtomic Benefits
   pull per the `playtomic-live-pull` spec (+ BSport if its snapshot >2 days old), then
   re-render with new values and today's snapshot date. If the manager session is logged out,
   render anyway with the stale date amber-flagged and tell Krish to log in — never block the
   deck on auth, never invent numbers.

## Console zone

`{{CONSOLE_LINES}}` is the deck's reply surface: `<p style="margin:0;">▸ …</p>` lines, mono,
max ~8. In the pinned deck session every reply goes here — re-render the deck with the answer
in the console and keep chat text to a one-line echo. Colours: `#8fd7ec` default, `#3ef5a8`
good, `#f5c038` warning/stale, `#f56a6a` red flag.

## Voice

After rendering in the deck session, speak a 1-2 sentence headline:
`bash scripts/speak.sh "<headline>"` (offline mac voice; ElevenLabs auto-upgrade via env
vars). Session open = short greeting + status. Headline only — never read the whole log.

## Rules

- Session-start render is snapshot-only and fast — no browser, no pulls.
- Nothing gets scheduled from the deck. Ever. (Krish, 31 Jul 2026.)
- A skills change in `.claude/skills/` means the template grid needs updating — flag it.
