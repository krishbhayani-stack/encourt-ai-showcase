# Spec — Intro Re-Buy Refund Run

Ground truth for the `intro-rebuy-refund-run` skill. Written 2026-08-05 from the session where
Krish defined the refund rule and the first two cases were computed.
Cadence: **weekly-ish, Monday-flavoured, ON DEMAND ONLY** — Krish runs it; nothing on a timer
(constitution rule 13).

## What the run answers

"Who has bought the Intro to Off-Peak AGAIN since 23 Jul 2026, and how much do we refund each
of them?" — excluding anyone Krish has already been given once (the ledger).

## Fixed constants (Krish, 5 Aug 2026)

| Constant | Value |
|---|---|
| Window start | **2026-07-23** (fixed, never moves) |
| Window end | run date (today) |
| Intro price | £99 |
| P2P per-head value of a game | the PAY-TO-PLAY price of each session (v2, Krish 7 Aug — replaces the £15/hr member rate): off-peak 90-min open match = **£22.50/head** (£60 court/hr ÷ 4), peak would be £30/head (£80/4×1.5). Cross-check against what real payers in the same match paid (`OPEN_MATCH_REGISTRATION` rows; £30 observed) and use the higher-confidence figure; the booking `price` field is unreliable (45/22.5/0 seen for like sessions). |
| Admin fee | **flat £9.90** (10% of £99 — NOT 10% of the remainder; settled 5 Aug) |
| Refund formula | **£99 − (Σ P2P price of games played + booked since re-buy) − £9.90, floored at £0**, paid to club wallet (v2, 7 Aug) |
| Hours counted | ALL hours **played since the re-buy + upcoming booked** (pending games count — constitution Hard rule 5 Aug; filter `is_canceled` only) |
| Booking horizon | re-buy date → today + 28 days, swept in **≤7-day windows** (trap 14) |

Break-even: refund hits £0 at ≥ 5.94 hours (four 90-min sessions keeps a refund; five kills it).

## Method (follows brain/specs/playtomic-live-pull.md — traps 1–15 apply)

1. **Window purchases**: live `club_payments` sweep 23 Jul → today in ≤6-day windows,
   client-side `product_sku === 'BENEFIT_PURCHASE'`, skip REFUNDED.
   **Intro = £99 rows** (odd-second timestamps). **£100 on-the-hour rows are Access Monthly
   renewals — NOT intros (trap 13).** Verify any doubtful buyer against the live intro member
   list before treating them as an intro buyer.
2. **Prior-owner set** (has bought before → this window purchase is a re-buy), uid-level:
   - `data/playtomic/payments_24may-22aug.csv` export (superseded the 24 May–4 Jul file
     22 Aug) — SKU is the human-readable **"Benefit purchase"** in exports (not
     BENEFIT_PURCHASE), £99/£100 rows. Export `User id` = API `user_id` (verified 5 Aug).
   - `reports/raw/2026-07-15-intro-offpeak-full-history.csv` (name/email/phone —
     resolve window buyers' emails via `/api/v2/users/<id>?tenant_id=` when needed; v1 404s).
   - Live sweep of any dates not covered above up to window start (4–22 Jul was verified
     clean on 5 Aug; re-verification optional).
   - Match by user_id first, then email, then phone. NEVER bare name (trap 6); remember the
     two-account trap.
3. **Re-buyers** = window £99 buyers present in the prior-owner set, MINUS the ledger (below).
4. **Hours per re-buyer**: `bookings` sweeps from their re-buy timestamp → today+28d in
   ≤7-day windows (trap 14: long windows silently truncate), participant match by
   `participant_id`, drop `is_canceled` only (pending counts), dedup by booking id,
   hours = booking duration. Include played AND upcoming.
5. **Refund** per the formula. Negative → £0 (still report the name — Krish decides; the £0
   is information).
6. **Deliverable**: chat table — name, contact, re-buy date, hours played / booked, refund —
   NEW names only. Note per name: "decays £15/hr with further play until processed" where >£0.
7. **Close-out**: append run result to `brain/facts.md`, update the ledger, vault-sync + commit.

## The ledger — never repeat a name (Krish, 5 Aug 2026)

`data/refunds/intro-rebuy-ledger.csv` — once a name has been GIVEN to Krish in a run's output,
it goes on the ledger and is **never reported again**, even if the same person buys another
intro later (Krish's explicit rule: "once you've given it to me once… never give me those
names again. Just cross them off the list."). The run's output contains ONLY names not on the
ledger. Every run appends its newly-reported names to the ledger the same day.

Seeded 2026-08-05 with the first two reported cases (ids redacted).

## Failure modes

- Playtomic unreachable / logged out → spec fallback: say so, do NOT compute from stale
  bookings (hours change daily); a partial run is not a run.
- The £99-product-off-sale decision may land any day — if window purchases stop, the run
  reports "no new re-buys" and that IS the deliverable.

## Amendment 2026-09-25 (Krish decision + method fix)

- **Scope:** a re-buy = a 2nd purchase of the SAME product, meaning **AUTUMN twice** or **classic twice**
  (the two legacy classic categories count as one product). One classic→AUTUMN hop is ALLOWED and is never a refund case.
  The classic intro is off sale (`visibility: HIDDEN`); AUTUMN has no purchase limit in Playtomic, so this run is
  the only fence against a second AUTUMN buy.
- **Identify the product by subscription counts, not price.** £99 is ALSO the Weekend Evening Pass price, and the
  payment `object_id` doesn't join to `benefit_subscription_id`. Pull `/api/v1/benefit-subscriptions?benefit_id=<cat>`
  (all pages) for each intro category + AUTUMN + WEP and count per user. A re-buyer holds ≥2 subs in one product.
  Use the £99/£75 payment rows only to DATE the purchases. (four members in Aug and Sep
  were WEP false positives under the old price-only method.)
- AUTUMN re-buy refunds use the same formula with **£75** in place of £99 (admin fee 10% = £7.50). ⚑ Krish to confirm
  the fee when the first case lands.

---
Linked: [[Retention & Member Experience]]

## Amendment 2026-10-05 (Krish) — ledger exception: WATCH rows

- A ledger row whose status starts `refunded-cancelled-WATCH` is NOT dead to the run. Krish refunded the re-buy AND cancelled
  the benefit, so any NEW purchase of the same product after the refund date is a fresh case. Report it with the normal formula,
  dated from the new purchase.
- First case: **one member (id redacted)**. Refunded £45 and AUTUMN cancelled 5 Oct. Any AUTUMN buy after 5 Oct goes in the next run.

Linked: [[Retention & Member Experience]]
