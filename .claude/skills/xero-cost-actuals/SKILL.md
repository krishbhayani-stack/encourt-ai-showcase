---
name: xero-cost-actuals
description: Month-end cost actuals from Xero — total costs vs the monthly cost guardrail, big-line breakdown vs budget, net-of-VAT revenue cross-check vs Playtomic/BSport, net result vs the Y1 net target. Closes KPI flag rule 5. Use at month-end, or when Krish asks "what are our costs", "are we over budget on costs", "how's the P&L".
---

# Xero Cost Actuals (month-end)

Ground truth: `brain/specs/xero-cost-actuals.md`. Access method: `brain/data-sources.md` §Xero.

## Steps

1. Chrome → go.xero.com, org "Encourt Padel Limited". Reporting → Profit and Loss.
   ⚠ FY runs Jul–Jun and the default range HIDES pre-1-Jul — use "Current and previous
   3 months" or explicit custom dates, every time.
2. Pull the month's P&L: every cost line + the revenue lines (Booked Events, Equipment Hire,
   Membership, Merchandise, Padel Courses, Pay to Play, Reformer-Pilates, Square Sales).
   All figures are NET of VAT.
3. **Score per spec**: total costs vs cost guardrail (from Aug 2026; before Aug compare to
   the budget month's cost column and say rent hasn't started) · big lines vs budget (rent,
   rates, payroll, marketing, maintenance, buffer) · revenue lines vs the
   month's Playtomic/BSport reads (net both sides; mismatch → reconciliation flag — invoiced
   income like Platinum shows here first) · net result vs the budget month and the Y1 net target.
4. **Delta** vs the previous `data/xero/` snapshot: new/changed cost lines.
5. **Outputs**: snapshot → `data/xero/YYYY-MM-DD-xero-pnl-monthly.csv` (keeper) · brief →
   `reports/briefs/YYYY-MM-DD-cost-actuals.md` (one action per flag) · facts.md entry ·
   hand the cost verdict to the next revenue-kpi-review (flag rule 5).

## Rules

- Salaried staff costs = Xero "Salaries" line; RotaCloud £ covers hourly only — cross-check,
  never sum the two blindly.
- Square is already inside Xero (Square Sales / Square Fees) — no separate till pull.
- Mid-month runs are allowed but labelled PARTIAL (bills lag).
