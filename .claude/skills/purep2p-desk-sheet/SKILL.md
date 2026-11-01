---
name: purep2p-desk-sheet
description: Nightly desk sheet of 5–9 PURE pay-to-play people (never any membership or promo, ever) booked in for a target playing date, ranked by £ and games plus an open-match spender scan, repeats starred via ledger, one landscape PDF per date for the club manager. Sell = they get no gym/spa/member rates. Use when Krish asks for "the pure pay-to-play list", "tomorrow's P2P sheet", or the nightly scheduled run fires.
---

# Pure Pay-to-Play Desk Sheet

Ground truth: `brain/specs/pure-p2p-desk-sheet.md` — read it first, it has the exact
definition, all seven exclusion sources, ranking rules, output rules, and the API traps.
Default target date: tomorrow. Krish may name one or more dates — one PDF per date.

## Steps

1. **Pull the target day's bookings live** (Chrome → manager.playtomic.io, logged in):
   `/api/v1/bookings?tenant_id=<TENANT_ID>&page=0&size=300&sort=start_date,ASC`
   with `start_booking_date=(D-1)T23:00:00Z`, `end_booking_date=DT22:59:59Z`.
   Bearer token from localStorage `playtomic:auth` → `accessTokens.tenant[tid]` (reload on 401).
   Keep non-cancelled bookings; participants live in `participant_info.participants`.
   Times are UTC → +1h = BST. Snapshot to `data/playtomic/YYYY-MM-DD-bookings-playingdate-<D>-utc.txt`.

2. **Refresh the live exclusion sets** (same tab):
   - `club_payments` BENEFIT_PURCHASE sweep from the last snapshotted sweep date to today
     (any amount, skip REFUNDED). Delete service-date params first (spec: Known traps).
   - Intro category members: `/api/v2/users/suggestions/category_members?category_id=<INTRO_CATEGORY_ID>`
     (replay captured params if a bare call 400s).

3. **Filter + rank via the script** (extracted 2026-07-30 per operating rule 3): write the
   bookings pull to a JSON file and the live buyer-sweep ids to a text file, then run
   `python3 scripts/purep2p_filter.py --bookings <json> --buyers <ids.txt> --out <csv>`
   (spec: `brain/specs/purep2p-filter-script.md`). It applies all reference-CSV exclusions +
   staff, joins spend/games by user-id/email, converts UTC→BST, and prints the funnel summary
   for facts.md. Do NOT re-implement the joins by hand.

4. **Judgment on top of the script output**: group households, pick **5–9 rows** (min 5, max 9
   — Krish rule 7 Aug): the top £-ranked people PLUS the open-match spender scan — open-match
   joiners with real recorded spend who would complete a full family/household court paying
   for themselves, or read as likely top conversions. Star repeats: check every named person
   against `data/sessions/purep2p-sheet-ledger.csv` (by participant_id, then full name) and
   prefix ★ if they were named on ANY previous sheet. Choose the bubble name and cluster
   moments. Sanity-check survivors against the live intro-member list (the script only knows
   the reference CSVs — a brand-new intro member today is caught by the buyer sweep you feed
   in).

5. **Build one landscape-A4 PDF per date** → `reports/briefs/YYYY-MM-DD-purep2p-desk-sheet-<D>.pdf`,
   copy to ~/Downloads. Follow the spec's output rules exactly — especially: **never print 0
   games**; use "N + check open matches" / "Check private/open matches". Sell box up top,
   cluster-moment + bubble-name footnotes, blank Outcome column for the desk.

6. **Append the run's named people** (ranked rows + cluster-footnote names) to
   `data/sessions/purep2p-sheet-ledger.csv` (`date,participant_id,name`; append-only, never
   trashed — it feeds the ★ rule), then **log** the run in `brain/facts.md` (dated,
   append-only): counts, top names, snapshot paths.

## Notes

- **Re-scrape-then-trash (Krish rule, 27 Jul).** EVERY run pulls ALL live Playtomic data FRESH —
  never reuse a prior day's snapshot. After the PDF is built and the run is logged, MOVE that run's
  raw day-snapshots (the bookings `.txt` and the benefit-buyer sweep `.txt`) to Trash (`~/.Trash`,
  recoverable) rather than accumulating them in `data/playtomic/`. The distilled result lives in the
  PDF + `brain/facts.md` instead. Reference datasets (customers / payments / intro-history /
  subscription-run / conversion CSVs) are NOT day-snapshots — they stay put; they are the exclusion
  + ranking knowledge base.
- **API host is SAME-ORIGIN.** Fetch `/api/v1/...` and `/api/v2/...` relatively from inside the
  manager tab (`https://manager.playtomic.io/api/...`). A cross-origin fetch to
  `https://api.playtomic.io/...` fails CORS with `TypeError: Failed to fetch` — looks like auth, is
  not. (Learned 27 Jul.)
- The CSV cross-reference is now `scripts/purep2p_filter.py` (extracted 2026-07-30 after the
  logic stabilised) — the skill remains the judgment layer on top of it. If exclusion sources
  change, update `brain/specs/purep2p-filter-script.md` first, then the script.
- If Chrome/Playtomic session is unavailable, fall back to the newest bookings snapshot in
  `data/playtomic/` and SAY SO in the PDF footnote and facts entry ("stale pull, D-x").
- Spend figures: always label as floors while the payments export gap (post-4 Jul) persists.
