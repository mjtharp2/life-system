# Weekly Log — Index

*Orient-first file. Any weekly-check-in or scheduler thread should read this before pulling specific entries.*

## Conventions

**File naming.** `weekly_log/YYYY-MM-DD.md` where the date = **Monday of the week being planned** by that check-in. A Sunday check-in on 2026-05-17 planning the upcoming week (May 18-25) becomes `2026-05-18.md`. Today's relevant file is `today - today.weekday()` (Mon of current ISO week) formatted as YYYY-MM-DD.

**Per-entry structure.** YAML frontmatter (queryable signals) followed by the existing narrative verbatim — Backward Review, Forward Plan, Skeleton Deviations, Watch-Fors, Phase-Progression Scan, Process Notes. Move text, don't rewrite.

**Calendar interpretation rules** (section at end of each entry). Carried
forward and updated each week per Step 7 of the check-in protocol. Format:
light-structured list, one rule per line, with `**event identifier**`,
judgment, *Added [date]*, optional note. The most recent entry's rules section
is the canonical current rule set — older entries hold historical snapshots.
If empty, include the header with a note rather than omitting it (so the
parsing pattern stays consistent).

**Frontmatter fields.**

- `week_start` — Monday of the planned week (matches filename).
- `date_range` — how the entry labels the week (may overlap the next Monday).
- `checkin_date` — when the check-in actually happened (typically the Sunday before `week_start`).
- **Quantitative measurements describe the PRIOR week reviewed**, not the planned week — those are the only measurements that exist at check-in time:
  - `energy_self_rating`, `mood_self_rating`, `sleep_quality_self_rating` — integer 1-10.
  - `sleep_avg_7d` — Apple Health / Oura 7-day sleep score average (0-100). Source from Oura; Apple returns overlapping stage samples, not a score.
  - `workouts_completed` — integer count.
- `regulation_events` — `none`, or a list of `level_1` / `level_2` / `level_3`. (Ulysses-contract breaks are tracked separately in `stimulant_contract`, not here.)
- `stimulant_contract` — `held` / `wavered` / `broken` / `not_recorded`.
- `carryover_watchfors` — short slugs derived from the entry's Watch-Fors section. These drive the next check-in's backward review.

Use `not_recorded` for any field the entry doesn't capture. Don't infer.

## Current pointer

Most recent entry: **`2026-06-22.md`** (week of June 22-28, 2026; check-in 2026-06-21).

## Recent weeks

| File | Week | Headline | Sleep 7d (prior wk) | Regulation | Contract |
|---|---|---|---|---|---|
| `2026-06-22.md` | Jun 22-28 | Pressed/recovery off a 2-week check-in gap (backward review spans 6/08-6/21). First real workout-adherence crack (back-half-of-week collapse); stimulant contract broke a 3rd week running; six-week review → decision to enter couples therapy (Teresa); EMG confirmed active reinnervation (best case); a cold (onset 6/18) flattened the back half. | not_recorded (down from illness) | none | broken |
| `2026-06-08.md` | Jun 8-14 | Hold-steady week around the EMG (Fri), the Lauren six-week review (Wed), and two back-to-back concert nights (Thu/Fri). Prior week net-positive and optimistic, but the stimulant contract broke a second week running and a neck/facet symptom surfaced twice pre-EMG. Triage run, Inbox cleared. | not_recorded | none | broken |
| `2026-06-01.md` | Jun 1-7 | Hold-the-line week: two conference days + meeting-wall Monday leave no focus container, deep work unplaced; anchors fit. Prior week strong but contract broke + work blocks slipped again. | not_recorded (~6h/night, under floor) | none | broken |
| `2026-05-25.md` | May 25-31 | Strong week, 8/10. Productive, on schedule; VO2 finally landed, Achilles settling. First live autonomous Todoist + calendar writes. | not_recorded | none | held |
| `2026-05-18.md` | May 18-25 | Solid week. Baseline structure starting to form. Watch slippage as system moves toward normalcy. | not_recorded | none | held |
| `2026-05-11.md` | May 11-17 | Solid. Week-1 euphoria fading as predicted; system held under vacation disruption. Phase 0 shipped Friday. | 67 | none | wavered |

(Sleep / regulation / contract values describe the week being backward-reviewed, not the week being planned.)

## Active watch-fors (carry into next check-in's backward review)

From `2026-06-22.md`:

- `back_half_workout_consistency` — front-half strong, back-half collapse is the named pattern; did back-half-of-week adherence hold this time?
- `stimulant_contract_three_week_trend` — broke three weeks running; trend now, not a slip — does it reset or keep running?
- `cold_recovery_gated_sessions` — did the cold clear, and did the readiness-gated sessions actually hold (gate respected, not overridden)?
- `teresa_intro_call` — did the Thu 6/22 couples-therapy intro call with Teresa happen?
- `reinnervation_mwf_pec_cadence` — did the MWF every-other-day pec cadence hold (the lever that maximizes the EMG finding)?
- `friday_post_concert_lift_readiness` — Fri lift after back-to-back concert nights; where did readiness land?
- `sentinel_workshop_prep_outcome` — did the sitter-contingent Mon-night prep happen, and how did the Wed 12-5 strategy workshop go?
- `gtm_ops_cadence_scoping_0701` — GTM/Ops cadence needs a scoping block before its 7/1 date; did it get one?
- `baltimore_travel_booked` — did the Baltimore travel get booked?
- `sitter_protected_work_coverage` — did sitter coverage for protected work time materialize?

---

*Maintained going forward: each new weekly entry updates the current pointer, prepends to the recent-weeks table, and refreshes active watch-fors. The original single-file weekly_log.md is preserved at `archive/weekly_log_pre-library.md`.*
