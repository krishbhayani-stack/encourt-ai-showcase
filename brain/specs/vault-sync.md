# Spec — vault-sync (session close-out)

Written 2026-07-30, before re-automating (constitution rule 1). Replaces the retired 30-minute
sweeper (`_archive/obsidian-vault-sync-retired/`), which died silently when its cron stopped —
root cause of the 14–30 Jul vault freeze found in the 30 Jul diagnostic.

## Ground truth

- The Obsidian vault root is the repo root; `strategy/` is Krish's curated strategy cockpit inside it.
- `brain/facts.md` is the primary memory (append-only, dated). The vault is a *distillation* of it,
  not a transcript. If facts.md and a strategy note disagree, facts.md wins; fix the note.
- Sync direction is one-way for machine writes: facts → vault. Krish writes anywhere, anytime;
  never delete or rewrite his content — append and merge around it.

## When it runs

At the END of any working session that changed `brain/facts.md`, produced a brief, or recorded a
Krish decision — not on a timer. A timer dies silently; a close-out step is part of the work itself.
No-op (no edits, no commit) if nothing strategy-relevant changed.

## What syncs where

| New in the session | Lands in |
|---|---|
| Krish decision (pricing, offers, programmes, structure) | `strategy/Decisions Log.md` — one dated line + the why |
| Verified numbers / analysis findings | The topical note: `Business Data — Playtomic`, `Business Data — Pilates (BSport)`, `Pricing & Membership`, `Retention & Member Experience`, `Growth & Acquisition`, `Financials & Margins`, `Competitive Landscape`, `Metrics that Matter` |
| Open decision Krish hasn't made yet | `strategy/Open Questions.md` |
| Priorities / deadlines changed | `strategy/Daily Focus.md` — rewrite the Today block (≤15 lines), demote the old one to Previous |
| New md brief written | Footer link `Linked: [[<home note>]]` on the brief (constitution rule 11) |

## Rules

0. Sweep `reports/raw/hermes/` first (the Hermes agent's only write path — CLAUDE.md rule 14):
   fold anything durable into facts.md (dated, append-only), then treat it like any other raw input.
1. Distill, don't transcribe: one to three lines per finding, link to the brief/facts entry for depth.
2. Every touched note keeps at least one `[[wikilink]]` to a related note — no orphans.
3. Never edit past Decisions Log entries; append only (same discipline as facts.md).
4. Finish with one git commit of everything the session changed (this is also the backup step;
   `metrics.md` "write-back discipline" row scores it).
5. Reference datasets (`customers_2242.csv`, `payments_24may-22aug.csv`, `bookings_24may-4jul.csv`,
   intro-history/subscription/conversion CSVs) are exempt from the dated-snapshot naming rule —
   they are stable inputs cited by specs and briefs, not snapshots. Do not rename them.

---
Linked: [[Strategy Home]]
