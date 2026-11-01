# Spec — purep2p_filter.py (deterministic exclusion + ranking)

Ground truth for `scripts/purep2p_filter.py`. Written 2026-07-30. Extracts the STABLE,
judgment-free core of the pure-P2P pipeline (operating rule 3): the CSV cross-reference
exclusion filter + spend/games ranking. The skill keeps the judgment (live pulls, top-7
selection, household grouping, PDF, caveats); the script does the joins — same input, same
output, every time.

## Inputs (CLI)

- `--bookings <file>` — JSON array of booking objects as returned by manager
  `/api/v1/bookings` (the day-pull, written to disk by the skill). Cancelled bookings are
  skipped (`status` = CANCELED/CANCELLED). Participants read from
  `participant_info.participants[]`: `participant_id`, name, email, phone,
  `accepts_commercial_communications` (tolerant key lookup — API field names have drifted).
- `--buyers <file>` — one user-id per line: the LIVE benefit-buyer sweep ids (the skill
  produces this; the script never calls the network).
- `--repo-root <dir>` — defaults to the repo root; reference files resolved beneath it.
- `--out <file>` — output CSV.

## Reference datasets (read-only, resolved under repo-root)

1. `data/playtomic/2026-07-09-customers.csv` + `customers_2242.csv` — exclude any id/email
   with non-empty `category_name` (club-assigned/invoiced members).
2. `reports/raw/2026-07-12-subscription-status-run.csv` — exclude all `user_id`s + emails
   (every benefit purchaser to 12 Jul).
3. `reports/raw/2026-07-15-intro-offpeak-full-history.csv` — exclude by name + email.
4. `reports/raw/2026-07-14-nonmember-conversion-list-15-19jul.csv` — exclude rows whose
   `segment` contains "intro" (name + email).
5. Staff list (in-script constant): head coach, the club account, the founder.
6. `data/playtomic/payments_24may-22aug.csv` — spend + games source (`;`-separated, 7 summary
   lines before the header; header row detected by "User id" column). Replaced the 24 May–4 Jul
   export 22 Aug (verified strict superset, same schema); old file in `_archive/superseded-data/`.

## Rules (locked from the spec/skill history)

- **Match by id first, then email. NEVER by bare name** except for reference files that have
  no id/email alternative (intro-history names, staff names) — name matches require the FULL
  name (2+ tokens) to match exactly, lowercased; single-token names never match by name.
- Spend = sum of `Total` for `Payment status == Paid` rows in GAME SKUs only (Open match /
  User booking / Public class / Tournament / Academy class / User recurring booking
  registrations), keyed by `User id`. Refunds/Wallet recharge/Benefit/Membership rows never
  count. Conversion-list `paid_gbp_to_4jul` joined by EMAIL only; final spend = max(both).
  All spend is a FLOOR (post-4 Jul export gap) — the skill labels it so.
- **GUEST placeholder participants are NOT people — skip them** (bug caught 18 Aug 2026:
  3 of that run's 66 "survivors" were "Player 2/3/4" on a 17:30 Padel 6 booking). A slot is a
  placeholder when `participant_type` is present and != `CUSTOMER` (value seen: `GUEST`) or
  when the participant id starts with `guest:` (`guest:<ts>:<hash>`). They are dropped before
  the exclusion checks and reported on their own stdout line, not inside the unique-people
  count.
- Games = count of Paid, `Total > 0` game-SKU rows per user id (undercount; skill renders
  per the never-print-0 rule).
- Times: booking start is UTC → +1h printed as BST. The API field is `booking_start_date`
  (NOT `start_date` — playtomic-live-pull trap 12, caught 3 Aug; script fixed 4 Aug to read
  `booking_start_date` first with `start_date` as legacy fallback).
- Output: ALL surviving pure-P2P participants (not just top 7 — the skill cuts the sheet),
  sorted spend desc → games desc → name; columns
  `name,participant_id,spend_gbp_floor,games_paid,slots_bst,phone,optin,email`.
- Stdout funnel summary: participants → dropped-by-each-source → survivors (the skill copies
  this into facts.md).

## Non-goals

No network calls. No top-N cut, no household grouping, no PDF, no caveat text — judgment
stays in the `purep2p-desk-sheet` skill. If exclusion sources change, THIS spec changes first.

---
Linked: [[Business Data — Playtomic]]
