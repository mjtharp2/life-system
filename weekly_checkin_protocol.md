# Weekly Check-In — Session Protocol

*The ritual-runner for the weekly check-in. A fresh thread reads this, runs the
session, and writes a new entry to `weekly_log/`. Tier 2 — loaded when running a
check-in, not every conversation.*

## What this session is

One session, two halves: backward review of the week just completed, then
forward plan for the week ahead. The forward plan is scheduler-assisted — it
reads live calendars, tasks, and substrate and proposes the week against the
skeleton. Output is a new `weekly_log/YYYY-MM-DD.md` entry and an updated INDEX.

Runs as its own fresh thread each week. Continuity lives in the substrate (the
log library), not thread history. Do not rely on prior conversation — read the
library.

## Step 0 — Orient (read substrate first)

Read, in order:
1. `weekly_log/INDEX.md` — conventions, current pointer, recent-weeks
   trajectory, and the active watch-fors from last week. These drive the
   backward review.
2. The most recent entry (current pointer from INDEX) — last week's full
   backward review, forward plan, watch-fors.
3. `life_system_reference.md` — strategy, tiers, weekly skeleton, regulation
   protocol.
4. `system_architecture.md` — current build state + System Cadences section
   (for the 90-day proximity check).

Compute the Monday of the week being planned (the upcoming Monday if today is
Sunday; today itself if today is Monday) = this session's output filename
`weekly_log/YYYY-MM-DD.md`.

## Step 1 — Backward Review

Open on last week's watch-fors. Walk each: resolved, persisting, or escalating?
That's the spine.

Assemble actuals from substrate, not memory:
- **Sleep/recovery** — Apple Health connector: 7-day sleep avg, notable nights,
  RHR/HRV if relevant.
- **Workouts** — trainer log via custom MCP `training_query_log` (recent
  sessions) cross-referenced with Health (performed). Adherence vs. planned.
- **Tasks shipped vs. slipped** — Todoist: due last week, completed,
  rescheduled, open. Flag anything rescheduled 3+ times.
- **Calendar actuals** — skeleton called-for vs. what calendars show happened
  (skeleton compliance: workouts, relationship nights, focus blocks).

Qualitative layer the user supplies in conversation (do not fabricate — prompt
for these): relationships, work, regulation state, stimulant/vape contract,
anything notable.

**Regulation events** — explicitly ask and record: none / Level 1 / 2 / 3.

Produce a Headline (one line) and the structured-signal values for frontmatter.

## Step 2 — Forward Plan (scheduler-assisted)

### 2a. Read constraints (availability, not content)

Read times + busy/tentative/free; do NOT pull meeting bodies/attendees.
- **Google** — `list_calendars`, then read ONLY allowlisted calendars: personal
  primary, Tharp Family (`@group` ID), Tenex feed (sole
  `@import.calendar.google.com` entry). Ignore sports / Home Maintenance /
  Emma's / legacy Family.
- **Sentinel** — Microsoft 365 connector, Sentinel tenant.
- **Todoist** — active tasks with coming week in scope; do-dated items; queued
  items eligible to schedule.

Preprocessing (see dashboard_state.md → Data Sources for full rules):
- Normalize all times to America/Chicago. Sentinel returns UTC; Tenex feed
  carries mixed per-event timezones. Normalize before reasoning.
- Drop cancelled events — filter `transparency: transparent`, not "Canceled:"
  subject text.
- For M365, key on `showAs` (busy/tentative/free); treat tentative as soft.

### 2b. Propose the week

Against the skeleton (reference doc) and the constraints, propose day-by-day.
Shaping inputs:
- Skeleton is the load-bearing default (gym/cardio/tennis, relationship nights,
  focus blocks, family time).
- Last week's slips — carry forward; escalate 3x-rescheduled items.
- Recent regulation state — if Level 2 signals or pressed capacity, size the
  week SMALLER. The system serves regulation, not optimization.
- Trainer's recent/upcoming programming — protect prescribed sessions +
  recovery windows.
- Sentinel + Tenex commitments are immovable constraints; fit around them.

Output as a reviewable day-by-day block. PROPOSE ONLY — no calendar writes in
this step. User reviews/edits in conversation.

### 2c. Write-back (after approval, per-surface rules)

Only after user approves:
- **Todoist** — do-dates on committed items.
- **Personal Google primary** — personal blocks (workouts, focus, appts).
- **Tharp Family** — parenting/family events ONLY; confirm before each
  add/move/edit/delete; re-read the calendar immediately before writing so the
  change reflects current state (shared calendar — Lauren writes, nannies read
  and coordinate against it).
- **Never write** — Sentinel, Tenex, any M365 calendar. Read-only constraints.

Early-runs note: write-back may stay manual (user makes entries) until propose
quality and write path are both trusted. Do not combine first-proposal and
first-autonomous-write in one session.

## Step 3 — Phase scan + 90-day proximity (light touch)

- Phase-progression scan: quick read on whether any strategic phase (health,
  system architecture, therapy track) shows readiness to advance or signs of
  stuck. Light surfacing only — capture as watch-fors or 90-day-review inputs.
  Rigorous evaluation is the quarterly job.
- 90-day proximity: read System Cadences in system_architecture.md. Within 2
  weeks → watch-for. Within 1 week → add "block ~2 hours, identify inputs."
  Due/overdue → next week is a 90-day review session.

## Step 4 — Triage (Sunday is primary triage block)

Process Todoist Inbox: assign project / tier / deadline / optional time + focus
labels. Assign do-dates to items committed to the week ahead. Friday flex block
is execution, not triage.

## Step 5 — Write the entry

Write `weekly_log/YYYY-MM-DD.md` (Monday of the planned week) in library
format: frontmatter (from this session's signals) + narrative (Backward Review,
Forward Plan, Skeleton Deviations, Watch-Fors, Phase Scan, Process Notes).

Update INDEX.md: move current pointer to this entry, prepend to recent-weeks
table, refresh active watch-fors.

Watch-Fors are the handoff — write them as the explicit things next week's
backward review opens on.
