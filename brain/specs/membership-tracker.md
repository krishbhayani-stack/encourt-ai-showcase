# Spec — Membership Tracker (weekly, Mondays 12:00)

Ground truth for the `membership-tracker` skill. Written 2026-09-01 on Krish's explicit ask:
a recurring weekly tracker of member counts for EVERY live benefit tier, read from the
Playtomic UI, to watch churn and members rolling off. First reading taken same day.

**Scheduling exception (rule 13).** Krish's standing rule is "nothing runs on a timer without
a fresh explicit ask". This skill has that ask (1 Sep 2026, in chat, verbatim "recurring
Monday… do it at 12:00 p.m."): a scheduled task runs it **every Monday 12:00 Europe/London**.
That grant covers THIS task only — the skill itself must never create further timers.

## What it is

A ~5-minute read: per-benefit member counts for ALL live benefits (not just milestone tiers)
→ appended to a week-over-week ledger → deltas + churn flags → short brief. It is the trend
line; `member-census` remains the official monthly milestone scoring vs the Y1 budget, and
`churn-conversion-monitor` remains the per-person churn machinery. This skill names no names —
counts only. If its flags fire, hand off to those skills rather than deepening this one.

## Source (the UI read)

Playtomic Manager → **Rewards & Offers → Benefits**, from the logged-in Chrome tab per
`brain/specs/playtomic-live-pull.md` (same-origin, Krish's login). Method pinned 1 Sep:

- Direct URL `https://manager.playtomic.io/dashboard/rewards/benefits?tid=<tenant-id>` works
  (a cold deep-link may bounce to /dashboard/schedule — just navigate again once the SPA is up).
- Rows-per-page: the page paginates at 10. Set the **third `<select>`** on the page to `100`
  via the native value setter + a bubbled `change` event (selects: 0 = status filter, 1 = type
  filter, 2 = rows-per-page). Clicking the combobox is unreliable; the JS route is pinned.
- Read the table with `get_page_text`; the footer "Showing 1–N of N" MUST equal the number of
  rows parsed, else re-read. Record name, member count, status, type per benefit.
- Archived benefits are excluded by the default view; note any benefit that newly appears,
  disappears, or is renamed vs the ledger's last date.

## Outputs (every run)

1. **Snapshot** `data/playtomic/YYYY-MM-DD-benefits-members.csv`
   (`benefit_name,members,status,type`) — KEEPER, month-end audit trail shared with
   member-census; supersede-don't-accumulate does NOT apply to these (lineage kept).
2. **Ledger append** `data/playtomic/membership-tracker-ledger.csv`
   (`date,benefit,members`, long format, append-only — seeded 1 Sep back to 7 Jul from the
   historical snapshots). This is the file the deltas come from; never rewrite old rows.
3. **Brief** `reports/briefs/YYYY-MM-DD-membership-tracker.md`: per-benefit table
   (count, Δ vs last read), family rollups, flags. PDF only on request.
4. **facts.md entry** with the family rollups + any flags, and vault-sync per rule 12
   (the scheduled run counts as a session that changed facts.md).
5. **Google Sheet mirror — THE CO-FOUNDER'S SHEET (Krish ask, 21 Sep 2026: "From now on… just do it
   on this link… and do it in the same format")**: sheet **"Encourt Membership Tracker"**
   (the co-founder's copy),
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`,
   via the logged-in Chrome. **Match the co-founder's format exactly** — single tab, one column per
   weekly read appended to the right, date header in `DD/MM/YYYY`. Row mapping (A2:A13,
   pinned from the 20/09/2026 seed column; verified against the live 20-Sep read):
   - **Access Monthly** = Access Membership Monthly (app card only)
   - **Access Annual** = Access Membership Annual (invoiced)
   - **Access (other)** = Monthly Launch deal + Annual Launch deal + interim + Access
     Membership Annual (app)
   - **Off-Peak Padel Monthly** = Off Peak Padel Monthly · **Off-Peak Padel Annual** = Off
     Peak Padel Annual
   - **Off-Peak Padel Plus Monthly** = OP PLUS Monthly + OP "+ Wellness" Monthly (legacy)
   - **Off-Peak Padel Plus Annual** = OP PLUS Annual + OP "+ Wellness" Annual + Off Peak
     Membership Annual (invoiced)
   - **Platinum** = Platinum (invoiced) · **Player** = Player M/A + P&W M/A (whole retired
     family)
   - **Intro to Off-Peak** = AUTUMN Intro + classic Intro (funnel) · **Weekend Evening
     Pass** = WEP (funnel)
   - **Membership Total** = SUM of the nine membership rows (Access×3 + OP×2 + Plus×2 +
     Platinum + Player) — equals this spec's PAYING BOOK; intros/WEP excluded.
   Navigate cells via the **Name Box (⌘+J), never grid-click coordinates** (20-Sep
   mis-click lesson). The sheet is a MIRROR — the CSV ledger stays the source of truth;
   on a STALE run skip the sheet like the ledger.
   ⚑ Known seed discrepancy: the seed column has one row off by one vs the live read — flagged to Krish 21 Sep, left as entered.
   *(Superseded: the old sheet
   `<OLD_SHEET_ID>` ("Padel" tab, family-rollup format,
   7 Jul–20 Sep columns) is retired as the Padel mirror target — kept as history, no
   further Padel appends.)*
6. **Pilates tab** (Krish ask, 7 Sep 2026, same session): lives on the **OLD sheet**
   (`<OLD_SHEET_ID>`) — the co-founder's sheet (output #5) has no
   Pilates tab, and the 21-Sep re-point named the Padel tracker only, so Pilates rollups
   KEEP appending to the old sheet's "Pilates" tab until Krish says otherwise (⚑ open
   question: move/retire the Pilates mirror?). Same short format: rows Unlimited
   (memberships) · Class-count (memberships) · **PAYING SUBS** (bold, `=sum`) · Funnel
   (intro offers) · Mat class passes · Packs, drop-ins & other; one column per read
   (seeded 8 Jul / 30 Jul / 7 Sep). **From 12 Oct 2026 the source is TeamUp** (BSport retired):
   method per `brain/specs/teamup-pilates-pull.md` — membership rows from the
   `customer_memberships` API (type recurring, status active; dedup run-off twins), funnel/packs
   rows = active packs (Reformer Intro offer). Ledger (source of truth) moved to
   `data/teamup/pilates-tracker-ledger.csv` (`date,source,product,count`, append-only,
   live-reads-only; BSport rows kept above the TeamUp rows). The Monday run appends a date column to BOTH tabs; counts only — per-person
   Pilates flags (failed payments, credit-exhausted intros) stay with `bsport-pilates-pull`.
   (BSport-era quirk, now moot: the Passes report died 23 Sep 2026 and blocked the mirror until
   the TeamUp move.)

## Analysis rules

- **Families** (mapping locked, mirrors member-census): Access\* → **Access** · Off Peak\*
  excl. intros → **Off-Peak** · Platinum (invoiced) → **Platinum** · Player\*/P&W\* →
  **Player/P&W** (retired card, run-off — should only shrink) · Intro + AUTUMN Intro +
  Weekend Evening Pass → **funnel** (roll-off here is EXPECTED churn, report separately) ·
  Encourt Staff Perk, Gym only, One time purchase → **non-tier**, excluded from paying book.
  NB (21 Sep 2026): **"Off Peak Padel PLUS - Monthly/Annual" = the RENAMED legacy "Off Peak
  Padel & Wellness" products** (rename ~5–7 Sep; the ledger's 7-Sep PLUS debut is a rename
  artifact, continuity via the 21-Aug census rosters). Renames fake new products — on any
  new/vanished benefit, check rosters before calling it a launch or a kill (trap 33).
- **Paying book** = Access + Off-Peak + Platinum + Player/P&W (staff/funnel/non-tier out).
- **Counts are subscription/tag counts, not dedup'd people** — joint/double-holders and
  club-side manual grants are in (traps 19/21); say "member-slots" when precision matters.
- **Churn flags** (any → name it in the brief headline and facts):
  (a) any single paying benefit down ≥2 WoW; (b) any paying benefit down two consecutive
  reads; (c) paying book down WoW at all; (d) Player/P&W family GROWING (retired card still
  selling); (e) a milestone family (Access/OP/Platinum) down in the week a monthly milestone
  is scored.
- Intro count falling = funnel expiry, not member churn — cross-reference the
  churn-conversion-monitor's conversion read rather than raising a churn flag.
- **AUTUMN double-buyers — EVERY run (Krish standing ask, 30 Oct 2026: "tell me if anyone has
  bought autumn offer more than once always").** From the `benefit-subscriptions` sweep, count
  AUTUMN subs per user (ACTIVE + INACTIVE); any user with ≥2 is named in the brief AND in chat
  on every run, split into KNOWN (already on the refund ledger / 22-Oct sheet / converted /
  refunded) and NEW. "Nobody new" is still said out loud. Baseline 30 Oct: five known (names/ids redacted). A NEW name
  hands off to `intro-rebuy-refund-run` for the refund maths — this skill only names them.

## Fallback

Playtomic unreachable → report from the newest snapshot, label the read STALE ("stale pull,
D-x") in brief + facts, and do NOT append a stale row to the ledger (the ledger is
live-reads-only). Never silently substitute.

---
Linked: [[Metrics that Matter]], [[Retention & Member Experience]]
