---
name: churn-conversion-monitor
description: Weekly membership churn & intro-conversion monitor — true intro→membership conversion % (full-history method, baseline %, 20% tripwire), intro funnel state + upcoming expiries, renewal-loophole re-buys, new lapses, joins by product. Use weekly alongside the KPI review, or when Krish asks "what's our conversion", "how's the intro funnel", "any new lapses/re-buys".
---

# Weekly Churn & Intro-Conversion Monitor

Ground truth: `brain/specs/churn-conversion-monitor.md`. Plumbing:
`brain/specs/playtomic-live-pull.md` via the `playtomic-live-pull` skill.

## The one rule that must never regress

Conversion = full intro history, denominator = COMPLETED intros only. Never filter to
single-payment purchasers (that's the broken 12% method — converters have 2+ payments by
definition). Baseline 15 Jul: **N%**, tripwire 20%, dominant landing =
Access Monthly.

## Steps

1. **Fresh benefit sweep** (live): BENEFIT_PURCHASE, at least the last 5 weeks, 6-day windows,
   SKU filtered client-side, user-id keyed.
2. **Update the intro history**: start from the latest baseline CSV in `reports/raw/`
   (first: `2026-07-15-intro-offpeak-full-history.csv`), add new £99/£100 purchases, recompute
   expiries (latest intro payment + 1 month), re-resolve each completed intro's landing
   (another membership / nothing / re-bought intro).
3. **Compute the weekly five** (each vs last run): conversion % vs tripwire · funnel state
   (on-intro, expiring 7/14 days, heavy users in window) · NEW loophole re-buys by name
   (2nd+ intro; decision is Krish+the co-founder's, we only surface) · NEW lapses by
   name (hand to lapsed-winback-call-sheet) · joins by product + any logged cancellation
   verbatims (flag if FOH logged none).
3b. **Referral check** (spec: `brain/specs/referral-programme.md`): read Pending/Payable rows
   from the Notion **Padel Referrals** DB (Encourt Ops →
   <notion-db-url>). Per row, verify live: new member's
   benefit tag + monthly-payment count, genuinely new to membership, referrer's membership
   live, cap ≤3/rolling-12mo. Fill Months cleared + Payable from; flip Status
   Pending→Payable at 3 cleared months (annual: +3 calendar months), →Void with a note if
   the membership died, →Capped. Brief lists payable pairs: "£75 → referrer's wallet, £75 →
   new member's wallet" (manual credit in Manager → Rewards & Offers → Wallets; whoever pays
   sets Paid date + Status Paid). Referral count feeds the KPI review's acquisition-mix line.
4. **Outputs**: dated updated-history CSV → `reports/raw/` (reference dataset, stays) ·
   one-page brief → `reports/briefs/YYYY-MM-DD-churn-conversion-monitor.md` (headline %,
   funnel table, names, one action per flag) · facts.md entry with headline numbers (the
   trend line lives there). Day-snapshots → Trash per the re-scrape-then-trash rule.

## Hand-offs

Expiring heavy users → intro-expiry call list. New lapses → lapsed sheet. Conversion below
20% or ex-intro occupancy concerns → revenue-kpi-review's off-peak-defence watch.
