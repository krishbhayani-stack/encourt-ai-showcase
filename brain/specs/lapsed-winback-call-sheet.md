# Spec — Lapsed / Win-Back Call Sheet

Ground truth for the `lapsed-winback-call-sheet` skill. Written 2026-07-30 from the 12-Jul
subscription-status run and the 14-Jul lapsed rerun/reframe (facts.md).

## Definition: "lapsed / expired"

A person who **paid for any benefit/membership at least once** (BENEFIT_PURCHASE, any amount,
not refunded) but **holds NO current membership of any kind today** (no category, no live
benefit). Baseline 14 Jul: N people — nearly all expired INTRO members.

## The locked framing (14 Jul — do not re-derive)

**They left the membership, not the club.** most played 10+ paid games after/around
lapse; most were still playing into late June/July as pay-to-play. So the pitch is a
**graduation call** (value/price fix, owner-led, goal = booked visit), NOT churn re-engagement.
Only a handful had zero games. Segment every list the same way:
- **Intro cliff** (expired intro, no landing) — the dominant segment, graduation pitch.
- **True tier lapse** (held a real tier, gone) — rare; personal owner call.
- **Zero-use** (paid, never/barely played) — different conversation, low priority.
- **Loophole renewers** (re-bought the intro instead of graduating) are NOT lapsed — they route
  to the churn-conversion-monitor watch; per the 20-Jul call-sheet rule, "re-buy intro" on a
  call escalates to Krish/Aman.

## Method

1. Live BENEFIT_PURCHASE sweep 14 Jun→today per `brain/specs/playtomic-live-pull.md`
   (6-day windows, client-side SKU filter, skip REFUNDED, match by user-id). Before 14 Jun is
   covered by the payments export (24 May–4 Jul) already baked into the subscription run.
2. Live current-membership check: customers with a category (customers CSVs + any live
   category/benefit membership evidence). Payer with no current membership → lapsed/expired.
3. Membership-they-had: infer from benefit payment amounts (14-Jul method: £99/£100=intro,
   £129=P&W, £160=Off-Peak, etc.).
4. Enrich per person: total £ paid, first/last purchase, paid-games count + last-game date
   (game SKUs: match/booking/class/tournament registrations, paid & unrefunded — member-included
   free games NOT counted, so games are an UNDERCOUNT), phone, email, opt-in.
5. **Delta vs last run**: diff against the previous run's CSV in `reports/raw/` — flag NEW
   lapses since last run at the top of the sheet, and note anyone who RETURNED (bought again).

## Output

- CSV → `reports/raw/YYYY-MM-DD-lapsed-expired-run.csv` (supersedes prior; move old to
  `_archive/` only if Krish says so — otherwise both stay for delta history).
- Call-sheet PDF → `reports/briefs/YYYY-MM-DD-lapsed-call-sheet.pdf` + ~/Downloads:
  sorted by activity (games desc, then £), segment-labelled, NEW-since-last-run flagged,
  phones, opt-in, membership-they-had, last played, outcome column. Script box: graduation
  pitch, wellness-day-pass fallback, "re-buy intro → escalate to Krish/Aman".
- facts.md entry: counts by segment, new lapses named, biggest £, snapshot paths.

## Caveats to print on every sheet

- £ spend is a FLOOR while the payments-export gap (post-4 Jul) persists.
- Games are an undercount (member-included free games invisible).
- a block of members hold memberships with no Playtomic payment (invoiced/assigned/staff/annuals) —
  they can never appear lapsed in this run's view; a true census is the member-census skill's job.
- BSport/Pilates lapse is NOT covered (needs a live BSport subscription pull — separate ask).

---
Linked: [[Retention & Member Experience]]
