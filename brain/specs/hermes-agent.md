# Spec — Hermes Agent integration (second runtime over the brain)

Ground truth for the Hermes Agent (NousResearch) merge. Commissioned by Krish 22 Aug 2026
("merge hermes in here… one main brain and every file that loads with the V2 Encourt, like
my Claude has set up"). Recorded as CLAUDE.md rule 14: **Hermes is a reader, not an author.**

## What it is

Open-source self-hosted agent by Nous Research (`github.com/NousResearch/hermes-agent`),
installed 22 Aug 2026 via the official installer. It gives the brain a second runtime:
Q&A over the knowledge base, drafting, its own persistent memory, and (when Krish enables
the gateway) reachability from Telegram/WhatsApp/Signal. It does NOT replace Claude Code,
which remains the only author of facts, briefs, vault, and code.

## Install layout (this machine)

- Code + venv: `~/.hermes/hermes-agent/` (Python 3.11 venv — the system Python is 3.9).
- **Binary shim: `~/.hermes/bin/hermes`** (symlink to `hermes-agent/venv/bin/hermes`).
  TRAP: the stock launcher `~/.hermes/hermes-agent/hermes` picks up system Python 3.9 and
  crashes with `TypeError … 'type' and 'NoneType'` — always use the shim. PATH line added
  to `~/.zshrc` by us (the installer's own PATH edit did not land).
- Config: `~/.hermes/config.yaml` (`hermes config set/get`). Secrets: `~/.hermes/.env`.
- Its own state (SQLite memory/FTS5, sessions, logs, cron): `~/.hermes/` — never in this repo.
- Bundled skills: `~/.hermes/skills/` (82 stock, agentskills.io SKILL.md format — the same
  format as `.claude/skills/`, so ours are portable in principle; none ported yet because
  all operational Encourt skills need live pulls, which Hermes is barred from).

## Config set by us (22 Aug 2026)

| Key | Value | Why |
|---|---|---|
| `terminal.cwd` | this repo's absolute path | Hermes's shell/file tools open in the brain regardless of launch dir |

Model/provider deliberately NOT set by Claude: Krish runs `hermes setup --portal` himself
(OAuth to Nous Portal; account + hosted Hermes models + Nous tool gateway). Until then the
shipped default (`openrouter/claude-opus-4.6`) has no key and Hermes cannot answer.
The laptop rules out serious local models — hosted is the standing plan.

## How the brain loads into Hermes

Verified in source (`agent/prompt_builder.py`, `build_context_files_prompt`): Hermes loads
exactly ONE project context file per session, first found wins, priority
**`.hermes.md`/`HERMES.md` (walks to git root) → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`**,
plus `SOUL.md` from `~/.hermes/` which is ALWAYS injected regardless of launch directory.
So in this repo **`HERMES.md` is the file Hermes boots on** (its own native convention —
AGENTS.md/CLAUDE.md are then skipped, which is why HERMES.md's boot sequence step 1 is
"read CLAUDE.md whole"). `~/.hermes/SOUL.md` (written by us) carries the Encourt identity
and points back to the repo + HERMES.md, so gateway/out-of-repo sessions still find the
brain. `AGENTS.md` in the repo stays as a thin pointer for any OTHER non-Claude agent.
Context files are capped ~20k chars — keep HERMES.md under that; point, don't copy.

## Boundaries (CLAUDE.md rule 14 — enforcement, not just convention)

1. Write path: `reports/raw/hermes/` ONLY; vault-sync sweeps it (step 0 in vault-sync spec).
2. No Playtomic/BSport/Xero credentials, no live pulls, no login attempts. Live work is
   routed back to Claude Code by skill name (index in HERMES.md).
3. No timers/cron on repo data (Krish standing rule binds Hermes's cron tools too).
4. Backstop: the repo is git-tracked — any out-of-bounds write shows in `git status`;
   Hermes's dangerous-command approval prompts are on by default in interactive use.
5. Gateway (messaging) is OFF until Krish runs `hermes gateway install` + `setup` himself
   (bot tokens are his). Recommendation on file: run laptop-only for a few days first.

## Ops

- Update: `hermes update` (agent), `hermes model` (switch model), `/skills` in-chat.
- Test after any change: launch `hermes`, ask a brain question ("what does the £99 intro
  include — cite the file") → expect an answer from `brain/specs/foh-handbook.md` with
  citation; then ask for a live pull → expect a hand-back to Claude Code.
- If Hermes's answers go stale vs facts.md, the boot sequence in HERMES.md is the first
  thing to check (was it skipped/edited?).

---
Linked: [[command-deck]]
