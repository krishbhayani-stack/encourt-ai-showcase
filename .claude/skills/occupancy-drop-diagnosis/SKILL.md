---
name: occupancy-drop-diagnosis
description: Root-cause procedure for when occupancy or court fees DROP — vs last week, vs the budget ramp, or vs forecast. Isolates the drop to specific days/dayparts, works a known-cause checklist, labels each explanation confirmed vs hypothesis, and ends with actions. Use when Krish asks "why is occupancy down", "why did court fees fall", or a KPI review flags a red occupancy line.
---

# Occupancy Drop Diagnosis — find the WHERE before the WHY

Ground truth: `brain/targets-and-kpis.md` (ramp lines + peak/off-peak definition),
`brain/data-sources.md` (Playtomic navigation), `brain/facts.md` (validated method: the
1 Jul Wednesday-drop diagnosis, 2026-07-06 entries).

## Step 1 — Quantify and localise (no theories yet)
1. Playtomic Manager → Reports → Occupancy, preset "Last week" WITH the previous-period
   overlay (solid = current, dotted = prior). Pull per-day occupied hours for both weeks.
2. Build the day-by-day delta table. Find where the loss concentrates: which day(s),
   then which daypart (Schedule per-day view, occupancy badge bottom-right).
3. Size it: hours lost × applicable rate (£80 peak / £60 off-peak) = £ impact.
4. State the denominator you're using (833 h/wk club basis vs 882 budget basis).

## Step 2 — Known-cause checklist, in this order (each: confirm or rule out)
1. **Missing sessions** — was every structured session in the targets-and-kpis.md grid actually
   listed that day? (A missing Americano explained part of the 1 Jul drop.) Intro to Padel /
   Americano exceptions per the Pending section.
2. **Events** — football/World Cup fixtures (empties evenings 4–8pm+), school holidays,
   local events. Check facts.md first, then the fixture calendar.
3. **Weather** — heatwave / rain on the affected days.
4. **Late-booking conversion** — projection-vs-actual gap for the week (daily sheet). The base
   forecast is known to be ~13pts pessimistic (facts.md 2026-07-06) — a shrinking beat means
   late bookings dried up, a real demand signal.
5. **Revenue-line shifts masquerading as drops** — Holiday Camp and class blocks move money from
   court fees to Public Class (booking shows on courts, revenue books elsewhere); check by-product
   revenue before calling it a demand drop. Remember revenue is by PAYMENT date.
6. **Pricing/product changes** — any change that week (facts.md, ask Krish).
7. **Data problems last** — export coverage gaps, the weekly sheet's known total-row error,
   wallet exclusions. If the "drop" only exists in one source, it's probably this.

## Step 3 — Conclude
- Attribute the drop across causes with rough £ shares; label each **confirmed** (traceable) or
  **hypothesis** (Krish to verify). Never present a hypothesis as fact.
- Standing pattern to check against: weekends are premium-priced but lowest-occupancy (the
  weekend paradox) — don't re-discover it as news; measure whether it got worse.
- Actions per flag, aligned with `brain/constitution.md` (e.g. fill-problem ≠ commitment-problem:
  fix match-fill before touching cancellation policy).

## Output
Standalone: `reports/briefs/YYYY-MM-DD-occupancy-drop-<scope>.md` (or a section inside the
week's KPI review if it triggered from there). Structure: the delta table → localisation →
causes with £ shares → actions. Close out per CLAUDE.md (facts.md + strategy vault).
