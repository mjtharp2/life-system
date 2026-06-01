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

## Step 4 — Propose the week

On the gathered baseline + constraints, propose the coming week day-by-day.
Shaping inputs:
- The skeleton is the load-bearing default (gym/cardio/tennis, relationship
  nights, focus blocks, family time).
- Last week's slips — carry forward; escalate anything rescheduled 3+ times.
- Recent regulation state — if the week was pressed or showed L2 signals, size
  the coming week SMALLER. The system serves regulation, not optimization.
- Trainer's recent/upcoming programming — protect prescribed sessions and
  recovery windows.
- Sentinel + Tenex commitments are immovable; fit around them.
- A PM parenting shift does NOT preclude couple/relationship time — don't read a
  shift as blocking a date or quality time. Confirm rather than assume.

**Conflict cadence:** when gathered constraints collide with the skeleton,
surface one conflict at a time and ask what the user wants before resolving it —
don't auto-resolve or present a finished schedule.

Propose the week, the user reviews and edits, then write the agreed plan.

**Set write-mode once at the top of the forward plan** — ask "autonomous writes
on or off this session?" and proceed accordingly for the rest of the session;
don't re-confirm scope per item.

Write targets:
- **Todoist** and **personal Google primary** — write directly.
- **Tharp Family** — confirm before each add/move/edit/delete; re-read the
  calendar immediately before writing (shared — Lauren writes, nannies
  coordinate against it). This confirm-gate stands regardless of write-mode.
- **Never write** Sentinel, Tenex, or any M365 calendar — read-only constraints.

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
