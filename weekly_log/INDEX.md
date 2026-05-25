# Weekly Log — Index

*Orient-first file. Any weekly-check-in or scheduler thread should read this before pulling specific entries.*

## Conventions

**File naming.** `weekly_log/YYYY-MM-DD.md` where the date = **Monday of the week being planned** by that check-in. A Sunday check-in on 2026-05-17 planning the upcoming week (May 18-25) becomes `2026-05-18.md`. Today's relevant file is `today - today.weekday()` (Mon of current ISO week) formatted as YYYY-MM-DD.

**Per-entry structure.** YAML frontmatter (queryable signals) followed by the existing narrative verbatim — Backward Review, Forward Plan, Skeleton Deviations, Watch-Fors, Phase-Progression Scan, Process Notes. Move text, don't rewrite.

**Frontmatter fields.**

- `week_start` — Monday of the planned week (matches filename).
- `date_range` — how the entry labels the week (may overlap the next Monday).
- `checkin_date` — when the check-in actually happened (typically the Sunday before `week_start`).
- **Quantitative measurements describe the PRIOR week reviewed**, not the planned week — those are the only measurements that exist at check-in time:
  - `energy_self_rating`, `mood_self_rating`, `sleep_quality_self_rating` — integer 1-10.
  - `sleep_avg_7d` — Apple Health / Oura 7-day sleep score average (0-100).
  - `workouts_completed` — integer count.
- `regulation_events` — `none`, or a list of `level_1` / `level_2` / `level_3`.
- `stimulant_contract` — `held` / `wavered` / `broken` / `not_recorded`.
- `carryover_watchfors` — short slugs derived from the entry's Watch-Fors section. These drive the next check-in's backward review.

Use `not_recorded` for any field the entry doesn't capture. Don't infer.

## Current pointer

Most recent entry: **`2026-05-25.md`** (week of May 25-31, 2026; check-in 2026-05-25, holiday-shifted).

## Recent weeks

| File | Week | Headline | Sleep 7d (prior wk) | Regulation | Contract |
|---|---|---|---|---|---|
| `2026-05-25.md` | May 25-31 | Strong week (8/10). Back to standard rhythm; meeting-saturated work week, focus work carved from the workday. First live autonomous Todoist + calendar writes. | not_recorded | none | held |
| `2026-05-18.md` | May 18-25 | Solid week. Baseline structure starting to form. Watch slippage as system moves toward normalcy. | not_recorded | none | held |
| `2026-05-11.md` | May 11-17 | Solid. Week-1 euphoria fading as predicted; system held under vacation disruption. Phase 0 shipped Friday. | 67 | none | wavered |
| `2026-05-04.md` | May 4-11 | Excellent first week. Strong start, motivating. Reframe is the bigger win than execution. | not_recorded | none | held |

(Sleep / regulation / contract values describe the week being backward-reviewed, not the week being planned.)

## Active watch-fors (carry into next check-in's backward review)

From `2026-05-25.md`:

- `vo2_third_attempt` — slid twice; Thu 5/28 is attempt three with a protected slot
- `work_focus_fit_offhours` — did GTM (Wed) + two CS blocks (Thu) survive the wall-to-wall meeting week?
- `family5_sunday` — first scheduled all-five block; additive or load?
- `tue_pm_lift` — first evening lift under the shuffled-shift pattern
- `friday_date_night` — PM Addie shift + sitter date; did it come together?
- `lauren_integration_still_blocked` — June 9 review's upstream; still blocked?
- `first_autonomous_writes` — did this session's live writes hold up in practice?
- `achilles_watch` — probable early tendinopathy; eval if not settling in ~a week

---

*Maintained going forward: each new weekly entry updates the current pointer, prepends to the recent-weeks table, and refreshes active watch-fors. The original single-file weekly_log.md is preserved at `archive/weekly_log_pre-library.md`.*
