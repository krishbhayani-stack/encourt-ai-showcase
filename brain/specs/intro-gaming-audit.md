# Spec — Intro Re-Buyer List / Gaming Audit (v2, Krish rules 14 Aug 2026)

Ground truth for the recurring "who is gaming the Intro to Off-Peak" ask. Written 14 Aug 2026
after two Krish corrections in one session (a mislabelled member; scope tightened). These rules
override anything older, including the fingerprint-derived rows in the 15-Jul history and the
10-Aug census.

## What the deliverable IS (scope — Krish, 14 Aug)

**Only people who have bought the Intro to Off-Peak MORE THAN ONCE, with the repeat purchase
AFTER 23 Jul 2026.** Nothing else goes on the list. Free-access/tag anomalies are a separate
section if asked — never mixed into the re-buyer list.

## The rules (Krish, 14 Aug — standing)

1. **From Playtomic via Chrome, every time.** The logged-in Chrome manager UI is the source.
   Never API replays as the source of record for this audit.
2. **Fresh live pull every run. Forget old info.** Never reuse a previous run's list, the
   census, or the 15-Jul history as evidence — they carry the £100-fingerprint mislabel
   (spec trap 13c: 16 Access Monthly payers counted as multi-intro; that member was never on an intro). Old files may only SUGGEST candidates; they prove nothing.
3. **Per-person verification before a name is printed.** A name goes on the list only when
   Playtomic itself shows, for that person: (a) an intro purchase dated AFTER 23 Jul, AND
   (b) at least one earlier intro purchase. Payment rows are the proof — user-initiated
   (odd-second) £99 "Benefit purchase" rows for the intro product. £100 on-the-hour rows
   are Access renewals, never intros (trap 13).
4. **Match identity by user id / email / phone, never bare name** (trap 6; two-account trap).
5. **The profile "Type: Assigned by club" field is NOT proof either way** — it shows
   "Assigned by club" even for paid benefits (seen on a member who paid 8 Aug). Only payment
   rows prove purchase; only their absence + a live tag proves a free grant.
6. **Deliverable = PDF** (A4, sent + ~/Downloads) listing each verified re-buyer with their
   purchase dates as Playtomic shows them, contact, and refund status from the ledger
   (`data/refunds/intro-rebuy-ledger.csv`). Errors found in older outputs are corrected in
   the PDF and logged in facts.md — never silently.

## Method

1. Chrome UI → Payments (or the live payments sweep for candidate DISCOVERY only): all £99
   intro purchases 23 Jul → run date.
2. For each candidate: verify prior intro ownership per rule 3 (their own payment history in
   Playtomic; reference CSVs only as pointers, always re-proved live).
3. Cross-check the current member list (Benefits → Members page, Billing column) for state.
4. Ledger comparison for refund status; close out per vault rules.

## Known pitfalls (full detail in brain/specs/playtomic-live-pull.md)

- Trap 13/13c: £100 ≠ intro; legacy May–Jun £100 rows over-match Access Monthly.
- Trap 19: tags can outlive subscriptions (free riders) — separate finding, separate section.
- Trap 6: names collide; ids don't.

---
Linked: [[Retention & Member Experience]]
