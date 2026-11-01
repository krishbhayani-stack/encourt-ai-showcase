# Encourt AI — an operating brain for a real sports club

A file-based "operating brain" I built and ran, July–November 2026, to help run
[Encourt Padel & Wellness](https://playtomic.com/clubs/encourt-padel-wellness) — a seven-court
padel club with a reformer Pilates studio, gym and spa in Hertfordshire, which I co-founded.

Everything here was in daily use: weekly revenue reviews against the Year One budget, a nightly
pay-to-play call sheet for the front desk, membership churn and refund monitoring, a voice-driven
command deck, and a 24/7 daemon that spots open padel matches that would fill if players shifted
by half an hour.

The design idea is simple: **the club's memory, rules and procedures live as plain files in a git
repo, and AI agents are only allowed to act through those files.** Claude Code is the author;
every procedure is written down as a spec before it is automated; every number traces to a dated
snapshot; every session ends committed.

> This is a **redacted public copy** of a private repository. Member data, revenue, budgets,
> credentials, the fact log, the strategy vault and 300+ generated briefs are deliberately absent.
> Identifiers are replaced with `<PLACEHOLDERS>` and people other than the founders appear by
> role only. See [What is not here](#what-is-not-here).

---

## By the numbers (private repo, 9 Jul → 1 Nov 2026)

| | |
|---|---|
| Commits | 400+ (one or more per working session, via the `vault-sync` close-out) |
| Skills (reusable AI procedures) | 14 |
| Ground-truth specs written before automation | 21 |
| Dated entries in the append-only fact log | 277 |
| AI-generated briefs and PDFs delivered to the business | 300+ |
| Documented traps in the Playtomic manager API | 37 (and counting) |
| Hand-written code (Node + Python) | ~6,500 lines, 70 passing tests in the daemon |

---

## Architecture

```
                 ┌──────────────────────────────────────────────────────────────┐
                 │  brain/            THE MEMORY (plain markdown, git-tracked)   │
                 │   constitution.md   values & hard rules the agents enforce    │
                 │   specs/            ground truth — written BEFORE automation  │
                 │   facts.md*         dated, append-only log (never edited)     │
                 │   targets-and-kpis* budget thresholds (the "control panel")   │
                 │   glossary / data-sources / metrics                           │
                 └───────────────▲──────────────────────────────▲───────────────┘
                                 │ reads                        │ reads + appends
┌──────────────────┐   ┌─────────┴──────────┐        ┌──────────┴──────────────┐
│  jarvis/         │   │  .claude/skills/   │        │  strategy/* (Obsidian)   │
│  localhost voice │──▶│  14 procedures the │───────▶│  curated vault, synced   │
│  command deck    │   │  agent follows     │        │  from facts at close-out │
│  (Agent SDK+SSE) │   └─────────┬──────────┘        └──────────────────────────┘
└──────────────────┘             │ calls
                       ┌─────────┴──────────┐        ┌──────────────────────────┐
                       │  scripts/          │        │  matchmaker/             │
                       │  deterministic only│        │  standalone 24/7 daemon  │
                       │  (no AI judgment)  │        │  no AI at runtime        │
                       └────────────────────┘        └──────────────────────────┘
                                                      * = present in the private repo only
```

Data flows one way: raw exports and live pulls land as dated snapshots → skills analyse them
against the constitution and KPI thresholds → briefs go out → durable facts are appended →
the vault is re-synced → the session commits.

---

## The operating rules

[`CLAUDE.md`](CLAUDE.md) is the constitution. If it conflicts with anything else, it wins. The
rules that shaped everything:

1. **Specs before automation.** Nothing is automated until its ground truth is in `brain/specs/`.
2. **Facts are append-only.** New entries go at the bottom, dated. Never edited, never deleted.
3. **Scripts are deterministic only.** Same input, same output. Judgment lives in skills.
4. **Skills are the default building block.** One generalist agent; resist adding more.
5. **Data is snapshotted, not live.** Analysis reads dated CSVs, never a live tab.
6. **Everything links into the vault.** No orphan notes in the Obsidian graph.
7. **Sessions end synced and committed.** The vault must never trail the fact log.
8. **Nothing runs on a timer** without a fresh explicit ask.
9. **Hermes is a reader, not an author.** A second open-source agent may read the whole brain
   but can write to exactly one folder.

---

## What to look at first

| If you want to see… | Open |
|---|---|
| How the whole system is governed | [`CLAUDE.md`](CLAUDE.md) · [`brain/constitution.md`](brain/constitution.md) |
| A reusable AI procedure, end to end | [`.claude/skills/purep2p-desk-sheet/SKILL.md`](.claude/skills/purep2p-desk-sheet/SKILL.md) → its spec [`brain/specs/pure-p2p-desk-sheet.md`](brain/specs/pure-p2p-desk-sheet.md) → the deterministic core [`scripts/purep2p_filter.py`](scripts/purep2p_filter.py) |
| Reverse-engineering an undocumented API, carefully | [`brain/specs/playtomic-live-pull.md`](brain/specs/playtomic-live-pull.md) — 37 numbered traps, each dated and never re-learned |
| Production-grade Node with fail-closed design | [`matchmaker/lib/playtomic.js`](matchmaker/lib/playtomic.js) · [`matchmaker/lib/daemon.js`](matchmaker/lib/daemon.js) · the red-team hardening list in [`brain/specs/open-match-consolidation.md`](brain/specs/open-match-consolidation.md) |
| A pure, deterministic algorithm with golden tests | [`matchmaker/lib/scorer.js`](matchmaker/lib/scorer.js) · [`matchmaker/test/fixtures/cases.js`](matchmaker/test/fixtures/cases.js) |
| An Agent-SDK app with streaming, task management and voice | [`jarvis/server.js`](jarvis/server.js) · spec [`brain/specs/jarvis-app.md`](brain/specs/jarvis-app.md) |
| How a second AI runtime was bounded | [`HERMES.md`](HERMES.md) · [`brain/specs/hermes-agent.md`](brain/specs/hermes-agent.md) |
| Whether the system itself is working | [`brain/metrics.md`](brain/metrics.md) |

---

## The pieces

### `brain/` — the memory
Plain markdown. `constitution.md` holds the values and hard rules the agents enforce (reporting
cadence, escalation chains, "pending games count", "match people by id, never by name").
`specs/` holds one ground-truth document per automated procedure. `data-sources.md` records
where every number comes from and how to get it, including the quirks of each backend.

### `.claude/skills/` — the procedures
Fourteen skills, each a `SKILL.md` that points at its spec and gives the checklist. They cover the
weekly revenue and KPI review, member census against budget milestones, churn and intro-conversion
monitoring, lapsed-member win-back sheets, intro re-buy refund maths, occupancy-drop root-cause
diagnosis, competitor social tracking, Pilates studio reporting, month-end cost actuals, the
command deck, and the close-out sync. Skills hold judgment; anything deterministic is pushed down
into `scripts/`.

### `jarvis/` — the command deck
A localhost Express app that wraps the Claude Agent SDK. Speak or type a command, and a real
Claude Code session spawns inside the repo with every skill and rule loaded. Progress streams back
over SSE; tasks outlive their HTTP request and can be re-attached, stopped, or run three at a
time. Replies carry structured sentinels (`===GLASS===`, `===SPEAK===`, `===NEXT===`,
`===FILES===`) that the HUD turns into an overlay stat, spoken narration, suggested next
commands and clickable deliverable cards. Text-to-speech is ElevenLabs with a content-addressed
disk cache, falling back to the offline macOS voice. Binds to 127.0.0.1 only.

### `matchmaker/` — the open-match daemon
Under-filled open matches at adjacent times often *would* fill if a player moved thirty minutes.
The daemon polls the booking platform, finds those near-misses with a pure scorer (±30 min, strict
level fit, prefers moves that free a whole court), drafts a warm club-voice message, and queues it
for one-tap approval. It was designed with a 22-finding red-team pass baked in: headless login
with content validation (a 200 is not success), token expiry that fails closed, a persisted
`AUTH_DEAD` latch so a bad password can never crash-loop into an account lock, single-instance
locking, atomic writes, schema-drift detection, quiet hours, per-player caps, a kill file checked
immediately before any write, and a mode flag that defaults to PILOT on anything unexpected. No
AI runs inside it. 70 tests, no framework, `npm test`.

### `scripts/` — deterministic utilities
A pure-P2P exclusion filter and ranker (the stable core extracted from a skill once the logic
settled), a markdown-to-A4 brief renderer, an Obsidian vault health check that runs on every deck
open, and a GDPR-safe newsletter list builder.

### `HERMES.md` — a second runtime, fenced
The Nous Research Hermes agent was merged in as a reader over the same brain. Its standing orders
define exactly one write path and route anything needing credentials back to Claude Code by
skill name.

---

## Running it

The apps are wired to a club's live systems, so they are not runnable end to end from this copy.
What does run:

```bash
cd matchmaker && npm test          # 70 tests: scorer, auth core, daemon loop — no network
cd jarvis && npm install && npm start   # the deck UI on http://127.0.0.1:4870 (needs a Claude Code login)
node scripts/vault-check.mjs       # vault health check (reports "not connected" here — no vault in this copy)
```

Both apps read credentials from a gitignored `.env`; see the `.env.example` files.

---

## What is not here

Removed or replaced before publishing, on purpose:

- `brain/facts.md` (the fact log), `brain/targets-and-kpis.md` (budget), `strategy/` (vault),
  `data/`, `reports/`, and the Front-of-House handbook, referral, weekly-report and cost specs.
- All member, customer and staff personal data. Staff appear by role; members appear as
  "a member". The founders are named.
- Every tenant, category, sheet, database and Firebase identifier → `<PLACEHOLDER>`.
- Revenue, cost, budget and membership-count figures. Public list prices are kept because they
  are on the club's price card.
- `.env`, tokens, ledgers, runtime state, logs, the TTS cache and `node_modules`.

If a reference in a spec points at a file that is not here, that is why.

---

## Stack

Claude Code + Claude Agent SDK · Node 18+ (ESM, Express, zero-dependency daemon) · Python 3
(reportlab) · Obsidian · launchd · the undocumented internal APIs of Playtomic, TeamUp, BSport,
Xero and Instagram, driven from a logged-in browser tab.

---

*Source shared for portfolio review. © 2026 Krish Bhayani. All rights reserved; not licensed for reuse.*
