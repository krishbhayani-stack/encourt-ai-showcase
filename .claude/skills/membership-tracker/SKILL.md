---
name: membership-tracker
description: Weekly membership tracker — per-benefit member counts for ALL live benefit tiers from the Playtomic Benefits UI, appended to a week-over-week ledger with churn/roll-off flags. Runs every Monday 12:00 (scheduled, Krish's 1-Sep-2026 explicit ask) and whenever Krish asks "run the membership tracker", "membership counts", "who's rolling off", "tracker readings".
---

# Membership Tracker (weekly)

Ground truth: `brain/specs/membership-tracker.md` — read it FIRST, every run. Access method:
`playtomic-live-pull` skill/spec. This file is only the checklist.

## Steps

1. **Live pull**: Chrome → Playtomic Manager → Rewards & Offers → Benefits
   (`/dashboard/rewards/benefits?tid=…`). Set rows-per-page to 100 (third `<select>`, native
   setter + change event — pinned in the spec). `get_page_text`; verify parsed rows ==
   "Showing 1–N of N".
2. **Snapshot** → `data/playtomic/YYYY-MM-DD-benefits-members.csv` (KEEPER, lineage kept).
3. **Ledger append** → `data/playtomic/membership-tracker-ledger.csv` (`date,benefit,members`,
   append-only, live reads only — never append a stale/fallback read).
4. **Deltas + flags** per the spec: Δ per benefit vs last ledger date, family rollups
   (Access / Off-Peak / Platinum / Player-P&W / funnel / non-tier), paying book, churn flags
   (paying benefit −2 WoW · two-reads-running decline · paying book down · Player/P&W growing ·
   milestone family down in scoring week). Intro shrinkage = funnel expiry, NOT a churn flag.
   **Every run: AUTUMN double-buyers** — anyone with ≥2 AUTUMN subs (ACTIVE+INACTIVE), named
   in brief + chat as KNOWN vs NEW; say "nobody new" explicitly (Krish standing ask, 30 Oct 2026).
5. **Brief** → `reports/briefs/YYYY-MM-DD-membership-tracker.md` (table + rollups + flags,
   `Linked:` footer). Give Krish the readings in chat.
6. **Google Sheet mirror** (re-pointed by Krish, 21 Sep 2026): Padel rollups → **the co-founder's sheet** (URL + exact 12-row mapping pinned in the spec, output #5) — append one date
   column (DD/MM/YYYY) in the existing format, Name-Box navigation only. Pilates counts still →
   the OLD sheet's "Pilates" tab (spec output #6; TeamUp method per
   `brain/specs/teamup-pilates-pull.md`, ledger `data/teamup/pilates-tracker-ledger.csv`).
   Skip on a STALE run, same as the ledger.
7. **facts.md entry** + `vault-sync` (rule 12 — a scheduled run is still a session).

## Rules

- Counts only, no names — a fired flag hands off to `churn-conversion-monitor` (per-person),
  `member-census` (milestone scoring) or `lapsed-winback-call-sheet`; never deepen this skill.
- The Monday-12:00 timer is the ONE standing schedule grant (1 Sep 2026). Never create
  additional timers from inside this skill (constitution rule 13).
- Playtomic unreachable → newest snapshot, say STALE in brief + facts, skip the ledger append.
