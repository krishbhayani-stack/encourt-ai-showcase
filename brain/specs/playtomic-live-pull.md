# Spec — Playtomic Live Pull (shared plumbing)

Ground truth for the `playtomic-live-pull` skill. Written 2026-07-30, distilled from every live
pull 14–29 Jul (facts.md). This is the ONE place the manager-API method and its traps live.
Every other skill that touches live Playtomic (purep2p-desk-sheet, lapsed-winback-call-sheet,
churn-conversion-monitor, member-census, revenue-kpi-review) follows THIS spec instead of
re-learning it. When a new trap is discovered, it gets added HERE (and to facts.md), not
duplicated into each consumer skill.

## Access

- Backend: `https://manager.playtomic.io`, tenant id `<TENANT_ID>`,
  Krish's login via Chrome. No official public API — this is the app's own internal API,
  captured/replayed from inside the logged-in manager tab. Unofficial: endpoints can change.
- **SAME-ORIGIN ONLY.** Fetch relative paths (`/api/v1/...`, `/api/v2/...`) from inside the
  manager tab. Cross-origin `https://api.playtomic.io/...` fails CORS with
  `TypeError: Failed to fetch` — it masquerades as an auth error but isn't.
- **Bearer token**: localStorage `playtomic:auth` → `accessTokens.tenant[<tenant-id>]` is an
  **object `{value, expiration}`** — the bearer is `.value` (passing the object → 401).
  Token lives ~1h; on 401 reload the page and re-read.

## Endpoints (verified)

| What | Endpoint | Notes |
|---|---|---|
| Bookings for a playing date D | `/api/v1/bookings?tenant_id=<tid>&page=0&size=300&sort=start_date,ASC` + `start_booking_date=(D-1)T23:00:00Z&end_booking_date=DT22:59:59Z` | full UTC ISO or 400. Participants in `participant_info.participants[]` |
| Payments | `/api/v1/club_payments` + `start_payment_date`/`end_payment_date` UTC ISO | 200/page, ~40-page cap per query window |
| Members of a category | `/api/v2/users/suggestions/category_members?category_id=<id>&filter=&page=<n>&size=100&sort=fullName%2Casc` | **THE member source** (tag-based, includes club-assigned). `filter=` and `sort=` are MANDATORY — omit either and it 400s (pinned 17 Aug, trap 21). Returns the full user object per member: user_id, full_name, email, phone, accepts_commercial, tenant_tags+expires_at. Counts match the rendered Benefits UI exactly. Intro category = `<INTRO_CATEGORY_ID>` |
| One person's bookings | `/api/v1/bookings?tenant_id=<tid>&participant_id=<user_id>&page=&size=200` + date params | **`participant_id` is a working server-side filter; `user_id` is silently IGNORED** (returns everything). The cheapest per-member play history, and the way to verify any per-person count without sweeping the club (found 17 Aug) |
| Benefits list (member counts) | Rewards & Offers → Benefits page (UI scrape) | per-benefit member counts; the census source |
| Vouchers/promo codes | Rewards & Offers UI, slide-panel DOM scrape at codesSize=100 | API fetch 401s; panel name updates BEFORE codes table — stale-check each campaign |
| User's LIVE membership | `/api/v2/users/<id>?tenant_id=` → `tenant_tags[].tags_details` type `ANEMONE_CATEGORY` (+`expires_at`) | the live per-user membership check by user-id — no UI scrape, no name matching (found 7 Aug). Same call returns email/phone/`accepts_commercial` |
| One person's PADEL level | `/api/v1/levels?user_id=<id>` | array; take `sport_id==='PADEL'` → `level_value`. ONE user per call (no batching — trap 24). Empty array = no level. Floor is 0.50 |
| Category id→name map | `/api/v1/categories?tenant_id=` | 25 categories incl. every membership product; v2 404s |
| Benefit/category CONFIG (read & write) | `GET/PUT /api/v1/categories/<id>?tenant_id=` | full config object per benefit: `booking_privilege`, pricing, `allow_single_payment_when_price_is_customized` (the "Players can pay the full booking with their benefit" checkbox — false = that benefit's holders are forced to split-only). Write = PUT the FULL GET object back with fields changed (that's exactly what the manager UI does); verify with a re-GET (trap 29) |
| Classes/clinics list (schedule) | `/api/v2/classes?tenant_id=&size=100&page=N&sort=start_date,DESC` | returns PUBLIC + PRIVATE classes (`type` field — UI Clinics tab shows PUBLIC only); booked = `registration_info.registrations.length`, level bands/max = `registration_info.restrictions_configuration`, coaches/resources/price on the object; times UTC; see trap 16. Detail: `/api/v2/classes/<id>`. Tournaments: `/api/v1/tournaments?tenant_id=` (v2 blocked) |

## Known traps (append-only — never re-learn)

