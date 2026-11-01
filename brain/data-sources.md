# Data Sources — where each number comes from

## Bookings, occupancy, sessions, vouchers → PLAYTOMIC (confirmed live platform)
- Public club page: https://playtomic.com/clubs/encourt-padel-wellness
- Manager backend: https://manager.playtomic.io  (tenant id: <TENANT_ID>)
- This is the single source of truth for: court bookings, occupancy %, structured-session
  listings (Intro / Social / Americano / Ladies Night), member activity, and voucher/promo codes.

### How agents get Playtomic data (two paths)
- **Path A — via the CM's report (default, reliable):** the Club Manager's daily/weekly report
  already contains occupancy and which sessions ran (per the constitution). Agents read that.
  No technical setup, never breaks. Start here.
- **Path A2 — Manager backend via Chrome (VERIFIED WORKING 2026-07-06):**
  - **Reports → Occupancy**: occupied hours + per-day chart. Presets include "Last week" (Mon–Sun)
    and a "Previous period" comparison overlay (solid = current week, dotted = previous).
  - **Reports → Revenues**: totals + day chart + "Amount by Product Category" (Booking / Benefit /
    Open Match / Public Class Registration / Private Class Registration / Tournament Registration).
    ⚠ ALL revenue reports are by PAYMENT date, not play date. Headline "Revenues" EXCLUDES wallet payments.
  - **Schedule**: per-day view; occupancy % + bookings badge bottom-right; use the toolbar date
    picker (URL ?date= param does NOT work).
  - Capacity for occupancy math: 833 h/week = 7 courts × ~17h × 7d (≈119 h/day).
- **Path B — direct pull (full automation, later):** Playtomic has no official public API, but the
  manager backend's internal API can be queried with the tenant bearer token (found in the
  manager portal under localStorage['playtomic:auth']). Powerful but unofficial — tokens expire
  and endpoints can change, so treat as an enhancement, not the foundation.

## FOH operations, membership products & staff-facing prices → FOH HANDBOOK
- Canonical spec: `brain/specs/foh-handbook.md` (full transcription of the FOH Staff Handbook v2,
  ingested 2026-07-07; source PDF in `reports/raw/2026-07-07-encourt-foh-handbook-v2.pdf`).
- Use for: membership tiers & list prices (padel + Pilates), cross-membership discounts,
  off-peak definition (Mon–Fri 6am–5pm), opening/closing procedure, checklist frequencies,
  overrun policy, spa/pool compliance targets, partnership (Bobo & Wild).
- Prices here are staff-facing list prices — actual paid amounts in Playtomic may differ
  (launch discounts, invoiced-outside-Playtomic). When they disagree, flag it.

## Pilates members, recurring revenue, payments & fill → TEAMUP (VERIFIED LIVE 2026-10-12)
- Pilates moved **BSport → TeamUp** (DaySmart) in the first week of October 2026 (import 5 Oct,
  members re-tiered 9 Oct, simplified shelf live 12 Oct). Krish, 12 Oct: BSport is never going back.
- Dashboard: https://goteamup.com/providers/reporting/dashboard/ — Krish's login **in Chrome**
  (built-in browser not signed in), business profile **Encourt Pilates**, provider ID **<PROVIDER_ID>**.
  the studio manager runs it day to day.
- **JSON API behind the Reports v2 pages**: `GET /api/v2/reports/<report>/data?columns=…` with
  header `Teamup-Provider-ID: <PROVIDER_ID>` (cookie auth, same origin). Reports + column keys verified:
  `customer_memberships` (census), `invoices` (paid/open/skipped/upcoming/voided, total_amount.decimal),
  `attendances` (bookings, attended vs registered), `customers` (slipping away). Events/schedule:
  `GET /api/v2/events?starts_after=…` (attending_count / max_occupancy; `starts_before` ignored).
- **Server-rendered pages** (fetch + DOMParser works): `/providers/billing/?page=N` = Upcoming
  Billing (the recurring revenue base, with "Stripe" vs "Missing payment details" per line),
  `/transactions/items/summary/` (Item Summary by month), `/transactions/payments/` (transactions),
  `/providers/configure/memberships/` (shelf + active counts), `/providers/reporting/payouts/`.
- ⚠ Reports v2 pages are a Vue SPA (fetching the URL returns a shell). Customers page = imported contacts, not payers. "Accounts Created" Oct 2026 = the import. A vendor "Demo Account"
  holds test invoices — exclude. Check-in isn't used, so bookings ≈ attendance.
