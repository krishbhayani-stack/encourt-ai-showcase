# CLAUDE.md — The Constitution (Operating Rules)

Single source of truth for how AI works in this project. If a rule here conflicts with anything else, this file wins.

## Operating rules

1. **Specs before automation.** Nothing gets automated until its ground truth is written in `brain/specs/`.
2. **Facts are append-only.** New entries go to the bottom of `brain/facts.md`, dated. Never edit or delete old entries.
3. **Scripts are deterministic only.** `scripts/` holds utilities with no AI judgment — same input, same output.
4. **Skills are the default building block.** Prefer a skill in `.claude/skills/` over a new agent.
5. **One generalist agent.** `strategy-analyst` is the only agent. Resist adding more.
6. **Data is snapshotted, not live.** Playtomic exports land as dated CSVs in `data/playtomic/`. Analysis reads snapshots.
7. **Reports flow one way.** Raw inputs → `reports/raw/`, AI-generated briefs → `reports/briefs/`.
8. **Kill ruthlessly.** Anything unused goes to `_archive/` (the 11 → 3 → 0 graveyard). Nothing is deleted, but nothing dead stays in the working tree.
9. **Values live in `brain/constitution.md`**, thresholds in `brain/targets-and-kpis.md`. Check both before making recommendations.
10. **Score the system.** `brain/metrics.md` tracks whether this setup is actually working.
11. **Everything links into the vault.** Every markdown brief and spec ends with a
    `Linked: [[<strategy note>]]` footer pointing at its home note in `strategy/`, and every
    strategy note carries at least one `[[wikilink]]` — no orphan islands in the Obsidian graph.
    (PDFs can't join the graph; their md sibling or facts entry carries the link.)
12. **Sessions end synced and committed.** Any session that changes `brain/facts.md`, writes a
    brief, or records a decision ends by running the `vault-sync` skill: fold facts into
    `strategy/`, refresh Daily Focus, `git commit`. The vault must never trail facts.md again.
13. **Sessions open with the command deck.** Every session starts by rendering the Encourt
    command deck (`command-deck` skill): KPI tiles from the newest numbers already in
    `brain/facts.md` (snapshot-only — no live pull at open), every skill click-to-run, and a
    command input. Re-render it after any run that changes numbers. Krish's standing rule:
    **nothing runs on a timer** — never create a scheduled task without a fresh explicit ask.
14. **Hermes is a reader, not an author** (Krish decision, 22 Aug 2026 — deliberate exception
    to the spirit of rule 5). The Hermes agent (NousResearch, installed in `~/.hermes/`) may
    READ the whole repo and answer from it; its ONLY write path is `reports/raw/hermes/`
    (raw-in, per rule 7), folded into facts.md at vault-sync. It holds no Playtomic/BSport/
    Xero credentials, does no live pulls, and never runs vault-sync, commits, or timers.
    Its standing orders + boot sequence live in `HERMES.md` (which defers to this file);
    spec: `brain/specs/hermes-agent.md`.

## Directory map

```
encourt-ai/
├─ CLAUDE.md              ← this file: operating rules
├─ HERMES.md              ← standing orders for the Hermes agent (reader, not author — rule 14)
├─ brain/                 ← the memory
│  ├─ constitution.md     ← canonical values
│  ├─ targets-and-kpis.md ← flag thresholds (Y1 Budget control panel)
│  ├─ specs/              ← ground truth, written before automation
│  ├─ facts.md            ← dated log, append-only
│  ├─ glossary.md         ← names, products, shorthand
│  ├─ data-sources.md     ← where every number comes from
│  └─ metrics.md          ← the system's scorecard
├─ strategy/              ← Obsidian vault
├─ .claude/
│  ├─ agents/             ← one generalist: strategy-analyst
│  └─ skills/             ← the default building block
├─ scripts/               ← deterministic utilities only
├─ jarvis/                ← the localhost command deck app (spec: brain/specs/jarvis-app.md)
├─ data/                  ← dated snapshots: playtomic/ bsport/ budget/ sessions/ forecast/
├─ reports/               ← raw in / AI briefs out
└─ _archive/              ← the 11 → 3 → 0 graveyard
```