1. **UTC times.** All API timestamps are UTC; club runs BST → +1h before any daypart math.
2. **club_payments ignores `product_sku` server-side** — every page mixes all SKUs. Filter
   client-side (e.g. `product_sku === 'BENEFIT_PURCHASE'`). Skip `status === 'REFUNDED'`.
3. **40-page cap** (~8000 rows) per club_payments query → sweep in ~6-day windows so no window
   hits the cap (14 Jun–29 Jul = 8 windows, ≤11 pages each). A single wide pull silently caps
   and returns wrong totals.
4. **Delete `start_service_date`/`end_service_date`** before setting payment-date params —
   the filters intersect and return almost nothing.
5. **`benefit-subscriptions` has NO `valid_until`** — intro expiry = latest £99/£100
   BENEFIT_PURCHASE payment + 1 month.
6. **Match by user-id, never by name.** Participant id is
   `participant_info.participants[].participant_id` (NOT user_id/userId); opt-in is
   `accepts_commercial_communications` on the same object. Payments export has a `User id`
   column. Bare names collide ("Lewis" £0-by-id was credited another member's spend by name —
   caught twice). Conversion-list £ matches by EMAIL only. **The inverse also bites (19 Aug):
   hand-typing an id→name map to feed a verification call scrambled five of twelve pairs
   (one id was mapped to the wrong person) and would have printed the wrong phone against the
   wrong person. Always derive the id/name join programmatically from the pull or the script
   output, and let `/api/v2/users/<id>` confirm the name it belongs to.**
7. **Getting bulk data out of the page**: the JS bridge caps tool-result echo ~1.1k chars and
   blocks outputs echoing query strings; Chrome blocks repeated programmatic blob-downloads
   after the first. Reliable path: write payload into the DOM
   (`document.body.innerHTML='<pre>'+data+'</pre>'`) and read with `get_page_text` (≤50k),
   chunking if bigger. First blob-download of a run does work — spend it on the largest file.
8. **Reports module** (`/dashboard/reports/metrics/*`) 404s/hangs since ~14 Jul — don't rely on
   it; passive fetch/XHR capture of the app's own calls works, direct URL replay gets 403.
9. **Page "Total" tiles are untrusted** (tile vs row-level sums disagreed) — sum rows.
10. **SPA freezes under heavy paging** — open a fresh tab and continue.
11. **Revenue is by PAYMENT date** not play date; headline revenue EXCLUDES wallet.
12. **Bookings response fields are `booking_start_date`/`booking_end_date`** (plus
    `activity_name`/`course_name`, `booking_type`, `is_canceled`) — there is NO `start_date`
    on the booking object even though the sort param is `sort=start_date,ASC`; slicing
    `start_date` silently yields empty times (caught 3 Aug).
13. **£100 BENEFIT_PURCHASE is (now) usually an Access Monthly renewal, NOT an intro** (caught
    5 Aug). Trap 5's "£99/£100 = intro" fingerprint over-matches: recurring Access Membership
    Monthly bills £100/mo as `product_sku=BENEFIT_PURCHASE`, timestamped exactly on the hour
    (renewal cycle). All 16 £100 rows 23 Jul–5 Aug were Access renewals (every buyer on the
    3-Aug Access Monthly list); genuine intro purchases in that window were all £99 at
    odd-second timestamps. `recurring_configuration_id` does NOT discriminate (present on
    both £99 and £100 rows). Rule: price alone is not enough — verify intro purchases against
    the intro member list / history, and treat on-the-hour £100 rows as membership renewals.
    (Legacy May–Jun "£100 Introduction to Off-Peak" variant rows in the 15-Jul history predate
    this.) User detail (email/phone for an id): `/api/v2/users/<id>?tenant_id=` — v1 404s.
    **13c (caught 14 Aug, by Krish challenging "one member ×3"):** the legacy-era version of the
    same over-match — May–Jun £100 BENEFIT_PURCHASE rows counted as "£100 intro variant"
    purchases include **Access Membership Monthly starts/renewals** (Access billed £100 as a
    benefit earlier than the ~17 Jun era boundary assumed). The 15-Jul history and 10-Aug
    census both carry this error: 16 of the census's 47 "multi-intro" people (16 named members, redacted) are Access Monthly payers, never intro re-buyers. Any multi-intro claim
    from those files MUST be cross-checked against a product-level source — the 12-Jul
    subscription-status run (`current_membership` column), the customers CSVs (category
    column), or live tags — and the tells are monthly same-day cadence + on-the-hour
    timestamps + current Access status.
