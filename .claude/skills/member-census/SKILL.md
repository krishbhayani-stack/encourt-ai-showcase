---
name: member-census
description: Live per-tier member counts from Playtomic Benefits vs the Y1 budget milestone table — Access/Off-Peak/Platinum red/green, plus Player/P&W and funnel lines (Intro, Weekend Pass). A 10-minute read. Use when Krish asks "member numbers", "are we hitting the milestones", "tier counts", or at month-end for official milestone scoring.
---

# Member Census vs Milestones

Ground truth: `brain/specs/member-census.md`. Milestones + tier mapping authority:
`brain/targets-and-kpis.md` §Membership. Access method: `playtomic-live-pull` skill.

## Steps

1. **Live pull**: Playtomic Manager → Rewards & Offers → Benefits (per-benefit member counts,
   UI read from the logged-in tab). Snapshot → `data/playtomic/YYYY-MM-DD-benefits-members.csv`
   — this snapshot is a KEEPER (month-end audit trail); supersede the old one, don't trash.
2. **Map tiers** per the locked mapping: Access* → Access · Off Peak* (excl. intro) → Off-Peak ·
   Platinum (invoiced) → Platinum (check joint double-counts) · Player/P&W → own line ·
   Intro + Weekend Evening Pass → funnel lines · staff excluded (say how many) · flag stale
   benefits (e.g. old Wimbledon one).
3. **Score** vs the CURRENT month's milestone row (not year-end), and vs the last census
   (previous census values).
4. **Output**: table brief → `reports/briefs/YYYY-MM-DD-member-census.md`
   (tier | live | milestone | Δ | Δ vs last census | RAG + funnel lines + anomalies);
   facts.md entry with counts. Month-end run = the official milestone scoring feeding
   revenue-kpi-review flag rule 4.

## Rules

- Never invent actions here — a RED two censuses running hands off to the KPI review's
  flag-and-action machinery.
- If the Benefits page is unreachable, use the newest benefits snapshot and label the read
  stale, per the plumbing fallback rule.
