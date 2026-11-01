---
name: revenue-kpi-review
description: Weekly revenue & KPI read for Encourt. Compares real Playtomic data and the weekly report against the Year One Budget (brain/targets-and-kpis.md), spots trends/drops/rises, explains why, flags anything behind budget, and writes a brief to reports/briefs/. Use when Krish asks about revenue, occupancy, bookings, KPIs, "how are we doing vs budget", or "how did we do this week".
---

# Revenue & KPI Review — actuals vs Y1 Budget

The job, in Krish's words: the Y1 Budget is the estimation goal; each week take the real
data from Playtomic and see where we're at against it.

## Before starting
1. Read `CLAUDE.md`, `brain/constitution.md`, `brain/targets-and-kpis.md` (the budget control
   panel — weekly target = current month's budget ÷ 4.333), and `brain/facts.md`.
2. Gather actuals — snapshots first, live pulls (Chrome, see `brain/data-sources.md`) to fill gaps;
   snapshot anything you pull live:
   - Latest Playtomic export(s) in `data/playtomic/` (revenue is by PAYMENT date; headline excludes
     wallet). **Check the export actually covers the full week** — the 24 May–4 Jul export was
     missing its final Sunday and silently skewed a weekly cut (facts.md 2026-07-07).
   - **Pilates: latest `data/bsport/` snapshots** (payments-daily, subscriptions, passes-active,
     bookings-daily); refresh from BSport backoffice if older than the week under review.
     BSport may not capture Pilates money invoiced outside it — say so if the number looks partial.
   - Weekly report / forecast files in `data/forecast/`
   - Member counts: Playtomic Manager → Rewards & Offers → Benefits (tier mapping + last snapshot
     method in targets-and-kpis.md §Membership); refresh at month-end or when scoring milestones.
   - Note: the weekly sheet's own total row has a known formula error — read totals from Playtomic directly (facts.md 2026-07-06).
3. If an input is missing, say exactly what's missing and run a partial analysis with what exists.

## Analysis
1. **Actuals** — this week vs last week: revenue by line (court fees, memberships, classes,
   open matches, **Pilates via BSport**), peak vs off-peak occupancy (off-peak = Mon–Fri
   06:00–17:00, peak = weekday evenings + all weekend), member counts by tier if available.
   ⚠ Occupancy denominator: budget assumes 882 h/wk (18h/day), club reports use 833 (17h/day)
   — compare like-for-like and say which base you used.
2. **Vs budget** — compare each actual to the current month's budget line in
   `targets-and-kpis.md`: weekly revenue vs (monthly budget ÷ 4.333) and vs the monthly
   north star (**net of VAT** — strip VAT before comparing); occupancy vs the month's ramp row
   (not the year-end target); Pilates receipts vs the Pilates budget line; at month-end, member
   counts vs the milestone table and costs vs the cost guardrail (skip with a note while
   cost actuals are missing). Standing context: budget membership income is priced on the OLD
   card — part of that gap is structural (facts.md 2026-07-07).
3. **Flags** — apply the Flag rules section of `targets-and-kpis.md`. Never invent a threshold
   that isn't in that file or the budget spreadsheet (`data/budget/`).
4. **Standing watch — off-peak defence (added 8 Jul, see 2026-07-08-offpeak-defence-options.md):**
   track weekly (a) Intro-to-Off-Peak → membership conversions, (b) off-peak occupancy EX-intro
   cohort vs the ramp, (c) member cancellations citing price/competitors. Tripwires for the
   "Off-Peak Flex" rung: conversion <20% by end-July · PadelStars Radlett pricing announced ·
   ≥3 competitor-naming cancellations in a month · ex-intro occupancy below ramp 2 wks running.
5. **Reasons** — for every notable gap or move, check `brain/facts.md` for a known cause first
   (World Cup, heatwave, price change, missing session). Label each explanation **confirmed**
   (traceable to facts or data) or **hypothesis** (Krish should verify). Never present a
   hypothesis as fact.

## Output
Write `reports/briefs/YYYY-MM-DD-revenue-kpi-review.md`:
1. Headline — this week vs last week vs budget, plain numbers
2. Budget scorecard — actual vs budget line by line (incl. Pilates), ahead/behind
3. Trends — what rose, what dropped, size of each move
4. Reasons — confirmed vs hypothesis
5. Actions — mandatory for every flag
6. Trajectory — at this run-rate, do we hit the month's budget and the north-star net goal?
7. Data-quality footnote — export coverage, denominators used, anything unverifiable

Then run the close-out per CLAUDE.md: append durable facts to `brain/facts.md` (dated,
append-only), update `strategy/` notes if strategy-relevant.

## Constraints
- Every number must trace to a snapshot, live Playtomic, the budget, or facts.md.
- Recommendations must align with `brain/constitution.md`.
- The weekly socials & coaching structure in `targets-and-kpis.md` is authoritative (adopted
  2026-07-07): check that week's Playtomic listings against it and flag any missing session.
