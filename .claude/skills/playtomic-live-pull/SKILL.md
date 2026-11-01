---
name: playtomic-live-pull
description: Shared plumbing for pulling live data from the Playtomic manager backend (bookings, payments sweeps, category members, benefits counts, promo codes) with every known API trap encoded. Use whenever any task needs fresh Playtomic data — other skills (pure-P2P sheet, lapsed sheet, churn monitor, member census, KPI review) call this instead of re-learning the method.
---

# Playtomic Live Pull (shared plumbing)

Ground truth: `brain/specs/playtomic-live-pull.md` — read it FIRST, every run. It holds the
endpoints, auth, all 11 known traps, the snapshot policy, and the reference datasets. This
skill is deliberately thin: the spec is the method; this file is the checklist.

## Checklist for any live pull

1. Chrome → `manager.playtomic.io`, logged in. All fetches SAME-ORIGIN relative paths from
   inside that tab. Bearer = localStorage `playtomic:auth` → `accessTokens.tenant[tid].value`
   (the `.value` — the entry is an object). On 401: reload, re-read token.
2. Build the query per the spec's endpoint table. Payments sweeps: ~6-day windows,
   client-side `product_sku` filter, skip REFUNDED, delete service-date params.
3. All times UTC → +1h for BST before any daypart math.
4. Match people by `participant_id` / `User id` / email — NEVER by bare name.
5. Get bulk data out via DOM-write + `get_page_text` (≤50k, chunk if bigger); the run's first
   blob-download works — spend it on the biggest file.
6. Snapshot day-pulls to `data/playtomic/` (dated). Consumer skills that follow the
   re-scrape-then-trash rule move them to `~/.Trash` after the deliverable + facts entry.
7. If Playtomic is unreachable: fall back to newest snapshot/reference CSV and SAY SO in the
   deliverable and facts.md.

## When a new trap is found

Append it to the spec's Known-traps list AND log it in `brain/facts.md` the same day. Traps
live in ONE place (the spec) — never copy them into consumer skills; consumer skills point here.
