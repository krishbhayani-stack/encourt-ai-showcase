# Spec — Weekly Churn & Intro-Conversion Monitor

Ground truth for the `churn-conversion-monitor` skill. Written 2026-07-30. This is the workflow
Krish picked for a mentor exercise (12 Jul) — the weekly membership churn &
intro-conversion monitor — built on the CORRECTED 15-Jul method.

## The one method rule (15-Jul correction — never regress)

**Intro conversion is measured on the FULL intro history, denominator = COMPLETED intros.**
The 12-Jul "12%" was a structural undercount: it filtered to single-£99-payment purchasers,
which excluded almost everyone who converted (converters have 2+ benefit payments by
definition). True method: everyone who ever bought the intro (£99/£100 BENEFIT_PURCHASE;
2026-07-15 baseline = N people) → of those whose intro window has ENDED, what % now hold
another membership. Baseline 15 Jul: **N%** (vs 20% tripwire), dominant
landing = Access Monthly.

## Weekly numbers to produce (each vs last run's value)

1. **True intro→membership conversion %** — full-history method above, updated with the week's
   expiries and purchases. Track against the 20% tripwire (15 Jul: comfortably above; the
   Off-Peak-Flex tripwire narrative is retired unless this falls).
2. **Intro funnel state** — currently-on-intro count, expiring in the next 7/14 days (expiry =
   latest £99/£100 payment + 1 month — no valid_until field), heavy users in the window
   (they're the best graduation calls → feed the intro-expiry call list).
3. **Renewal-loophole watch** — people on their 2nd+ intro purchase (baseline 15 Jul: a known share). This is a de facto £99 off-peak membership undercutting the £160
   tier; report NEW re-buys this week by name. Decision (enforce/tolerate/formalise) is
   Krish+the co-founder's — the monitor only surfaces the size.
4. **New lapses this week** — payers now holding no membership who held one last week
   (same definition as the lapsed-winback spec; hand the names to that skill's next run).
5. **Membership movement** — new joiners by product this week (from the benefit sweep), tier
   switches, cancellations Krish/FOH have logged (cancellation reasons come from FOH verbatims
   when available — flag if none were logged).

## Method

- Live BENEFIT_PURCHASE sweep per `brain/specs/playtomic-live-pull.md` (6-day windows,
  client-side SKU filter, user-id matching), covering at least the last 5 weeks on every run.
- Join against `reports/raw/2026-07-15-intro-offpeak-full-history.csv` (the baseline) and the
  latest lapsed run; live intro-category membership when the endpoint cooperates, else buyer
  sweep + reference CSVs (proven coextensive).
- Persist the updated intro history as the new baseline CSV in `reports/raw/` (dated) so next
  week's delta is cheap. This file is a reference dataset, not a day-snapshot — it stays.

## Output

- Brief → `reports/briefs/YYYY-MM-DD-churn-conversion-monitor.md` (PDF only if Krish asks):
  headline conversion % vs last week vs tripwire · funnel table (on-intro / expiring / landed
  by product) · loophole re-buys (new names) · new lapses (new names) · joins by product ·
  one action per flag. Keep it one page — it's a monitor, not an essay.
- facts.md entry with the headline numbers (this builds the trend line week over week).
- Cadence: weekly (pairs with revenue-kpi-review), or on demand.

---
Linked: [[Retention & Member Experience]]
