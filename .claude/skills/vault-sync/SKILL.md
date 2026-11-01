---
name: vault-sync
description: Session close-out sweep — fold the session's new facts, decisions, and numbers from brain/facts.md into the Obsidian strategy vault (strategy/), refresh Daily Focus, then commit everything. Run at the end of any session that changed facts.md, produced a brief, or recorded a Krish decision; also when Krish says "sync the vault", "update Obsidian", or "close out".
---

You are the vault-sync close-out step for Encourt. Spec: `brain/specs/vault-sync.md` (read it if
in doubt — it is ground truth). The Obsidian vault root is the repo root; `strategy/` is Krish's
curated strategy cockpit. Your job: nothing learned this session may be missing from the vault,
and the session ends committed.

Steps:

1. Establish what's new: `git log --oneline -5` and `git status --short`, plus the facts.md
   entries dated today (and any since the last commit touching `strategy/`). Read
   `strategy/Decisions Log.md` and `strategy/Daily Focus.md` to see current vault state.
2. If nothing strategy-relevant is new: STOP after step 5 (commit only if the working tree is
   dirty). A quiet close-out is a correct outcome.
3. Fold in, per the spec's routing table:
   - Krish decisions → append dated one-liners to `strategy/Decisions Log.md` (never rewrite old
     entries).
   - Verified numbers/findings → merge into the topical note (`Business Data — Playtomic`,
     `Pricing & Membership`, `Retention & Member Experience`, `Growth & Acquisition`,
     `Financials & Margins`, `Competitive Landscape`, `Business Data — Pilates (BSport)`,
     `Metrics that Matter`). Distill to 1–3 lines; deep detail stays in facts.md/briefs.
   - Undecided items → `strategy/Open Questions.md`.
   - Rewrite the Today block of `strategy/Daily Focus.md` (≤15 lines: top 3 priorities, deadlines,
     one "Waiting on" line); move the old Today content under Previous.
   - Any md brief written this session gets a footer `Linked: [[<home strategy note>]]`.
4. Link discipline: every note you touch must contain at least one `[[wikilink]]`; add the new
   note to `strategy/Strategy Home.md`'s map of content if it isn't there.
5. Commit: `git add -A && git commit -m "vault-sync: <one line on what was folded in>"`.
6. Do NOT append a facts.md entry for a routine sync — only if the sync itself surfaced a
   contradiction (then log the contradiction, not the sync).

Constraints: strategy-relevant material only — the vault is a curated cockpit, not a transcript.
Never delete or rewrite Krish's own words in any strategy note; append and merge around them.
Never touch `.claude/skills/` from inside this skill. No emails, no messages.
