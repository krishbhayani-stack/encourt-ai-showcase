# Skills — The Default Building Block

Prefer adding a skill here over creating a new agent or script with judgment baked in.

Each skill is a folder with a `SKILL.md`:

```
.claude/skills/
└─ my-skill/
   └─ SKILL.md
```

`SKILL.md` starts with frontmatter:

```markdown
---
name: my-skill
description: When to use this skill.
---

Instructions...
```

Rule of thumb: deterministic logic → `scripts/`; reusable AI instructions → a skill here; only truly general judgment → the strategy-analyst agent.

## Live skills (2026-07-30)

| Skill | One-liner | Spec |
|---|---|---|
| `playtomic-live-pull` | Shared plumbing: live manager-API pulls with every trap encoded — other skills call this | `brain/specs/playtomic-live-pull.md` |
| `purep2p-desk-sheet` | Nightly top 5–7 pure pay-to-play desk sheet PDF for a playing date | `brain/specs/pure-p2p-desk-sheet.md` |
| `revenue-kpi-review` | Weekly actuals vs Y1 Budget: revenue, occupancy, flags, brief | (method in skill + `brain/targets-and-kpis.md`) |
| `occupancy-drop-diagnosis` | Root-cause procedure when occupancy/court fees drop | (method in skill) |
| `churn-conversion-monitor` | Weekly true intro-conversion %, funnel, loophole re-buys, new lapses | `brain/specs/churn-conversion-monitor.md` |
| `lapsed-winback-call-sheet` | Lapsed/expired list refresh + graduation-pitch call sheet PDF | `brain/specs/lapsed-winback-call-sheet.md` |
| `member-census` | Live tier counts vs Y1 milestone table, red/green | `brain/specs/member-census.md` |
| `competitor-social-refresh` | IG/TikTok competitor delta read + own-account hygiene check | `brain/specs/competitor-social-refresh.md` |
| `teamup-pilates-pull` | Per-person Pilates run from TeamUp (BSport retired 12 Oct 2026): census, recurring base, missing-card risk, sales, fill, revenue vs the Pilates budget line | `brain/specs/teamup-pilates-pull.md` |
| `xero-cost-actuals` | Month-end costs vs cost guardrail + net-VAT revenue cross-check (KPI flag rule 5) | `brain/specs/xero-cost-actuals.md` |
| `vault-sync` | Session close-out: fold facts/decisions into the Obsidian vault, refresh Daily Focus, commit | `brain/specs/vault-sync.md` |

Archived: `monday-owners-pack` → `_archive/skills/` (2026-07-30, overlapped with revenue-kpi-review).
