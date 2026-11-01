# Glossary — People & Terms

## People key
| Code | Person | Role |
|---|---|---|
| K | **Krish** | **Founder / CEO / Director — the sole principal this whole system serves.** Every brief goes to Krish. |
| A | Aman | Co-Founder (looped in on corporate; owner of the Monday review with Krish + the advisor) |
| GM | (redacted) | General Manager (from Oct 2026) |
| AL | (redacted) | Strategic Advisor (external — NOT always on-site; may be booked away / off-site) |
| CM | (TBA) | Club Manager — day-to-day ops |
| EL | (redacted) | Assistant Manager |
| — | (redacted) | Manager (FOH escalation point) |
| LC | (redacted) | Head Coach |
| MP | (redacted) | Coach |
| JC | (redacted) | Coach (Ladies sessions) |
| — | (redacted) | Coach |
| — | (redacted) | Coach |
| — | (redacted) | Coach |
| RJ | (redacted) | Social Media & Video |
| MJ | (redacted) | PA / Admin Assistant |
| WL | (redacted) | Maintenance Lead |
| ED | (redacted) | External Accountant |
| FOH | — | Front of House team |

> RESOLVED 30 Jun 2026 (Krish): owners are **Krish (K)** and **Aman (A)** only. There is no "Chris"
> and no "Amin" — those were transcription errors. The system is built for **Krish alone**.

## AI system runtimes
- **Claude Code** — the brain's author: runs the skills, writes facts/briefs/vault, commits. The only writer.
- **Hermes** — Hermes Agent by NousResearch (`~/.hermes/`), merged 22 Aug 2026: second runtime that READS the whole brain (boot file `HERMES.md`), answers/drafts, writes only to `reports/raw/hermes/`. No credentials, no live pulls. Spec: `brain/specs/hermes-agent.md`, CLAUDE.md rule 14.
- **jarvis** — Krish's localhost command-deck app (`jarvis/`, spec: `brain/specs/jarvis-app.md`).
- **matchmaker** — the open-match consolidation daemon (`matchmaker/`, PILOT; spec: `brain/specs/open-match-consolidation.md`).

## Session / booking types
- **Open play** — casual member/visitor bookings, no coach (via Playtomic)
- **Americano** — rotating-partner social format match
- **Social** — beginner/level-group social session
- **Private hire** — court booked exclusively (corporate / parties)
- **Coaching** — group sessions, courses, or 1-to-1 private lessons
- **Pilates** — reformer + mat classes in the Radlett studio (10 beds). Software: **TeamUp** since Oct 2026 (BSport before).

## Club terms (from FOH Handbook — see brain/specs/foh-handbook.md)
- **Off-peak** — Mon–Fri 6am–5pm (the window the Off-Peak and Intro Off-Peak memberships cover)
- **Bobo & Wild** — partner brand; Pilates members get 10% off, staff expected to know the partnership
- **Bayrol** — the pool's auto-dosing chemistry system (staff never adjust without management sign-off)
- **Genius** — spa-alarm system on the reception MacBook (second way to deactivate a false alarm)
- **Mat Pilates & Lattes** — weekly open mat class, £5 members / £10 non-members
- **TeamUp** — goteamup.com (DaySmart). Pilates booking/membership/payments platform since Oct 2026, replacing **BSport** (backoffice.bsport.io, May–Sep 2026). Business profile "Encourt Pilates", provider <PROVIDER_ID>. Spec: `brain/specs/teamup-pilates-pull.md`.
- **Pilates product shorthand** — **UNL** = Half price monthly unlimited £150 (locked founders, hidden) · **UNL+W** = Half Price Unlimited Plus Wellness £200 (hidden) · **UNL175** = £175 Unlimited reformer (the simplified unlimited, £175/mo or £1,750/yr, on sale from 12 Oct 2026) · **5C** = 5 Class £120/mo (legacy "Reformer 4" holders at £92/£115) · **5C+W** = 5 Class Plus Wellness £170 · **INTRO** = Reformer Intro offer £60, 31 days.

## Membership states (from Playtomic)
- **Active** — booked in last 21 days
- **Lapsed** — 60+ days with no booking
- **Renewal due** — within 30 days of expiry

## VAT shorthand
- **Inc VAT** = what the customer paid (weekly report, revised budget). **Ex VAT** = Inc ÷ 1.2 = what Encourt keeps (Xero, P&L,
  the advisor's commission base). VAT element = Inc ÷ 6. Full explainer: `reports/briefs/2026-10-05-vat-inc-vs-ex-explainer.md`.
