---
name: intro-rebuy-refund-run
description: Weekly-ish (Monday-flavoured, on-demand) intro re-buy refund run — finds everyone who bought the £99 Intro to Off-Peak AGAIN since 23 Jul 2026, computes each refund (£99 − pay-to-play price of games played+booked since re-buy − £9.90 flat fee, floor £0, to club wallet), and reports ONLY names never given to Krish before (ledger-tracked). Use when Krish asks "run the refund skill", "who do we need to refund", "intro re-buy refunds", or on his Monday sweep.
---

# Intro Re-Buy Refund Run

Ground truth: `brain/specs/intro-rebuy-refund-run.md` — read it FIRST, every run. It holds the
fixed constants (window start 23 Jul 2026, £99/£15/£9.90 formula), the method, and the ledger
rule. Plumbing: `brain/specs/playtomic-live-pull.md` (traps 1–15 all apply — especially 13:
£100 rows are Access renewals, and 14: bookings sweeps ≤7-day windows).

## Checklist

1. Read the ledger `data/refunds/intro-rebuy-ledger.csv` — these names are DEAD to this run's
   output, forever, even on a fresh purchase.
2. Live payments sweep 23 Jul → today (≤6-day windows): £99 BENEFIT_PURCHASE rows = intro
   buys. £100 on-the-hour = Access renewals, exclude.
3. Prior-owner set at uid level (launch export "Benefit purchase" rows + 15-Jul history +
   live cover of any gap); re-buyers = window buyers ∩ prior owners, minus ledger.
4. Per re-buyer: bookings sweeps re-buy date → today+28d (≤7-day windows), participant-id
   match, drop cancelled only — **pending games count** (constitution Hard rule). Hours =
   played + upcoming booked.
5. Refund = £99 − Σ(P2P price of each game played+booked, per spec table) − £9.90, floor £0.
   Report table in chat: name, contact, re-buy
   date, hours, refund (flag decay: −£15/hr until processed). £0 rows still shown once.
6. Close out: append the run to facts.md, add reported names to the ledger, vault-sync +
   commit. Day-snapshots to `data/playtomic/` then Trash per policy.

## Rules

- Window start NEVER moves from 2026-07-23; end = run date.
- Nothing scheduled — Krish invokes it (constitution rule 13).
- Playtomic logged out → say so and stop; never compute hours from stale data.
- Calculation only: never issue the wallet credit — that is Krish/FOH's action.
