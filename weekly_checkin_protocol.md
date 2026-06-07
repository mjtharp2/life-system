# Weekly Check-In — Session Protocol

*The ritual-runner for the weekly check-in. A fresh thread reads this and runs
the session as a conversation, then writes a new entry to `weekly_log/`. Tier 2
— loaded when running a check-in, not every conversation.*

**How to run this: it's a conversation, not a report.** Ask, wait for the
answer, follow it. Gather context from the user before analyzing or
recommending — in both the backward and forward halves. Read substrate to
support and cross-check what they tell you, never to pre-form conclusions and
present them. Keep your turns short. Do not narrate your own process, do not
display step structure or taxonomies to the user, do not open with walls of
analysis. One or two things at a time.

**Read path note:** `web_fetch` serves stale cached copies of this repo. Use
curl/bash against `raw.githubusercontent.com` where available. If you must use
web_fetch and a doc looks stale or contradicts the project instructions,
re-pull before trusting it.

## Step 0 — Orient quietly

Read, without commentary to the user:
- this protocol
- `weekly_log/INDEX.md` (conventions, current pointer, active watch-fors)
- the most recent entry (the current pointer in INDEX)
- `life_system_reference.md` (strategy, skeleton, regulation protocol)
- `system_architecture.md` (build state + System Cadences, for the 90-day check)

Note today's date; compute the output filename `weekly_log/YYYY-MM-DD.md`
(Monday of the week being planned). Do not report orientation back to the user
— just begin the conversation.

## Step 1 — Backward review (open with their read)

**Open by asking how the week went — their read first, before you analyze.**
Let them talk. Then walk last week's watch-fors *with* them, one thread at a
time, bringing in what the substrate shows as you go (trainer log via
`training_query_log`; Todoist completions; calendar actuals; Apple Health) — as
support for the conversation, not as a pre-written verdict you present.

Cover, conversationally and without interrogating: regulation events
(none / L1 / L2 / L3), stimulant/vape contract, sleep, relationships, work,
what shipped vs. slipped. Where the substrate already answers something,
confirm it briefly rather than asking.

**Close the backward review with an open catch question:** "Anything else from
the week worth capturing that I haven't asked about?"

## Step 2 — Forward gathering (ask before planning)

**Before any planning, ask the small opening set and wait for the answers:**
- What's idiosyncratic about the coming week — anything different from the
  normal skeleton?
- Any fixed parenting blocks / immovable Tharp Family commitments to plan
  around?