14. **Bookings endpoint silently truncates long date windows** (caught 5 Aug): a single 26-day
    query returned 493 rows and dropped bookings that per-week queries then surfaced (a 10-Aug
    open match missing from the wide pull; same-day windows summed to 505+). No error, no cap
    signal — results just go missing, and the bogus `sort=start_date` field (trap 12) makes
    pagination order undefined. Sweep bookings in windows of **≤7 days**, same discipline as
    the club_payments 6-day rule (trap 3). **HARDENED 7 Aug: 7-day windows ALSO truncate** —
    a 1–8 Aug window silently dropped 3 open-match rows (two members, 3–4 Aug) that
    2–3-day windows then surfaced. Rule now: bookings sweeps in **≤3-day windows**, and for
    anything money-relevant (refund hours) union two passes at different window sizes and
    treat the result as a floor.
15b. **Legacy membership-subscription era, 11 May–16 Jun** (caught 7 Aug, completed by Krish's
    correction): the original memberships were "Membership subscriptions", NOT benefits. They
    bill as SKU `Membership purchase` in the payments export and **`MEMBERSHIP_PURCHASE` in
    the live API** (UI product filter: "Membership Subscription"). 244 API rows 11 May–16 Jun;
    the export starts 24 May so **all 118 rows from 11–23 May exist ONLY in the API/UI** —
    any "since the club opened" question MUST sweep the API from 11 May with BOTH SKUs.
    Club's first-ever Playtomic payment: **2026-05-11T14:52:58** (Jan–Apr verified empty);
    launch-day bulk membership enrolment 13 May 11:01–12:00; second billing cycle 13 Jun;
    benefits replace subscriptions from ~17 Jun. Early prices: £80 Access-Launch, £720
    Access-Annual-Launch, £210 OP+Wellness, £2,300 OP+W Annual.
15a. **club_payments `total` is a STRING** ("160 GBP", refunds "-160 GBP") — parse the number
    out; there is no numeric amount field on the row (caught 7 Aug). Price fingerprints:
    OP+Wellness = £210 (£160+£50 add-on), annuals = 10× monthly (£1,600/£2,100/£1,290/£1,000);
    legacy "& Wellness" products bill £210 same as current "+ Wellness".
16. **`/api/v2/classes` list ignores `start_date`/`end_date` server-side** (caught 10 Aug —
    same family as trap 2): any date params return the full history since May. Page with
    `sort=start_date,DESC` + `size=100` and filter the window client-side (~3 pages covers a
    month). The list also includes PRIVATE classes the UI Clinics tab hides — filter on `type`
    when reconciling against the UI count.
