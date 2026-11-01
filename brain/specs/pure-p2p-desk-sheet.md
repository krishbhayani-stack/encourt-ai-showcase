# Spec — Pure Pay-to-Play Desk Sheet (nightly)

Ground truth for the `purep2p-desk-sheet` skill. Written 2026-07-23 after the 20-Jul manual run
that Krish approved (facts.md 2026-07-20).

## Definition: "pure pay-to-play"

A person walking through the doors on the target playing date who has **never**:
- bought any benefit/promotional offer (intro, day passes, any BENEFIT_PURCHASE at any price), or
- held any membership, current or lapsed, purchased or club-assigned.

Currently-active members, intro-funnel people, and lapsed/expired former members are ALL excluded.
This list exists for one pitch: they spend real money on courts and get no gym/spa/member rates.

## Exclusion sources (check ALL of them)

1. LIVE benefit-purchase sweep — Playtomic manager `/api/v1/club_payments`, product_sku =
   `BENEFIT_PURCHASE`, status != REFUNDED, any amount, from 14 Jun 2026 through the run date.
   (Before 14 Jun is covered by source 3.)
2. LIVE current members of every benefit — at minimum the intro category via
   `/api/v2/users/suggestions/category_members`.
3. `reports/raw/2026-07-12-subscription-status-run.csv` — every benefit purchaser to 12 Jul.
4. `reports/raw/2026-07-15-intro-offpeak-full-history.csv` — all intro takers ever (match by name).
5. `data/playtomic/customers_2242.csv` + `2026-07-09-customers.csv` — anyone with a non-empty
   `category_name` (catches club-assigned/invoiced memberships that never show as purchases).
6. Conversion-list INTRO segment names (`reports/raw/2026-07-14-nonmember-conversion-list-15-19jul.csv`).
7. Staff/coaches: "<head-coach>", "The Club" (and any obvious staff account).

## Ranking

By money first, time second.

**Spend basis (changed 19 Aug 2026 — the post-4-Jul export gap is CLOSED).** £ per user =
payments export **24 May–13 Jun** + a LIVE `club_payments` game-SKU sweep **14 Jun → run date**
(same 6-day windows as the buyer sweep; the two ranges do not overlap, so no double count),
minus that user's refund-to-wallet credits (playtomic-live-pull trap 17). A PAID-only filter is
already refund-clean — both legs of a refund carry status REFUNDED. Take the max of that and the
conversion-list figure (joined by EMAIL only). Still a FLOOR: it starts at the 24 May export and
misses cash/off-platform. Before 19 Aug the ranking used the export alone, which by mid-August
left most survivors at £0 — sheets built before that date are NOT £-comparable with later ones.

**Games = registered-booking count**, from `/api/v1/bookings?participant_id=<id>` in monthly
windows (trap 14), non-cancelled, deduped by booking_id — NOT the count of payment rows, which
over-counts anyone who pays for a whole court (19 Aug: one member 28 bookings vs 42 paid rows). Games are a floor (trap 22), so **£ per game is a ceiling** — label it "≈". Household groupings allowed (e.g. one family) when several family members walk in together.

**Open-match spender scan (Krish rule, 7 Aug).** After the £-ranking, deliberately scan the
day's OPEN_MATCH joiners who have real recorded spend and add the strongest as extra rows —
they are self-paying socially-embedded players, the best conversion profile. Two named
patterns to look for: (a) someone who would complete a **full family/household court** and pays
for themselves, and (b) anyone the run's evidence says is a **likely top conversion** (frequency
climbing, plays with members or heavy P2Ps, opted in, repeat across sheets). These picks go on
the sheet alongside the pure £-ranked rows, within the row cap.

## Output rules

- **5–9 rows** (min 5, max 9; Krish rule 7 Aug — was "top 5–7"), one page, landscape A4, one
  PDF per playing date →
  `reports/briefs/YYYY-MM-DD-purep2p-desk-sheet-<target-date>.pdf` + copy to ~/Downloads.
- **Repeat star (Krish rule, 7 Aug):** any person already NAMED on a previous desk sheet gets a
  ★ next to their name (e.g. "★ Jane Doe") — the desk instantly sees who has been pitched
  before. Ledger: `data/sessions/purep2p-sheet-ledger.csv` (append-only; date,participant_id,
  name — one row per named person per sheet). Check by participant_id, fall back to full name.
  Every run APPENDS its named people (ranked rows + anyone named in cluster footnotes) after
  the PDF is built. The ledger is a persistent reference dataset, NOT a day-snapshot — never
  trash it.
