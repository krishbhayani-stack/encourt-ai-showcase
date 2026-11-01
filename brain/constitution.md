# Encourt Constitution — How the Club Should Run

Source of truth distilled from the Business Operations & Accountability Document (23 Jun 2026)
and the Org Structure & Recommendations (Jun 2026). When reality disagrees with this file, the
agent flags it — it does not silently accept it.

## Reporting cadence (who sends what, when, to whom) — REVISED 30 Jun 2026
Everything goes to **Krish alone** (sole principal). Aman is looped in on corporate only.
See `reporting-calendar.md` for the authoritative, detailed version.
| Report | From | When | Goes to |
|---|---|---|---|
| Daily court report | CM | Every evening | K |
| Daily FOH handover | FOH shift | End of every shift | CM |
| Email triage (inbox scan, ASAP/deadlines to top) | **AI — not a person** | 09:00 UK daily | K |
| Coaching weekly report | LC (Head Coach) | Every Sunday (end of day) | K |
| Pilates weekly report | EL (Assistant Manager) | Every Monday | K |
| Maintenance report (outstanding + week ahead) | WL (Maintenance Lead) | Every Monday | K |
| Weekly content plan | RJ (Social) | Every Monday | K |
| Corporate event notification (what/price/details) | AL (Advisor) | The moment each is booked | K + A |
| Corporate weekly roll-up | AL (Advisor) | Every Monday | K |
| Full finance report | K + A + ED | Monthly (by 5th) | K + A |

> Owners (Krish + Aman + advisor) review occupancy & revenue themselves every **Monday 10:00–12:00**.
> The club manager is NOT asked to report on revenue/occupancy — Krish covers that in that meeting.
> Dropped from the old draft: CM weekly KPI overview, PA morning brief, AM member/revenue
> extract (the new-member outreach is handled internally by the PA + managers).

## Daily Court Report — required structure
Every evening report MUST contain all five sections. A missing section is a flag:
1. Courts booked vs. available (with occupancy)
2. Revenue generated (Playtomic)
3. Any disputes or issues
4. Maintenance flags
5. Anything requiring an owner decision

## Hard rules the agents enforce
- **Unpaid bookings:** the booking platform auto-reconciles within 1–2 days, so do NOT flag
  unpaid bookings by default (it's noise). Only flag a booking still showing unpaid after **3+ days**.
- **Missed calls** must all be called back same day; any unreturned call is flagged.
- **Spend over threshold** requires K+A sign-off BEFORE it happens — flag any spend reported as already actioned without sign-off.
- **Staff problems**: the team must bring problem + recommended solution to K+A BEFORE acting.
- **New member onboarding** completed within 48 hours of joining.
- **Members not booked in 3 weeks** → personalised message due. **Lapsed 60+ days** → re-engagement.
- **Maintenance issues** resolved within 24 hours.
- **Pending games count (Krish, 5 Aug 2026):** on every data pull, if a person is registered
  in a game, it counts — even when the game/booking still shows PENDING (e.g. an open match
  not yet full or unconfirmed). Never drop pending-status registrations from hours-played,
  refund, schedule, or any per-person tally, whatever the API or scrape source. Method detail
  lives in `brain/specs/playtomic-live-pull.md`.
- **Pure-P2P desk sheet rules (Krish, 7 Aug 2026):** (1) a name already given on any previous
  sheet carries a ★ — the ledger `data/sessions/purep2p-sheet-ledger.csv` is append-only and
  never trashed; (2) beyond the £-ranking, every run scans open-match joiners with real spend
  and adds family-court completers and likely top conversions as extra rows; (3) the sheet is
  **5–9 rows**, not a fixed top-7. Detail in `brain/specs/pure-p2p-desk-sheet.md`.

## Escalation chains
- Booking disputes: CM → EL
- Member complaints: FOH → CM → EL → K+A
- VIP / high-value members: CM (first touch) → K+A+AL
