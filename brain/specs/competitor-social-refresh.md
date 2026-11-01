# Spec — Competitor Social Refresh

Ground truth for the `competitor-social-refresh` skill. Written 2026-07-30 from the 8, 10 and
14 Jul competitor pulls (facts.md; briefs 2026-07-08-competitor-social-brand-brief,
2026-07-10-competitor-social-content-deepdive, 14-Jul refresh).

## The watchlist (update here when it changes)

| Account | Why watched | Last-read anchors (1 Sep — DEGRADED read, no likes/plays; see method) |
|---|---|---|
| @racketeer.club (Racketeer) | The consistency machine — ~daily cadence; EXCLUSIVELY on Playtomic since 24 Jul; **entered the wellness lane 28 Aug** | 24,041 fol/178 posts (+3.2%); near-daily held; yoga reel + NEW "Wellness" story highlight; Applied Nutrition collab reel 26 Aug; PadX court-cameras reel; TikTok now their mover: 338 fol (+26%)/2,573 hearts |
| Padium @padiumuk | Hero venue-story format, 10–40× routine content | 30,805 fol/220 posts (+2.0%); cadence still slow ~8-9/27d; new "Courtside Q&A" series (10 Aug); creator collab |
| Rocket Padel @rocketpadel | Coach-tip reels at paid-scale reach; their lead coach is on our influencer pilot list (conflict) | 18,130 fol/41 posts (+0.7%, stalled); weekly reels; "Recovery Room" reel 21 Aug (wellness move); pinned set changed to May/Feb posts — 304K reel no longer top; coach presence unverifiable without captions |
| PadelStars @padelstarsuk | The Radlett threat — expansion machine; grassroots + PR | 4,575 fol/362 posts; ~every 2 days; BBC Berkshire collab 8 Aug; new satellite "@Padelstars Inside Scoop" |
| **@padelstarsradlett** | Dedicated Radlett account — PRICING PUBLIC (tripwire hit 5 Aug): £125/yr early-bird, member £32/£38.40, non-member £40/£48 | 269 fol/6 posts; SILENT since 13 Jul — no opening date, no new pricing; NEW WhatsApp community-chat link in bio (pre-launch audience gathering) |
| The 108 @the108_padel (+ @brentcrosstown check) | Aug wake-up DIED BACK (2 posts/27d); host account carries the price message third-party | 780 fol/66 posts; 29 Aug social-night poster + F&B menu launch post; Brent Cross Town collabs in grid; no price messaging |
| @padelhub.uk | Dead-account check only | 0/0/0 — dead, 5th consecutive confirm (8, 10, 14 Jul, 5 Aug, 1 Sep) |
| @encourtpadel (own) | Baseline + hygiene checks; @encourtpilates satellite | 6,995 fol/38 posts (**+8.0% — fastest on board 2nd window running**); cadence ~every other day; Recoverie.Health collab 10 Aug; pilates satellite 300 fol/17 posts (+26%); TikTok 369/968 flat (video count unverifiable; "who deleted 3 videos" open); ⚠ hidden-likes suspicion UNRESOLVED (needs login); ⚠ linktree Memberships tile missing 4th read |

## Method (proven 14 Jul; revised 5 Aug — web_profile_info endpoint died)

- Logged-in instagram.com tab, **in-page fetch of IG's own web API**, header
  `x-ig-app-id: 936619743392459` (or copy from the page's own requests). Returns clean JSON —
  no scrolling/scraping.
- ⚠ `web_profile_info` now 400s ("Asset ig_business_category_subvertical has been deleted").
  Working chain (5 Aug): `/api/v1/web/search/topsearch/?query=<u>` → user `pk` →
  `/api/v1/users/<pk>/info/` (followers/media_count/bio/external_url) →
  `/api/v1/feed/user/<pk>/?count=12&max_id=<next_max_id>` (posts: taken_at, media_type,
  like_count, comment_count, play_count, caption; paginate on `next_max_id`).
- Run the fetches from a LIGHT IG page (e.g. a profile URL), not the home feed — the feed's
  autoplay videos freeze the renderer and time out CDP evaluate calls after ~2–3 batches;
  re-navigate to the profile page between batches when it happens.
- Post-level: pull the recent grid per account (12+ posts), record views/plays for reels,
  likes for stills, caption/format, pinned posts.
- TikTok: check Encourt + Padium + Racketeer TikTok accounts (public pages) when doing a deep
  read — TikTok remains the open field finding.
- Rate-limit sanity: space the calls; if IG serves a challenge/login wall, stop and say so —
  never push through bot-detection.
- ⚠ 1 Sep: the Chrome IG session was LOGGED OUT — every /api/v1 endpoint (incl. topsearch,
  which 401'd) redirects anonymous callers to login. Do NOT conclude an endpoint died from a
  logged-out 401; check for the "Log In / Sign Up" header first, and re-test the chain after
  Krish logs back in.
- **Logged-out fallback (proven 1 Sep — follower/cadence deltas only, no engagement):** public
  profile pages still expose (a) EXACT `"follower_count":N` embedded in the page HTML,
  (b) og:description meta = following + exact post count, (c) the 12-post grid via
  `main a[href*="/p/"], a[href*="/reel/"]` img alt text — "Photo/Video by X on <date>" + content
  hints, collab authors visible, (d) bio + story-highlight names. Linktree and TikTok
  profile-level checks need no login at all. Use it to keep the delta cadence alive, and mark
  the read DEGRADED in the brief.

## Analysis rules

- **Compare to the last read** (find it in facts.md / the last brief) — deltas matter more than
  absolutes: follower moves, cadence changes, new formats/series, outlier posts since last time.
- Keep the locked frames: hero-format vs routine-content gap · Racketeer consistency engine ·
  whitespace = wellness+padel lifestyle story (nobody posts it) · do NOT copy meme volume or
  price messaging (Encourt is materially more premium — Krish positioning ruling, 8 Jul).
- Always run the **own-account hygiene check**: bio/linktree correctness (linktree memberships
  tile STILL missing as of 14 Jul), link-in-bio targets, county/name errors.
- Flag competitor moves that touch OUR plans (e.g. Racketeer counter-programming steals,
  the Rocket coach conflict, PadelStars Radlett pricing if it ever appears — that one is
  an off-peak-defence tripwire → tell revenue-kpi-review).

## Output

- Brief → `reports/briefs/YYYY-MM-DD-competitor-social-refresh.md` (+ PDF if Krish will
  share it): per-account delta table, outlier posts, hygiene check result, steal-worthy
  formats, flags. Content recommendations only when asked — the refresh is a read, not a
  content plan.
- facts.md entry with headline deltas. Snapshot pulled JSON summaries to `data/instagram/`
  dated (keepers — they're the trend baseline; supersede monthly).
- Cadence: on demand; useful fortnightly. A pull takes ~30–45 min for the full watchlist.

---
Linked: [[Competitive Landscape]]