- Columns: rank, name, spent (labelled floor), games, walking-in times BST, phone, opt-in, blank outcome.
- GAMES COLUMN: never print 0. Known count renders as "N + check open matches"; unknown/zero
  renders as "Check open matches" or "Check private/open matches" (Krish rule, 20 Jul).
- Sell box at top: £X+ on courts alone, no gym, no spa, no member rates.
- Footnotes: counts are minimums (open/private matches undercount), spend floor caveat,
  cluster moments (e.g. camp-parent windows), one bubble name.
- API times are UTC — add 1h for BST (verified 20 Jul vs calendar).
- Playing-date window for the bookings pull: `start_booking_date = (D-1)T23:00:00Z`,
  `end_booking_date = DT22:59:59Z`.
- Snapshot every live pull to `data/playtomic/` (dated), log the run in `brain/facts.md`.

## Snapshot policy (updated 27 Jul — Krish)

Every run re-pulls ALL live data fresh (bookings + full benefit-buyer sweep); never reuse a prior
day's snapshot. Write the day-snapshots so the run is auditable, then MOVE them to Trash (`~/.Trash`,
recoverable) once the PDF is built and `facts.md` is appended — day-snapshots do not accumulate in
`data/playtomic/`. The persistent reference CSVs (customers / payments / intro-history /
subscription-run / conversion) are NOT day-snapshots and stay.

## Known traps (learned 20 Jul, don't re-learn)

> Since 2026-07-30 the Playtomic method + traps are centralised in
> `brain/specs/playtomic-live-pull.md` (the shared plumbing spec). NEW traps get appended
> THERE, not here. The list below is kept as the historical record for this skill.

- API host is SAME-ORIGIN: fetch `/api/v1/...` relatively from the manager tab
  (`manager.playtomic.io/api/...`). Cross-origin `api.playtomic.io` → CORS `TypeError: Failed to
  fetch` (masquerades as auth failure). (Learned 27 Jul.)
- `/api/v1/bookings` requires full UTC ISO dates; bare dates → 400.
- `club_payments`: delete `start_service_date`/`end_service_date` before setting payment-date
  params or the filters intersect and return almost nothing. Paginates 200/page, ~40-page cap
  per query — sweep in date windows.
- `benefit-subscriptions` has NO valid_until — intro expiry = last £99/£100 payment + 1 month.
- Auth: `accessTokens.tenant[<tid>]` is an **object `{value, expiration}`** — the bearer is
  `.value`, NOT the object (passing the object → `[object Object]` → 401). Token is short-lived
  (~1h); goes stale — reload the page and re-read if a call returns 401. (Confirmed 24 Jul.)
- `club_payments` **ignores the `product_sku` query param server-side** — a page comes back with
  every SKU mixed (USER_BOOKING/OPEN_MATCH/PUBLIC_CLASS/BENEFIT_PURCHASE). You MUST filter
  `product_sku === 'BENEFIT_PURCHASE'` client-side. Because benefit rows are sparse (~3-4% of all
  payments) and each query is 40-page/8000-row capped, sweep in ~6-day windows so no window hits the
  cap . (Learned 24 Jul — a
  single wide unfiltered pull hit the cap and mis-returned an inflated "buyers" count.)
- The JS bridge blocks outputs echoing query strings — return paths/params masked, dump data
  via `window.__x` slices.
- Participant user-id is `participant_info.participants[].participant_id` (NOT `user_id`/`userId`),
  and opt-in is `accepts_commercial_communications` on the same object. Reading the wrong key gives
  all-null ids and forces name-based joins — which then mis-rank (see next). (Learned 29 Jul.)
- RANK BY USER-ID, NOT NAME. Payments export has a `User id` column; sum spend by `participant_id`.
  Bare single-token names collide: 29 Jul run had two people sharing a first name — the walk-in
  (<walk-in-email>) had £0 but a name match credited him another member's spend. Also match the
  conversion £ figure by EMAIL only (its name key collides too). Name-matching silently over/under-
  counts (one member's £ differed by name vs id). (Confirmed 29 Jul, re-caught same "Lewis".)
- Getting bulk pull data onto disk: the bridge caps tool-result display ~1.1k chars AND Chrome blocks
  repeated programmatic blob-downloads after the first. Reliable path: write the payload into the page
  DOM (`document.body.innerHTML = '<pre>'+data+'</pre>'`) and read it with `get_page_text` (≤50k). The
  first blob-download of the run does work, so use it for the largest single file. (Learned 29 Jul.)

---
Linked: [[Growth & Acquisition]]
