# Life System Dashboard

This is a personal life-system dashboard. It pulls Oura ring data (via a Cloudflare Worker proxy) and combines it with locally-stored self-tracking — regulation check-ins, habit tracking, a weekly review, and trend charts.

## Architecture
- Frontend: single-file index.html on GitHub Pages at https://mjtharp2.github.io/life-system
- Oura proxy: Cloudflare Worker at plain-hill-28ab.mjtharp2.workers.dev
- Data: localStorage (migrating to D1 in Phase 4)

### Reference docs
- `life_system_reference.md` — strategy
- `dashboard_state.md` — current state
- `system_architecture.md` — build plan
- `weekly_log/` — per-week check-in library; start at `weekly_log/INDEX.md`. Each entry is `YYYY-MM-DD.md` (Monday of the planned week) with YAML frontmatter + narrative. Original single-file log preserved at `archive/weekly_log_pre-library.md`.
- `todoist_taxonomy.md` — durable Todoist conventions (projects, priority tiers, labels, date/slip rules); read during check-in triage + weekly prioritization (stage 5)
- `ideation_log.md` — parked extensions and architectural ideas

## Build context
We are extending this dashboard into a full life-system operating layer with Todoist + Calendar + Scheduler integration. See the architecture spec for the full plan (will be added to repo as system_architecture.md).

## Commit conventions
Use clear conventional-commit-style messages: feat:, fix:, refactor:, docs:, chore:.
