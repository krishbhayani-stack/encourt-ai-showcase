---
name: lapsed-winback-call-sheet
description: Regenerates the lapsed/expired member list (paid for a benefit before, holds no membership now) with fresh Playtomic data, flags NEW lapses since the last run, and builds the graduation-pitch call sheet PDF sorted by activity. Use when Krish asks for "the lapsed list", "win-back sheet", "who's lapsed", or a fresh lapsed run.
---

# Lapsed / Win-Back Call Sheet

Ground truth: `brain/specs/lapsed-winback-call-sheet.md` — definition, the locked framing
("they left the MEMBERSHIP, not the club" → graduation call, not churn recovery), segments,
method, output rules. Plumbing: `brain/specs/playtomic-live-pull.md` via the
`playtomic-live-pull` skill.

## Steps

1. **Fresh benefit-buyer sweep** (live, per plumbing skill): BENEFIT_PURCHASE 14 Jun→today,
   6-day windows, client-side SKU filter, skip REFUNDED, user-id keyed. Pre-14 Jun comes from
   the payments export baked into `reports/raw/2026-07-12-subscription-status-run.csv`.
2. **Current-membership check**: customers CSVs categories + live membership evidence.
   Ever-paid + no current membership = lapsed/expired.
3. **Enrich**: £ paid (floor), first/last purchase, membership-they-had (from amounts),
   paid games + last played (undercount — say so), phone, email, opt-in.
4. **Segment** per spec: intro-cliff (dominant) · true tier lapse · zero-use. Loophole
   intro re-buyers are NOT lapsed → note them for the churn monitor instead.
5. **Delta**: diff vs the previous run's CSV in `reports/raw/` — NEW lapses flagged on top,
   returners noted.
6. **Outputs**: CSV → `reports/raw/YYYY-MM-DD-lapsed-expired-run.csv`; call-sheet PDF →
   `reports/briefs/YYYY-MM-DD-lapsed-call-sheet.pdf` + ~/Downloads (sorted by activity,
   segment labels, script box: graduation pitch · wellness-day-pass fallback · "re-buy intro →
   escalate to Krish/Aman"; outcome column). facts.md entry: segment counts, new lapses named.
7. Day-snapshots → Trash after the run (re-scrape-then-trash rule); the run CSV is a
   reference dataset and STAYS.

## Standing caveats (print on the sheet)

£ = floor (post-4 Jul export gap) · games = undercount · invoiced/assigned members can
never appear lapsed here · Pilates/BSport lapse not covered.
