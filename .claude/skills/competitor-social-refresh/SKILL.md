---
name: competitor-social-refresh
description: Refreshes the competitor social read (Racketeer, Padium, Rocket Padel, PadelStars, The 108, dead-check PadelHub) plus Encourt's own account via in-page Instagram web-API pulls, compares deltas vs the last read, runs the own-account hygiene check. Use when Krish asks "what are competitors posting", "social refresh", "competitor check", or fortnightly.
---

# Competitor Social Refresh

Ground truth: `brain/specs/competitor-social-refresh.md` — the watchlist (with last-read
anchors), the in-page IG API method, analysis rules, locked strategic frames.

## Steps

1. **Find the last read** (facts.md / newest competitor brief) — deltas are the product,
   not absolutes.
2. **Pull each watchlist account** (logged-in instagram.com tab, in-page fetch):
   `api/v1/users/web_profile_info/?username=<u>` then `api/v1/feed/user/<id>/`, header
   `x-ig-app-id` copied from the page's own requests. Followers, post count, recent 12+ posts
   with likes/plays/format/caption, pinned. Space the calls; if IG throws a challenge/login
   wall, STOP and say so — never fight bot-detection.
3. **TikTok** (deep reads): Encourt + Padium + Racketeer public pages — the open-field finding.
4. **Own-account hygiene**: bio, linktree targets (memberships tile still missing as of
   14 Jul), county/name errors, link-in-bio correctness.
5. **Analyse** per spec rules: per-account deltas, outlier posts since last read, cadence/format
   changes, keep the locked frames (hero vs routine · Racketeer engine · wellness+padel
   whitespace · never copy meme volume/price messaging — premium positioning ruling).
6. **Flags that leave this skill**: PadelStars Radlett pricing appearing anywhere →
   off-peak-defence tripwire (tell revenue-kpi-review) · influencer conflicts (e.g. the Rocket coach) · counter-programming steals worth copying.
7. **Outputs**: brief → `reports/briefs/YYYY-MM-DD-competitor-social-refresh.md` (+PDF if
   it'll be shared) · pulled JSON summaries → `data/instagram/` dated (keepers, supersede
   monthly) · facts.md entry with headline deltas. Content recommendations only when asked.
