---
name: teamup-pilates-pull
description: Per-person Pilates run from the TeamUp business dashboard (replaced BSport 12 Oct 2026) — membership census, recurring revenue base from Upcoming Billing (monthly + annual), missing-card collection risk, money in vs the the Pilates budget line, memberships sold, class fill, delta vs last snapshot. Use when Krish asks about Pilates members, Pilates revenue, "how's Pilates doing", "what did Pilates sell", TeamUp, or weekly to feed the KPI review.
---

# TeamUp Pilates Pull

Ground truth: `brain/specs/teamup-pilates-pull.md` — URL map, API pattern, column keys, quirks,
product shorthand, what a run produces. Access: `brain/data-sources.md` §TeamUp.

## Steps

1. Claude in Chrome (the built-in browser is not signed in) → goteamup.com, business profile
   **Encourt Pilates** (provider <PROVIDER_ID>). Open `/providers/reporting/dashboard/` for the tiles
   (active memberships, confirmed revenue, upcoming billing, events booked).
2. **Census**: `GET /api/v2/reports/customer_memberships/data` with header
   `Teamup-Provider-ID: <PROVIDER_ID>`, `page_size=100`, `sort=-start_date`, the column list in the
   spec. Store in `window.__tu`, read back in ≤15-row slices (tool output truncates).
3. **Recurring base**: fetch `/providers/billing/?page=1..N` (server-rendered) and parse
   `.well-row.payment` rows → amount, date, customer, membership, "Stripe" vs "Missing payment
   details". Unique (customer, amount) = the monthly book; £1,500/£1,750 lines = annuals.
4. **Money in**: `/transactions/items/summary/` (month tiles), `/transactions/payments/`,
   invoices API by status (paid / open / skipped), `/providers/reporting/payouts/`.
5. **Fill**: `/api/v2/events?starts_after=…` (filter the window client-side), attending_count /
   max_occupancy; attendances API for who-booked-what.
6. **Analyse per spec**: missing-card members due in 14 days (call list) · zombies vs the last
   BSport/TeamUp snapshot · double memberships · open invoices · memberships sold since last run ·
   recurring base vs the Pilates budget line · fill <50% and empties.
7. **Outputs**: dated CSVs → `data/teamup/` · brief → `reports/briefs/YYYY-MM-DD-pilates-review.md`
   · facts.md entry · Pilates tab + `data/teamup/pilates-tracker-ledger.csv` counts.

## Rules

- Customers page = imported contacts, NOT payers — never quote it as a member count.
- "Accounts Created" in October 2026 is the import, not sign-ups.
- Exclude the "Demo Account" (vendor) from every money figure.
- Product names are long; use the spec's shorthand (UNL / UNL+W / UNL175 / 5C / 5C+W / INTRO).
- If TeamUp is unreachable, report from the newest `data/teamup/` snapshot and label the read stale.