These are the baseline the plan is built on. Only after you have them, read the
week's constraints to fill in *around* what they told you — availability, not
content (times + busy/tentative/free; don't pull meeting bodies/attendees):
- **Google** — `list_calendars`, then read ONLY allowlisted calendars: personal
  primary, Tharp Family (`@group` ID), Tenex feed (sole
  `@import.calendar.google.com` entry). Ignore sports / Home Maintenance /
  Emma's / legacy Family.
- **Sentinel** — Microsoft 365 connector, Sentinel tenant.
- **Todoist** — active + queued items in scope for the coming week.

Preprocessing (full rules in dashboard_state.md → Data Sources & Access):
normalize all times to America/Chicago (Sentinel returns UTC; Tenex feed
mixed); drop cancelled events (`transparency: transparent`, not the "Canceled:"
subject text); for M365 key on `showAs`, treat tentative as soft.

## Step 3 — Triage (conversational)

Ask about live to-dos as part of gathering — not autonomous Inbox processing.
What's actually live, what's stale, what's committed to the coming week. Work
through Inbox items with the user; assign project / tier / deadline / dates.
Catch stale deadlines by asking, don't auto-fix. Sunday is the primary triage
block; Friday flex is execution, not triage.

**Read the full backlog, not a filtered slice.** Pull every open task across all
projects and all states — @active, waiting, and needs-scoping, dated and
undated — not just dated items, not just the Inbox, not just P1. Use priority to
surface and rank (highest-tier first), never as a filter that hides lower-tier
work. Failure mode to avoid: triaging only dated items + Inbox (which buries
undated high-tier work parked in waiting/needs-scoping), or filtering to P1
(which ignores the rest of the backlog). Categorize by domain, offer windows.

Triage status is mandatory to record in the entry's Process Notes — one of: (a) triage run this session, (b) deferred to manual this week (note it explicitly and add a `todoist_triage_*` watch-for so next week confirms the manual pass happened). Do not let triage silently drop.

## Step 4 — Stage and commit the week

The forward plan is a **staged negotiation with sequential writes**. Each stage
commits its result to the relevant external surface (calendar / Todoist) before
the next stage begins, so each stage works against the actually-committed shape
of the week, not a draft. The substrate write happens once at the end (Step 6)
with the composed session signals; per-stage writes go to calendar and Todoist
only.

**Set write-mode once at the top** of the forward plan ("autonomous writes on
or off this session?") and proceed; don't re-confirm scope per item. The
Tharp-Family confirm-before-mutation rule stands regardless of write-mode.

### Stage 1 — Parenting windows (batch)

Ask the user for the week's parenting pattern in one prompt. The user
typically already knows it and will reply in shorthand (e.g. "Mon AM, Tue PM,
Wed all day, Thu AM, Sat afternoon"). Parse the shorthand into a full week of
Tharp Family events. Surface the parsed set for one confirm covering the
batch, then batch-write the whole week to Tharp Family Calendar in a single
write. Re-read the calendar immediately before writing (Lauren may have added
events since session start).

Do NOT proceed to stage 2 until parenting is committed.

### Stage 2 — Workout windows

With parenting committed, place workout windows against the remaining shape of
the week. Inputs:

- The **default workout pattern** (from `trainer/program.md` → Default Weekly
  Pattern): 3 gym days, Saturday tennis, 1 home VO2 max day, Sunday stretching,
  1 flex day (often yoga).
- The trainer's recent state and any forward hints from
  `training_query_log` — recent log entries' `next_session.prescription_hints`
  signal what the trainer expects to do next.
- The week's idiosyncrasies (travel, low-energy days, injury constraints
  surfaced in the forward-gathering open).

Propose the workout windows day-by-day in a single block; user adjusts in
conversation. Once agreed, write the workout blocks to the **personal Google
primary** calendar. Hold the structured slot data (day, time, category,
constraint_note) in agent memory for the end-of-session substrate write — do
not call `weekly_write_checkin` here.

### Stage 3 — Flag clearly-open windows

With parenting and workouts committed, identify time blocks that are now
clearly open (no work meeting, no parenting, no workout). Surface them to the
user as the week's available scheduling capacity — not as a question, just as
visible inventory the later stages will allocate against. No writes in this
stage; it's information for stage 5.

### Stage 4 — Day-by-day work-calendar triage

Walk the week's work-calendar blocks (Sentinel + Tenex), day by day, asking
per block what's skippable. The user decides; the agent does NOT write to work
calendars regardless of the answer (work calendars are read-only constraints
in this system — drops happen via the user manually declining or removing
themselves from the meeting, not via agent write).

This stage will be slow on early runs because the agent has no
calendar-interpretation rules yet to skip asking on known-defaults. As rules
accumulate (carried forward at the end of each weekly_log entry — see below),
the agent short-circuits known cases and only asks on ambiguous blocks.
Expected behavior, not a bug.

**Calendar interpretation rules.** Read the prior week's entry's "Calendar
interpretation rules" section at session start. As you walk each block in
stage 4:

- If a rule applies to a block, confirm with the user before acting on it
  ("rule says Monday all-hands is skippable — still true?"). User says yes →
  apply, move on. User says no → rule didn't hold this session; flag it for
  the Step 7 review (proposed deletion). One non-holding is enough to propose
  deletion; user confirms in Step 7.
- If the user flags a meeting as durably skippable / fixed / soft-recurring
  (any judgment that's true beyond this week), capture it as a proposed rule
  addition for the Step 7 review. Don't write it yet — Step 7 is the review
  point.
- Rules that didn't fire this session (the event didn't happen — holiday,
  cancellation, you weren't on the invite this week) are irrelevant: ignore,
  don't surface in Step 7.

The rules accumulate slowly. Early weeks will be mostly additions; deletions
appear once rules have lived long enough to be tested by reality.

### Stage 5 — Prioritize Todoist against the week

There is no hard non-negotiable rule. Pull the active backlog and surface it
by priority, with relevant flags, to work through with the user.

Read Todoist for all `active`-state tasks across projects to build the week's
slot plan. For slot-allocation, `waiting` / `someday` / `needs scoping` are out
of scope — but they are NOT out of scope for the check: two mandatory sweeps
below cover the rest of the backlog so nothing sits in limbo or blocked
unwatched. Rank the surfaced active list:

1. Tasks with a **specific date** this week.
2. Tasks with a **due date** this week.
3. Then by priority tier (P1 → P2 → P3), with slip-flag prominent where the
   agent can compute it (date moved forward from a prior week's plan).

**Two mandatory sweeps on the full backlog (not just the active set).** Pull
every open task across all projects and states — the all-priorities filter
`(p1 | p2 | p3 | p4)` returns everything; inspect each task's labels
client-side. The `@active` / label-parameter filters silently miss any task
that has no state label at all, which is exactly what these sweeps exist to
catch.

1. **Limbo sweep — no state label.** Any task carrying none of `active` /
   `waiting` / `someday` / `needs scoping` is unprocessed, not deliberately
   parked. Surface every one, grouped by project, and triage it WITH the user:
   assign a state label, a real tier (P1–P3 — don't leave an active task at
   default P4), and a date if it's active. Subtasks of an already-stated parent
   are steps, not independent limbo — leave them unless the user says
   otherwise. Mandatory every week; a clean run (zero limbo tasks) is a valid
   result, but it must be checked, not assumed.

2. **Unblock check — `waiting` and `needs scoping`.** Walk these two states
   briefly and ask, per item, whether it's moved: a `waiting` item whose
   blocker has cleared → promote to `active` (give it a tier, and a do-date if
   appropriate); a `needs scoping` item the user is ready to scope → schedule a
   scoping block, not the unscoped work. Items still genuinely blocked or
   unscoped stay put. The point is a weekly heartbeat so nothing sits blocked
   indefinitely with no one looking at it. (`someday` is deliberately NOT swept
   here — it's the parking state, reviewed at the quarterly checkpoint.)

Surface this prioritized view alongside the open time windows from stage 3.
Walk through it collaboratively — user decides what gets a slot, what defers.
Write agreed do-dates to Todoist as items are committed (sequential write).

For `needs scoping` items that surface in inbox triage or come up in the
walk-through: the right next step is usually scheduling a *scoping block*
(a planning session for the work), not the work itself. Suggest scoping
blocks; don't try to schedule the unscoped work directly.

When the backlog exceeds available slots (it usually will), name what's being
deferred explicitly and surface those items as watch-fors for next week's
review. Visible deferral is the discipline; silent dropping is what we're
preventing.

Lauren/Emma duplicate-task handling: when the agent spots likely duplicates
across the two relationship projects (e.g., the same "integration
conversation" in both), flag it and ask whether one block can cover both.
Do not merge or delete across these projects without explicit confirmation.

See `todoist_taxonomy.md` for the full conventions reference.

## Step 5 — Phase / 90-day scan (light touch)

Quick read on whether any strategic phase (health, system architecture, therapy
track) shows readiness to advance or signs of being stuck — surface as
watch-fors, don't deep-evaluate (that's the quarterly job). 90-day proximity
from System Cadences: within 2 weeks → watch-for; within 1 week → "block ~2
hours, identify inputs"; due/overdue → next check-in is a 90-day review session.

## Step 6 — Write the entry

Write `weekly_log/YYYY-MM-DD.md`: frontmatter (signals from this session) +
narrative (Backward Review, Forward Plan, Skeleton Deviations, Watch-Fors,
Phase Scan, any Process Notes). Verbatim user context where it matters; don't
over-summarize.

Update `INDEX.md`: move the current pointer to this entry, prepend it to the
recent-weeks table, refresh the active watch-fors.

By this point in the session, parenting blocks (Tharp Family), workout windows
(personal Google), and Todoist do-dates have already been written to their
respective surfaces during stages 1, 2, and 5. This Step 6 substrate write
is the session-level composition — it does not duplicate per-stage writes.

**Write the structured signals to substrate.** After the markdown entry is
written, call `weekly_write_checkin` with the structured payload:
- week_start (Monday of the planned week, YYYY-MM-DD)
- checkin_date (today)
- headline (the one-line week summary)
- sleep_avg_7d, regulation_events, workout_adherence, stimulant_contract,
  operating_mode — the signals gathered this session (omit any not captured)
- watchfors (the watch-for slugs carried to next week — same ones written to
  INDEX)
- narrative_path (the relative path to the markdown entry just written, e.g.
  weekly_log/2026-06-01.md)
- training_slots: the week's agreed workout slots, each { day (YYYY-MM-DD),
  time, category (lift/cardio/tennis/mobility/rest), constraint_note (optional) }

This is the same content as the markdown entry's frontmatter plus the training
slots — the markdown is the human-readable record, the substrate row is the
queryable one and the trainer's slot source. If re-running a check-in for a week
already written, use `weekly_update_checkin` with the existing checkin_id
instead.

Watch-Fors are the handoff to next week — write them as the explicit things
next week's backward review opens on.

## Step 7 — Calendar interpretation rules review

Before closing the session, present the rules list and proposed changes for
user review. Three pieces:

1. **Current rules** carried forward from the prior week's entry's "Calendar
   interpretation rules" section. Display the full list — the weekly review
   is the moment they're visible.
2. **Proposed additions** — rule-worthy moments captured during stage 4.
3. **Proposed deletions** — rules flagged as not-holding during stage 4.

User approves, adjusts, or rejects each change. Agreed rules become the
updated list.

Write the updated list as the **"Calendar interpretation rules"** section at
the end of the new weekly_log entry. Use a consistent header (exactly that
text — the next week's check-in needs to find it by name). Format each rule
with light structure:

    - **[event identifier]** — [judgment]. *Added [date]. [optional note].*

Example:

    - **Monday 9am all-hands** — always skippable. *Added 2026-06-01.*
    - **Quarterly board prep block** — fixed, do not move. *Added 2026-06-08.*

The rules section lives in the narrative weekly_log entry (the markdown file),
not in the `weekly_write_checkin` substrate row. The substrate row's
`narrative_path` already points at this file; next week's check-in fetches it
and reads the rules from the end.

If no rules existed and no additions came up this session, write a
"Calendar interpretation rules" section header with a note that the list is
empty — keeps the structure consistent for parsing next week.
