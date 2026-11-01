# Spec — Member Census vs Milestones

Ground truth for the `member-census` skill. Written 2026-07-30 from the 7-Jul and 14-Jul live
census pulls (facts.md) and `brain/targets-and-kpis.md` §Membership.

## What it is

A ~10-minute repeatable read: live per-tier member counts from Playtomic → compared to the
current month's milestone row in `brain/targets-and-kpis.md` → red/green per tier.

## Source

Playtomic Manager → **Rewards & Offers → Benefits** (per-benefit member counts; UI read from
the logged-in manager tab per `brain/specs/playtomic-live-pull.md`). Snapshot the pull to
`data/playtomic/YYYY-MM-DD-benefits-members.csv` (this one is a KEEPER, not trash-after —
it's the month-end audit trail; supersede, don't accumulate weekly).

## Tier mapping (locked 7–8 Jul)

- "Access Membership *" → **Access**
- "Off Peak *" (EXCLUDING intro offers) → **Off-Peak**
- "Platinum (invoiced)" → **Platinum** (check joint memberships aren't double-counted)
- "Player / Player & Wellness" → own line, maps to NO budget tier (new card) — report alongside.
- "Intro to Off Peak Padel" → **funnel, NOT a milestone tier** (promotional/temporary).
- Weekend Evening Pass (live since 12 Jul) → own funnel line, not a milestone tier.
- Staff accounts → exclude and say how many. Stale "Wimbledon" benefit → flag if still active.

## Scoring

- Compare each milestone tier to the CURRENT month's row of the milestone table in
  targets-and-kpis.md (the month's row) — not the year-end target.
- Green = at/above the row · Red = below, with the gap and the delta since the last census
  (last-known values).
- Month-end run doubles as the official milestone scoring for the revenue-kpi-review.

## Output

- Short table brief → `reports/briefs/YYYY-MM-DD-member-census.md` (PDF only on request):
  tier | live count | milestone | Δ vs milestone | Δ vs last census | RAG. Plus funnel lines
  (Intro, Weekend Pass, Player/P&W) and any anomalies (double-counts, stale benefits).
- facts.md entry with the counts (builds the tier trend line).
- If a tier is RED two censuses running → hand off to occupancy-drop-diagnosis /
  revenue-kpi-review action rules rather than inventing actions here.

---
Linked: [[Metrics that Matter]]