- Payments: Stripe (new TeamUp-connected account; saved cards being copied from the BSport Stripe
  account via DaySmart support, requested 5 Oct — until done most members show "Missing payment
  details"). No payouts to the bank yet as of 12 Oct.
- Snapshots land in `data/teamup/` as dated CSVs (first set 2026-10-12: customer-memberships,
  upcoming-billing). Spec: `brain/specs/teamup-pilates-pull.md`.

## Pilates (HISTORICAL, to 23 Sep 2026) → BSPORT — RETIRED 12 Oct 2026, replaced by TeamUp above
- Backoffice: https://backoffice.bsport.io (Krish's login via Chrome — same access pattern as Playtomic).
- **Reporting section is the workhorse** (Reporting → report catalog): each report has date presets
  (Week/Month/Year-to-date, Last week/month/year, Custom) + GENERATE REPORT; read the Average/Total
  tiles and the Detailed report table (50 rows/page, paginate). Key reports:
  - **Payments → Total payments**: daily collected revenue by method (by PAYMENT date).
  - **Studio → Subscription**: every subscription with product, recurring amount, billing dates,
    last-payment status (catches failed payments), auto-renewal.
  - **Products → Passes**: active passes/memberships as of a single date, with remaining credits
    and deferred revenue (⚠ this report takes a single as-of date, not a range).
  - **Bookings → Bookings per day (group activities)**: daily bookings/cancellations/attendance.
  - Also available, unused so far: Ledger, Unpaid invoices, Members' purchases, Promotions,
    Activities per teacher/establishment, New members, Sessions.
- Calendar page = live schedule with per-class fill (e.g. "2/10 · 20%") and a Weekly overview tile.
- Members page = registered contacts , NOT paying members — use Subscription+Passes for that.
- ⚠ Quirks: reports sometimes fail with "Something went wrong" — regenerate and wait ~5-10s;
  zero-activity days are omitted from daily tables; DOWNLOAD REPORT exists but scraping the
  table via JS is the proven path. Product names differ from FOH-handbook names ("Half price
  monthly unlimited" = Founding Unlimited £150).
- Snapshots land in `data/bsport/` as dated CSVs (first set: 2026-07-08 payments-daily,
  subscriptions, passes-active, bookings-daily).
- Historical pulls after the TeamUp move still work (13 Oct 2026): Classic Reports → Sessions is
  `api.production.bsport.io/business-insights/v0/reporting/reports-v2/<REPORT_ID>/serialized_report/` with
  `date_start/date_end`, `use_cursor_pagination=true`, Token header from the backoffice tab — see facts 2026-10-13.
  Full 1 Jul–12 Oct session log with teacher/cancelled/attendance: `data/bsport/2026-10-13-bsport-sessions-1jul-12oct.tsv`.
- **ALL BSPORT SUBSCRIPTIONS TERMINATED 14 Oct 2026** (Krish ask: nobody pays BSport after 20 Oct). Member
  subscriptions = `GET api.production.bsport.io/buyable/v0/subscription/billing-plan/?page_size=100` (
  status 1 In progress / 2 Terminated / 3 On hold / 4 Finished; `next_billing_date`, `planned_invoices`).
  Invoices = `buyable/v0/subscription/planned-invoice/?page_size=500` (the `billing_plan=` filter is IGNORED —
  filter client-side; status 0 paid / 1 failed / 2 pending / 3 cancelled / 4 open-unpaid). Terminate =
  `PUT …/planned-invoice/<id>/flag_as_last/` `{note}` — the UI dialog only lists PENDING invoices, but the
  API accepts an already-PAID one, which ends the plan with zero further charges (expiration = end of the
  paid period). Status-4 open invoices are NOT cancelled by it (dead payment method, uncollectable).
  The backoffice routes API calls through a service worker, so the Chrome network tool misses them —
  patch `XMLHttpRequest.prototype.open` in-page to discover endpoints. Pre/post snapshots:
  `data/bsport/2026-10-14-bsport-subscriptions-{pre,post}-cancel.csv`, `…-planned-invoices-post-cancel.csv`.
- The Pilates weekly (instructors, Sun eve) remains the human cross-check; BSport is now the
  primary/verifiable source.
- **ADMIN FLOWS (VERIFIED LIVE 2026-07-23):**
  - Class TYPES ("Group activities"): My studio → Group activities (/activity) → ADD A GROUP
    ACTIVITY. 3-step wizard: 1 create (image, title, category shown in member app, description,
    colour, Conditions: booking-window close/open [default open 180d], late-cancel policy) →
    2 optional add sessions → 3 finish. Existing activities have duplicate/edit/delete icons;
    archived section at bottom.
  - Class SESSIONS on the timetable: Calendar → ADD SESSIONS → pick activity → form: custom name,
    slots, waiting list, level, establishment, credits, hybrid toggle; Time & date (+ Recurring
    toggle for weekly repeats); Teacher (+ payroll rule); Settings (bookable web+app toggle,
    aggregator bookings toggle — ClassPass/USC/Wellpass/Wellhub); Tags → SAVE.
  - MEMBERSHIPS (recurring): Products → Subscriptions (/subscription/contract) → ADD A
    SUBSCRIPTION: name, description; Included = ONE of appointment-passes/passes/packs (select
    the pass it grants each cycle); recurring price + joining fee; Invoicing (on purchase date
    or fixed day, repeat every N months, number of invoices = contract length, auto-renewal
    toggle); Terms (required). Available vs Unavailable lists; person+ icon assigns to a member.
  - PASSES / one-off products: Products → Passes (/payment-pack) → ADD A PASS: name, description,
    category, price incl. VAT + VAT%, universal-pass toggle (adds twin appointment pass),
    recommended toggle, credits Limited(N)/Unlimited, validity (days/months/years or fixed date
    range), Conditions (max usage day/week/month, max purchases per member, only-new-members,
    hidden to members/staff, on-site payments, duration of sale, restrict booking times,
    limit by category/establishment/ACTIVITY). A 1-credit pass limited to one activity = a
    one-off class product (e.g. "Mat Pilates and Lattes" 1 credit £5).
  - Mental model: ACTIVITY (what it is) → SESSION (when it runs) → PASS (right to book, credits)
    → SUBSCRIPTION (recurring wrapper that grants a pass every billing cycle).

## Cost & revenue ACTUALS → XERO (VERIFIED LIVE 2026-07-08)
- go.xero.com, org "Encourt Padel Limited" (Krish's login via Chrome). FY runs Jul–Jun —
  ⚠ default P&L range is "this financial year", which hides everything before 1 Jul; use
  Reporting → Profit and Loss → format "Current and previous 3 months" (or set custom dates).
- All Xero P&L figures are NET of VAT. Revenue lines: Booked Events, Equipment Hire, Membership,
  Merchandise, Padel Courses, Pay to Play, Reformer-Pilates, Square Sales.
- Square till data flows INTO Xero ("Square Sales" turnover line + "Square Fees" cost) — no
  separate Square pull needed at current volumes .
- Snapshots → `data/xero/` (first: 2026-07-08 monthly P&L Apr–Jul).

## Staff hours & rota → ROTACLOUD (VERIFIED LIVE 2026-07-08)
- app.rotacloud.com (Krish's login via Chrome), account "Encourt Padel Ltd", one location. Financials → Reports → Hours & Costs (Daily/Monthly/Role Totals).
- ⚠ Costs cover HOURLY staff only — salaried roles (ACM, Club Manager, Director) show hours but
  no £. Cross-check salary costs in Xero "Salaries" line.
- Snapshots → `data/rotacloud/`.

## Instagram → @encourtpadel (VERIFIED LIVE 2026-07-08)
- instagram.com logged in as the club account; Professional dashboard → Insights (30/90-day
  windows). Snapshots → `data/instagram/`.

## Other sources (scaffold — verify against the Bible when it lands)
- Member status (active / lapsed / renewals) → Playtomic direct (the AM's extract was DROPPED in the
  30 Jun reporting revision)
- Maintenance → maintenance lead, Monday forward-looking report (not "Will", not Friday)
- Email → Gmail connector (LIVE: <owner-email>, daily 09:00 triage)
- Corporate events → Xero + the advisor's notifications; Square for till; Wigmore self-reported
  (none of these verifiable with current AI access — treat as unverified lines)
- Pure-P2P sheet ★-ledger → `data/sessions/purep2p-sheet-ledger.csv` (append-only; every name
  ever given on a desk sheet, by date + participant_id; feeds the repeat-star rule; NOT a
  day-snapshot — never trash)