17. **Refund-to-wallet creates PAID `WALLET_RECHARGE` rows** (caught 11 Aug, closure day):
    refunding a booking as club-wallet credit books a POSITIVE `product_sku=WALLET_RECHARGE`
    row with status PAID, service-dated at the CREDIT moment. A service-date day sweep
    therefore inflates "revenue serviced that day" by every wallet credit issued that day
    (a large share of one day's PAID total was wallet credits). Rule: exclude
    WALLET_RECHARGE from service-revenue sums, and report day revenue as gross PAID (service
    SKUs) plus the RF net for that day — refund pairs cancel, unmatched negatives net off
    still-PAID originals.
18. **Bulk data out: page→localhost is fully blocked** (caught 11 Aug): Chrome's Private
    Network Access stalls fetch (cors AND no-cors) from the manager tab to 127.0.0.1
    indefinitely, and sendBeacon returns true but silently never delivers.
    `navigator.clipboard.writeText` needs window focus; `execCommand('copy')` returns false
    via the bridge. Working bulk-out paths remain exactly two: DOM-write + get_page_text
    chunks, and the run's ONE blob-download (trap 7).
19. **A live ANEMONE_CATEGORY tag can exist with NO active benefit subscription behind it**
    (caught 14 Aug: a member with an intro tag expiring 22 Sep, subscription INACTIVE, no
    purchase since 27 Jun — manual club-side category grant). Pricing/registration honors
    the TAG (£0 open-match registration), but benefit member lists and the census only see
    SUBSCRIPTIONS — such people are invisible to every member-list-based count. For any
    "who really has access" question, reconcile tags (`/api/v2/users/<id>` tenant_tags)
    against `/api/v1/benefit-subscriptions?benefit_id=<cat>&user_id=<id>&status=ACTIVE`
    (verified working param shape; bare/other combos 400). Member-page capture also showed
    the UI batches user_ids from category_members — replay needs its captured params.
    **KRISH STANDING RULE (14 Aug): the intro GAMING AUDIT runs from the Chrome UI every
    time** — scrape the rendered Benefits → Members page (paginate all pages; the Billing
    column is the tell: "One time" = paid subscription, "-" = manual club-side grant with no
    payment behind it), cross-check against local reference CSVs, and deliver a PDF of every
    possible gamer. API replays are NOT the source for this audit.
20. **Customers-export schema changed (caught 17 Aug).** The Customers → export CSV is still the
    fastest full-book pull (UI: export icon → GDPR "Accept & Export" T&C gate → server prepares →
    Download; **the T&C acceptance needs Krish's explicit OK each time**), and it ALREADY carries
    the Playtomic level as the **`PADEL` column** (verified against rendered profiles: CSV 4.49 =
    profile "Sport Padel / Level 4.49"; blank = the profile has NO Sport/Level tile, i.e. no level
    on the account). But since 9 Jul: (a) column ORDER changed and `category_name`/
    `category_expires` are now `category`/`category_expiration` — positional parses of the old
    file break silently, always read by header; (b) **`commercial_communications` is tri-state**
    `accepted`/`rejected`/`undefined`, not the old `true`/`false`. The UI renders BOTH `rejected`
    and `undefined` as "Opted out", so **marketable = `== 'accepted'` only**. A truthiness test
    counts `"undefined"` as opted-in and overstated the marketable base several-fold on the 17-Aug file
    . Newest reference file:
    `data/playtomic/2026-08-17-customers-raw-export.csv` .
15. **Pending games count (Krish standing rule, 5 Aug — constitution.md Hard rules).** A person
    registered in a game is IN, even when the game/booking status is PENDING (open match not
    yet full, unconfirmed, awaiting players). When tallying per-person games/hours, filter on
    `is_canceled` only — never on a pending/confirmed status field, and never drop
    not-yet-full open matches. Applies to every source: bookings API, rendered-schedule
    scrapes, exports.

21. **`benefit-subscriptions` silently misses every club-assigned member** (caught 17 Aug — the
    general case of trap 19). `/api/v1/benefit-subscriptions?benefit_id=<cat>&status=ACTIVE`
    returned **0** for Platinum (invoiced), Access Membership Annual (invoiced), Off Peak
    Membership Annual (invoiced), Access Membership - interim solution and Encourt Staff Perk —
    real members — because those people hold the category TAG with no subscription record.
    A tier census built on it understates the book by ~20%. **Always take membership
    from the tag endpoint `category_members`** (see the endpoint table for the mandatory
    `filter=`/`sort=` params); use `benefit-subscriptions` only to answer "is there a paid
    subscription behind this tag", never "who are the members".
22. **Play-frequency counts are a FLOOR, not a count of games played** (established 17 Aug).
    A person is only counted where they are a REGISTERED participant on the booking. OPEN_MATCH
    always carries all four players (average participants = exactly 4.00 over 474 matches), but
    REGULAR_BOOKING averages 2.96 registered of a nominal 4 — so someone playing as the
    unregistered guest on a friend's court booking is invisible. Say "floor" whenever quoting
    per-person games. The under-count rule is identical across tiers, so cross-tier comparisons
    are sound; absolute per-person totals are not. `family_member_id` is null on every booking
    checked (0 of 1,962) — no family-account leakage to chase.

23. **Classes: registrations have NO status; `max_players` is the true cap; money is a 3-step
    fallback** (caught 21 Aug, the socials/Americanos occupancy run).
    `/api/v2/classes` → `registration_info.registrations[]` carries **no status/cancelled field** —
    every entry listed is a live registration, so booked = array length (and `booked +
    available_places == max_players` checks out on every row). `restrictions_configuration.max_players`
    is the **whole-session seat cap even when the session spans several courts** — the Monday Ladies
    Americano is 20 seats across 5 `resources`, NOT 5x4; never multiply by court count.
    Per-registration revenue must be read `payment.payment_price` → `custom_price` → `price`, in
    that order: member rates land in `custom_price` (£10 against a £20 list `price`), so summing the
    headline `price` overstates take.
    **Completeness**: unlike bookings (trap 14), the classes list does NOT silently truncate — a
    DESC sweep and an ASC sweep over the same window returned identical 288-id sets. Verify that way
    rather than assuming. Date params are still ignored server-side (trap 16) — filter client-side.
    **Americanos/socials can live in EITHER module**: `/api/v1/tournaments?tenant_id=` (v1; v2
    blocked) holds `type: AMERICAN` events — 13 rows all-time, none 21 Jul–21 Aug, but Jun–early-Jul
    Friday Club Nights and the 5 Jul Social Americanos ran there. Any "how did our socials do"
    question must check BOTH endpoints before claiming coverage.
    **Analysis rule**: split cancelled sessions into *zero-booked ghosts* (calendar noise — exclude
    from occupancy denominators) and *cancelled-with-bookings* (a customer-trust number, report
    separately), and exclude exogenous closure days (e.g. 11–12 Aug fire) from every denominator.

24. **Per-user level: `/api/v1/levels?user_id=<id>`** (found 21 Aug by hooking the customer-profile
    page). Returns an array of level objects; take the one with `sport_id === 'PADEL'` and read
    `level_value` (also `level_confidence`, `status`, `last_modified_date`). **One user per call — there
    is no batching**: repeating `user_id` or comma-joining ids silently returns only the first. At ~10-way
    concurrency the whole book takes ~20s. An empty array = the account genuinely has no
    padel level (matches a blank `PADEL` cell in the customers export). Playtomic's floor is **0.50**, not
    0 — a large block of untouched accounts sits exactly on 0.50, so any level banding must treat 0.5–1 as
    its own band rather than folding it into "1–2".

25. **`/api/v1/tenant_profiles` cannot be paged to completion — it is NOT a roster** (caught 21 Aug).
    This is the Customers-page list endpoint (`tenant_id`, `filter`, `page`, `size`, `sort`) and it carries
    the useful `customer_profile.tenant_tag[]` (benefit + expiry) per person. But a full sweep reports
    more rows across its pages than **unique** user_ids: pages overlap
    deterministically (page 1 repeated 103 of page 0's 200 rows). `sort=` is **ignored server-side** —
    fullName/createdAt/email, asc or desc, all return byte-identical page sets, so no ordering trick
    reaches the missing third — and `filter=` is a narrow prefix match (`filter=a` → 12 rows), useless as a
    partition key. Repeat passes and varied page sizes converge and stop short. **Rule: take the roster
    from the Customers UI export (trap 20), and use tenant_profiles only for per-person tags/benefit.** The
    21-Aug level census built its roster as export ∪ tenant_profiles.

26. **Bulk-data transport has degraded to ONE working route (caught 21 Aug).** The
    blob-download half of trap 7 is now fully blocked — a programmatic `<a download>` click
    fires, reports success, and no file ever lands in ~/Downloads (verified twice in one run).
    Worse, **gzip + base64 through the DOM returns length-correct but CRC-corrupt bytes**
    (9,548 b64 chars in, 9,548 out, `BadGzipFile: CRC check failed`) — the bridge appears to
    rewrite content in place, the same mechanism behind its `[BLOCKED: JWT token]` /
    `[BLOCKED: Sensitive key]` redactions. **Never trust base64/binary through the bridge.**
    `navigator.clipboard.writeText` → `pbpaste` was also tried (it would keep the payload out
    of context entirely) and fails with `NotAllowedError: Document is not focused`, because the
    MCP tab is never the focused window. **The one reliable route: emit a compact delimited
    TEXT dump (`~`-separated, one line per record), read it with `get_page_text`, and verify on
    disk by line count + byte count.** Expect the byte count to exceed the page's char count by
    one per non-ASCII character (JS counts UTF-16 units, `wc -c` counts UTF-8 bytes — an `é`
    in a name costs 1 extra byte each time it appears) plus 1 for the trailing newline. A
    compact dump is ~1/3 the size of the equivalent JSON, so a full day of bookings fits in a
    single read.
27. **A lone 403 is not an auth failure — CloudFront throws it transiently (caught 21 Aug).**
    `category_members` returned 403 twice in a row, survived a full page reload and token
    re-read, then returned 200 seconds later with the *same* token; the tab meanwhile rendered
    CloudFront's "ERROR: The request could not be satisfied" page while the API kept working.
    Retry once before concluding the session is dead, and never throw away in-page state
    (a reload loses `window.*`) on a single 403 — stash anything expensive in `sessionStorage`
    first, it survives the reload.

28. **`/api/v1/levels` rate-limits hard, and the bulk-out transport has a new best route (caught
    28 Aug, the all-bands daypart run).** (a) ~1,800 rapid levels calls trip CloudFront: first a
    403 wall (clears in ~1–2 min, trap-27 family), but after resuming, individual ids can HANG —
    fetches that never resolve nor reject, surviving page reload . Hung fetches also wedge the tab: `get_page_text`
    waits for document_idle forever. (b) Do NOT pace in-page loops with `setTimeout` — Chrome's
    intensive throttling in a BACKGROUND tab clamps timers to ~1/min after ~5 min and the loop
    stalls mid-run; batch between tool calls instead. (c) `get_page_text` extracts the ARTICLE
    element (`<main>`) — a dump `<pre>` appended to `document.body` is invisible to it; append
    INSIDE `<main>` on a HEALTHY tab. Never `document.body.innerHTML=` on the SPA — destroying the
    React root throws it into a busy error loop that blocks document_idle permanently (screenshot
    injection too). (d) **Best bulk-out transport now: `browser_batch` with several
    [set-pre-text → get_page_text] pairs — an oversized batch result is SAVED TO A LOCAL FILE by
    the harness** (tool-results dir, JSON array of outputs), skipping the ~1.1k echo cap, the 50k
    page-text cap and context entirely. One batch moved 129k chars to disk. (e) Booking rows have
    **`booking_id`**, not `id`; multi-court classes and double-court group bookings appear as
    several rows sharing identical start+participants — for per-person analyses dedupe on
    **(participant_id, start)**, and note person×slot dedupe gives ~7% fewer rows than the 21-Aug
    per-row count (not comparable). (f) First real court booking in the API is **30 May** — playing
    dates 11–29 May are genuinely empty (memberships predate court play).

29. **Split-payment lockout is a PER-BENEFIT flag, not a club setting (caught 1 Sep).** The player-app
    message "This club only allows split payment" comes from `allow_single_payment_when_price_is_customized:
    false` on the individual category/benefit — UI home: Rewards & Offers → Benefits → benefit →
    **Rules** tab checkbox "Players can pay the full booking with their benefit". It is nowhere in the
    Settings hub (Venue/Booking, Courts, Pricing, Onsite payment methods all swept — don't re-search).
    Editing config = `PUT /api/v1/categories/<id>?tenant_id=` with the **full GET object** (the UI PUTs
    the whole object; a partial body is untested — never send one). Always re-GET to verify. Related
    bridge trap: a long in-page await loop dies at the 45s CDP cap but KEEPS RUNNING in the page —
    write results to sessionStorage and read them back later instead of waiting on the call. On 1 Sep the flag was
    enabled on all 24 live benefits on Krish's ask, then **REVERTED to off on all 24 the same day on
    Krish's ask** (both verified; facts entries same day) — split-only everywhere IS the intended
    state as of 1 Sep. Never flip it in either direction without a fresh explicit Krish ask.

30. **The payments EXPORT understates day revenue — it omits club-wallet-PAID amounts (caught
    7 Sep, the insurance 21/22-Jul addendum).** `payments_24may-22aug.csv` (and any Customers →
    payments export) is a payout-view: for a service-day sweep it reproduces `club_payments`
    row COUNTS exactly, but rows PAID from club-wallet balance carry no card transfer and their
    amounts are missing from the export's totals (the gap equals that day's wallet-paid revenue). It
    also relabels: Quick Pay folds into "Credit card". Rule: money-grade day figures (insurer
    packs, revenue claims) come from live `club_payments` only; the export is for spend
    attribution and person-level joins. Same family as trap 11's "headline revenue EXCLUDES
    wallet".

31. **`benefit-subscriptions` now carries `valid_until` + `canceled_at` — and that pair IS the
    "Cancellation requested" badge (found 14 Sep).** The subscription object schema grew since
    trap 5 was written (trap 5's "no valid_until" is stale for the CURRENT schema; intro expiry
    math for historical rows still stands). Playtomic's new Customers → profile → Benefits badge
    "Cancellation requested / Access continues until <date>" renders exactly `status: ACTIVE` +
    `canceled_at != null`, with `valid_until` = the access-end moment (UTC; +1h BST — verified
    to the minute against a rendered member profile, 12:54:16Z = 01:54 PM). The endpoint
    accepts ONLY `status=ACTIVE|INACTIVE` (anything else 400s), so "cancellation requested" is
    NOT a status — sweep every category's ACTIVE subs and filter `canceled_at`. Also: a bogus
    `benefit_id` returns 200/empty (no validation), so a 0-row result never proves the id was
    right. Full-club sweep is cheap: 26 categories ≈ 26 fetches.

32. **`bookings?participant_id=` with NO date params returns UPCOMING bookings only (caught
    15 Sep, a single-member check).** A past-only player returns 0 rows and looks like
    a never-player — the endpoint-table's "cheapest per-member play history" claim holds ONLY
    with explicit `start_booking_date`/`end_booking_date` windows (≤14-day windows worked for
    a single participant; club-wide sweeps keep the trap-14 ≤3-day rule). Related reminder the
    same check underlined: club-granted category tags (trap 19) leave NO purchase payment and
    £0 open-match rows, so every payments-built history/pool (15-Jul + 31-Aug intro histories,
    conversion pools) is structurally blind to those people — that member was missing from the
    intro history AND the 344-row conversion pool for exactly this reason.

33. **Lapsed-billing leavers are INVISIBLE to the trap-31 cancellation sweep — their INACTIVE
    subs carry NULL valid_until/canceled_at (caught 21 Sep, a member challenge).** A member
    whose renewal simply fails/stops gets status INACTIVE with no dates and never shows a
    "Cancellation requested" badge, so they appear on no save-call sheet and no
    valid_until-filtered sweep. Rule: any "who left" question must ALSO pull each category's
    INACTIVE subs with null dates and date the exit by **last-payment cadence** (last
    BENEFIT_PURCHASE + 1 month = due date; no row at due date = lapse). Corroborate with £0
    OPEN_MATCH_REGISTRATION rows — a £0 registration proves the member tag was alive that
    day (trap-19 family). Related same-day finds: (a) **benefit RENAMES fake new products** —
    "Off Peak Padel PLUS" is the renamed legacy "Off Peak Padel & Wellness" card, so the
    tracker ledger's 7-Sep "first appearance" is a rename artifact and mid-month £210 rows
    are anniversary renewals, not new sales; match rosters via the 21-Aug census
    `benefit_tiers` to detect renames. (b) A **flat member count is join−leave, never "no
    movement"** — always reconcile joiners (odd-second BENEFIT_PURCHASE rows; renewal rows
    sit on-the-hour ≤ ~20s) against leavers before reporting zero churn. (c) A club-side
    product SWITCH can land with NO payment row (one member OP+W→PLUS). (d) A cancel can
    strip the tag despite paid-up valid_until (one member: paid 4 Sep, cancelled same day, tag
    gone with valid_until 4 Oct — check for owed access/refund).

34. **`benefit-subscriptions` page size is capped at 200 (caught 16 Oct — `size=400` worked on
    14 Oct, now 400s with `PAGE_SIZE_EXCEEDED`).** Page at `size=200` and dedupe by
    `benefit_subscription_id` (ordering across pages is unstable, trap noted 14 Oct); every live
    category still fits one page (largest = 194 classic-intro INACTIVE rows). `tenant_id` is
    accepted but optional. Same day: an **API-only member count is faithful** — `category_members`
    over the 26 categories matched the Benefits UI total to the row — so the tag sweep
    stands in for the UI scrape whenever the UI misbehaves. Also: when the manager tab lands on
    `/auth/login`, the refresh token has died and only Krish can log in (his own Chrome window;
    the MCP tab picks the session up on a plain re-navigate).

37. **Booking NOTES live only on the v1 class detail (caught 28 Oct, the free/unpaid coach-sessions run).** The manager UI's
    "private notes / public notes" on a class or private lesson are NOT in the `/api/v2/classes` list, the `/api/v2/classes/<id>`
    detail, or any `/api/v1/bookings` object — they are `private_notes` / `public_notes` on `GET /api/v1/classes/<id>?tenant_id=`
    (same call also exposes `registration_info.base_price` and `is_manual_price`). One fetch per class; 55 in parallel is fine.
    Payment reading on a registration: `payment.payment_method_type: DIRECT` with `payment_price: 0 GBP` = the manager marked it
    paid-on-site at £0 (a deliberate comp); `payment: null` = nothing recorded at all (unpaid or a £0 self-block). A coach
    booking himself appears as a `PRIVATE` "Private Class" whose only registration is the coach's own player profile at £0 (the head coach has two profiles).

## Snapshot policy (Krish rule, 27 Jul)

Re-scrape-then-trash: every consumer run pulls live data FRESH (never reuse a prior day's
snapshot), writes dated day-snapshots to `data/playtomic/` for auditability, then MOVES them to
Trash (`~/.Trash`, recoverable) once the deliverable is built and facts.md appended. Persistent
reference CSVs (customers / payments export / intro-history / subscription-run / conversion)
are NOT day-snapshots and stay.

## Standing reference datasets (the offline half of every join)

- `data/playtomic/2026-08-28-player-slots-raw-30may-28aug.txt` — **raw person-slot pull, full
  history 30 May–28 Aug**: all live bookings as `MM-DDTHH:MM~pid,...` (UTC) + live levels.
  The offline half of any "who plays when / band × daypart" question — no re-sweep needed. Derived
  aggregate: `2026-08-28-band-by-daypart-30may-28aug.csv` (band×day×hour person-slots, deduped).
- `data/playtomic/2026-08-21-all-customers-levels.csv` — **live level census**:
  `user_id,name_if_member,padel_level,is_member,benefit_tiers`. 
  The default source for any level/standard question; pair with the customers export for email/opt-in.
- `data/playtomic/2026-08-17-customers-raw-export.csv` — **NEWEST full book**; the default customers reference. Read by header, not position
  (trap 20). Name+level deliverable: `reports/raw/2026-08-17-all-customers-with-levels.csv`.
- `data/playtomic/2026-07-09-customers.csv` + `customers_2242.csv` — categories, opt-in, emails.
  Superseded by the 17-Aug export for anything current; keep for historical comparisons only
  (note the old `true`/`false` opt-in encoding — trap 20).
- `data/playtomic/payments_24may-22aug.csv` — **payments export 24 May–22 Aug** (landed 22 Aug,
  T&C gate OK'd by Krish), the £-spend source: schema identical to the old export,
  verified strict superset of the retired 24 May–4 Jul file (now `_archive/superseded-data/`; the
  one extra pre-4-Jul row is a 23:41-BST boundary artifact of the old UTC window). Spend figures
  after 22 Aug are live-sweep floors until the next export.
- `reports/raw/2026-07-12-subscription-status-run.csv`, `2026-07-15-intro-offpeak-full-history.csv`,
  `2026-07-14-nonmember-conversion-list-15-19jul.csv`.

## Fallback

If Chrome/Playtomic is unreachable or the token can't be refreshed: use the newest snapshot or
reference CSV that covers the question, and SAY SO in the deliverable ("stale pull, D-x") and in
facts.md. Never silently substitute stale data.

34. **Classes sweep, courses, tournaments and a clipboard bulk-out path (caught 12 Oct, the coach payment-run
    reconciliation).** (a) `/api/v2/classes` DESC now opens on sessions a YEAR out (recurring sessions pre-created to
    Aug 2027) — budget ~10 pages × 100 to reach the current month, and filter the window client-side as trap 16 says.
    (b) `type` has a third value, **`COURSE`** (term blocks: Saturday/Monday juniors, Junior Academy). Its
    `registration_info.registrations[]` repeats the SAME registrations (same `payment.payment_id`, block fee £100–£200)
    on every session of the block and `program_id` is null — summing per session multiplies the block fee by the number
    of sessions (William's September read 12.5k raw vs 6.6k true). Dedupe registrations by `payment.payment_id`
    (fallback `class_registration_id`) across the window, and process coach-assigned rows BEFORE no-coach rows so the
    duplicate no-coach "twin" course entries (same name/time/kids, coach empty) land at £0. (c) `/api/v1/tournaments`
    objects (type AMERICAN) carry NO coach/organiser field — an Americano run there cannot be attributed to a coach;
    Krish's organiser rule only works in the classes module. (d) **Bulk-out, third path:** a real `computer` click on
    the manager tab (gives the document focus) followed by `navigator.clipboard.writeText(<tsv>)` in the same tab
    SUCCEEDS (53 kB verified) and `pbpaste` in Bash on the Mac reads it straight into a file — faster than DOM chunks and
    needs no download. pbpaste delivers Mac-Roman: decode as `mac_roman` and re-save UTF-8 before parsing.

35. **Chrome 155 local-network gate — in-page bulk-out paths that no longer work (caught 18–19 Oct, the
    membership tracker).** From the manager tab: (a) `fetch`/XHR and even a hidden-iframe FORM POST to
    `http://127.0.0.1:<port>` never resolve — Chrome's Local Network Access permission sits unanswered and
    the JS tool times out at 45 s (the tab stays alive, the sweep result in `window.__out` survives);
    (b) `navigator.clipboard.writeText` needs OS-level focus on the tab — "Document is not focused" from the
    tool, and it HANGS after a synthetic `computer` click (the 12-Oct clipboard path is dead unless Krish
    has clicked into the tab himself); (c) the Chrome-extension `read_network_requests` returns listings only,
    no bodies. **What works: a blob download** — `a.download='<name>.txt'; a.click()` on a Blob of the
    text, WITH Krish's explicit OK first (download = permission-gated), lands in `~/Downloads`, `mv` it into
    the session scratchpad; 117 KB in one shot. Hold the whole sweep in `window.__out` before any bulk-out
    attempt so a failed path costs nothing. Also: **tag expiry is `tenant_tags[].tags_details[].expires_at`**
    (match `tags_details[].tag === category_id`), not a field on the `tenant_tags` entry; and after a fresh
    login the `?return_to=` deep link can still bounce to `/auth/login` — load the plain manager root first,
    then the deep link.

---
Linked: [[Business Data — Playtomic]]

36. **Chargebacks/disputes are INVISIBLE club-side; `club_payments` statuses are PAID/REFUNDED + PENDING/VOIDED/PREAUTHORIZED
    only (caught 19 Oct, a "payment pending" check).** A player's app-side "payment pending" from a card
    chargeback lives at Playtomic platform level: no row, no Pending-tab entry, no profile flag, no `/api/v1/debts` (403). The
    `payment_status=` filter accepts only `PENDING`, `VOIDED`, `PREAUTHORIZED` (comma-joinable; anything else 400s) and `user_id=`
    IS honoured here (unlike bookings, trap-table). Manager's Payments → Pending tab = `payment_status=PENDING,VOIDED,PREAUTHORIZED`
    by service-date window. Each row carries `payment_reference` = `Stripe_GB:ch_…` (the charge id Playtomic support works from) and
    `preauthorization_info`: a PAID row whose `payment_date` equals the refund minute is a **captured pre-auth hold** (the
    capturing row shows `preauthorized_amount`, siblings point at it via `preauthorizing_club_payment_id`), not a same-minute
    purchase. `billing_summary.payout_code` names the settling payout, but `/api/v1/payouts…` is 403/404 and the Payouts tab's
    CSV / "View on Stripe" buttons fire no in-page request from the extension tab — payout lines and disputes are Krish-in-browser
    only. Name/email lookup: `GET /api/v2/users/suggestions?tenant_id=&filter=<text>&page=0&size=20` (full user object; plain
    `/api/v2/users?tenant_id=&filter=` 400s). Also re-confirmed: an in-page sweep loop dies with the tab on any full navigation —
    leave the sweep tab alone and drive the UI from a second tab.
