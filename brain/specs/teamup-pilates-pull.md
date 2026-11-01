# Spec — TeamUp Pilates Pull (per-person Pilates run)

Ground truth for the `teamup-pilates-pull` skill. Written 2026-10-12, the day of the first live
read. Replaces `bsport-pilates-pull` (archived at `_archive/superseded-brain-docs/2026-10-12-bsport-
pilates-pull-SUPERSEDED.md`). Krish, 12 Oct 2026: "BSport is never going back."

## Why TeamUp

Pilates moved BSport → TeamUp (DaySmart) in the first week of October 2026: demo 11 Sep,
business-dashboard invite to Krish 24 Sep, customers + memberships imported 5 Oct, members
re-created on their real tiers 9 Oct, Stripe saved-card copy requested via DaySmart support 5 Oct
(studio manager). Simplified membership shelf launched with the move (see Products below).

## Source & method (verified live 2026-10-12)

- **Dashboard:** https://goteamup.com/providers/reporting/dashboard/ — Krish's login in Chrome,
  business profile **Encourt Pilates** (customer profile "Krish Bhayani" is separate — if a page
  says "Switch Profiles", you hit a customer URL). Provider ID **<PROVIDER_ID>**. The built-in browser is
  NOT signed in; use Claude in Chrome.
- **Two page types.** Old-style pages are server-rendered — `fetch()` + `DOMParser` from any
  TeamUp tab paginates them: `/providers/billing/?page=N` (Upcoming Billing, `.well-row.payment`
  rows, 25/page), `/transactions/items/summary/` (Item Summary by month), `/transactions/payments/`
  (Invoice Transactions), `/providers/configure/memberships/` (product shelf + active counts),
  `/providers/customers/` (customer list, total in "Export Filtered List (N customers)"),
  `/providers/reporting/invoices/` (old invoice list). **Reports v2 pages are a Vue SPA** —
  fetching the URL returns an empty shell; use the JSON API behind them instead.
- **JSON API (same-origin, cookie auth, needs header `Teamup-Provider-ID: <PROVIDER_ID>`):**
  `GET /api/v2/reports/<report>/data?columns=<comma list>&page_size=100&sort=-<col>&<filters>`
  → `{total, column_headers, next, previous, rows}`. Invalid column → 400 with
  `field_errors.columns`. Verified reports + columns:
  - `customer_memberships`: `customer.id, customer.name, id, membership.name, type (recurring|pack),
    status (active|cancelled), start_date, cancelled_date, expiration_date, purchase_date,
    completed_at, payment_processor, is_first_membership, other_active`. Sort `-start_date`.
    This is the census. No price column — join to the shelf or to billing.
  - `invoices`: `id, status (paid|open|upcoming|skipped|voided), paid_at, due_date, customer.id,
    customer.name, payment_processor, payout, total_amount (object: .decimal), discount_code`.
    Sort `-due_date`. Paid = money in; open = owed now; skipped = a billing cycle deliberately or
    automatically not taken; voided = cancelled schedule; upcoming = the billing forecast.
  - `attendances`: `customer.id, customer.name, event.id, event.starts_at, checkin,
    offering_type.name, instructors, booking_method (membership|dropin), customer_membership,
    booking_source, status (attended|registered)`; filters `event_start_gte`, `event_start_lte`.
  - `customers` (Slipping Away page): `full_name, latest_registration, id`; filter
    `is_slipping_away=true`.
  - Also present, unused so far: `attendances.grouped`, `course_session_attendances` (courses only
    — Pilates classes are events, not courses), `customer_credits` (account credit, NOT class
    credits), `instructors`, `penalties`, `community_happiness`, `discountcodes`, `store_orders`.
- **Events / schedule:** `GET /api/v2/events?starts_after=<ISO>&page_size=100` (same header),
  follow `next`. Fields: `starts_at, name, status, max_occupancy, attending_count, is_full,
  occupancy, instructors`. ⚠ `starts_before` is ignored — filter the window client-side.
