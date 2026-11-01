# Metrics — is this system actually working?

Recreated 2026-07-08 (the original never made it into the V2 folder). Scored roughly weekly,
by whoever runs the close-out. This measures the AI SYSTEM, not the business — business KPIs
live in `targets-and-kpis.md`.

## Scorecard (rescored 2026-07-30, W31 — prior W28 values in git history)

| Metric | How measured | Latest |
|---|---|---|
| Briefs produced that led to a Krish decision/action | count per week, from facts.md | Strong: pure-P2P sheets used nightly at the desk; programme price card issued to staff 29 Jul; expiry call sheet in play |
| Numbers later found wrong | corrections logged in facts.md | 2 caught + fixed in Jul: gross-vs-net (7 Jul), intro-conversion undercount (15 Jul), plus a first-name-collision ranking bug (29 Jul) — all self-caught |
| Data freshness at analysis time | age of newest snapshot when a brief was written | Excellent since 20 Jul: live API pulls same-day; but payments EXPORT still ends 4 Jul → spend figures are floors |
| Write-back discipline | sessions ending with facts/vault updated | facts.md: excellent. **Vault: FAILED 14–30 Jul** (sync sweeper retired, nothing replaced it) — fixed 30 Jul with vault-sync close-out skill + constitution rule 12. Git: 15 days uncommitted, fixed 30 Jul |
| Skills coverage of recurring jobs | recurring job with no skill = gap | 9 live skills; all known recurring jobs covered (KPI review, occupancy diagnosis, P2P sheet, churn monitor, census, lapsed sheet, social refresh, live-pull plumbing, vault-sync) |
| Single-source-of-truth violations | contradictions found between brain docs | Vault trailed facts.md by 16 days (worst instance yet — resynced 30 Jul); TASKS.md concept retired, Daily Focus carries priorities |

## Standing risks to the system itself
- Git repo restored 8 Jul but **still no off-machine remote** — a laptop loss still loses everything.
  Push to a private GitHub remote = top remaining fix.
- Vault-sync now depends on the close-out habit (rule 12), not a timer — if sessions end without it,
  the 14–30 Jul freeze repeats. Watch this row weekly.
- Payments export gap since 4 Jul: all spend rankings are floors until a fresh export lands.
- 12 Oct 2026: Pilates source swapped BSport → TeamUp in one session (skill + spec + data-sources + ledger + deck re-pointed; BSport skill/spec archived). Risk: the TeamUp JSON API is undocumented — column keys were discovered by probing and may change without notice; the spec records the verified set.