- **Quirks:** javascript_tool output truncates at ~1,500 chars → store pulls in `window.__tu` and
  read back in slices; avoid returning raw response text or query strings (the tool blocks it).
  The dashboard "Confirmed Revenue" tile = Stripe-confirmed payments net of refunds and discounts.
  "Accounts Created" in October = the import, not real sign-ups. Check-in is not being used
  (past bookings stay "registered") — treat booking counts as attendance until the desk checks in.
  A "Demo Account" (<vendor-demo-email>) carries open test invoices — exclude it.

## Products (TeamUp shelf as of 12 Oct 2026)

| Membership | Plans | For sale? | For sale? (dup) |
|---|---|---|---|
| £175- Unlimited reformer pilates membership (**UNL175**) | £175/mo · £1,750/yr | Yes — the simplified unlimited | |
| 5 Class Membership (**5C**) | £120/mo · £1,200/yr | Yes | |
| Monthly 5 Class Membership Plus Wellness Access (**5C+W**) | £170/mo · £1,700/yr | Yes | |
| Half price monthly unlimited membership (**UNL**) | £150/mo · £1,500/yr | Hidden (locked founders) | |
| Half Price Monthly Unlimited Class Membership Plus Wellness Access (**UNL+W**) | £200/mo · £2,000/yr | Hidden (locked founders) | |
| Reformer Intro offer (**INTRO**) | £60 one-off, 31 days | Yes | |
| Drop in Reformer Class · Mat Pilates and Lattes · Mat Class Pass | £28 · £10 · £10 one-off | Yes | |

Gone vs the BSport shelf: 10 Class (£200), Unlimited £300, Unlimited + Wellness £350, 10-class
pack £295, Wellness pass, School hire, and the mis-credited annual Plus-Wellness passes. The
cheapest unlimited a new buyer can get fell **£300 → £175**.

## What a run produces (per person, not per product)

1. **Census** (customer_memberships, active): recurring rows by product; dedup to people
   (run-off twins with an expiration_date, double-holders); packs separately. Delta vs the last
   `data/teamup/` snapshot: new / lost / cancelled since.
2. **Recurring revenue base** (Upcoming Billing): unique (customer, amount) lines → monthly
   charges and £/mo, annual lines separately (÷12 for run-rate), by product; "Missing payment
   details" vs Stripe split = collection risk; next 7/30 days of charges.
3. **Money in** (Item Summary + invoices paid/open/skipped): confirmed revenue MTD, refunds,
   discounts, open invoices owed, skipped cycles — vs the the Pilates budget line Pilates budget line
   (`brain/targets-and-kpis.md`). Payouts page = what has actually reached the bank.
4. **Sales**: memberships bought since the last run (paid invoices with "Membership Purchase"),
   by product; intro packs started and their expiry cliff.
5. **Fill**: events for the past 7 days and next 7 (attending_count / max_occupancy), empties,
   by slot / type / day; attendance status.
6. **Flags**: missing-card members due to bill in the next 14 days (call list); zombies (active in
   TeamUp, terminated in the last BSport snapshot); double memberships; open unpaid invoices;
   members missing from TeamUp who were live in BSport.

## Output

- Snapshots → `data/teamup/YYYY-MM-DD-teamup-{customer-memberships,upcoming-billing}.csv`
  (keepers; supersede, keep the latest two). Last BSport snapshots in `data/bsport/` stay as the
  pre-migration baseline (23 Sep subs, 8 Oct contacts).
- Brief → `reports/briefs/YYYY-MM-DD-pilates-review.md`.
- facts.md entry with headline counts and flagged names.
- Pilates tab mirror (Membership Tracker Google Sheet) + ledger `data/teamup/pilates-tracker-ledger.csv`
  (`date,source,product,count`; source = `teamup-subs` / `teamup-packs`; BSport rows kept above).
- Cadence: weekly (feeds revenue-kpi-review's Pilates line) or on demand. Human cross-check: the studio manager.

---
Linked: [[Business Data — Pilates (BSport)]]
