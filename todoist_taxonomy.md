# Todoist Taxonomy

The durable conventions for how Todoist is structured and used. The check-in
agent reads this when triaging the inbox and prioritizing the weekly backlog
(stage 5 of `weekly_checkin_protocol.md`). Future task-aware agents (live
scheduler updates, etc.) read it for the same reason.

Tier 2 — fetched when triage or scheduling is the active work, not on every
conversation.

## Project structure

Every task lives in a project. The full set:

- **Work** — parent project with sub-projects:
  - **Sentinel** — operating-lead work for Sentinel.
  - **Netcov** — operating-lead work for Netcov.
  - **Tenex** — Tenex-related work outside of portfolio-company operating roles.
- **Handyman/House** — domestic tasks and home-maintenance catchall.
- **Health** — physical health, training, medical, recovery.
- **Lauren** — relationship-specific tasks with Lauren.
- **Emma** — relationship-specific tasks with Emma.
- **Family** — family-level tasks (kids, extended family, household
  coordination beyond domestic upkeep).
- **Friends** — friendship maintenance, social commitments.
- **Self** — personal development, reflection, individual practice not covered
  by Health.
- **Build** — the Claude-driven life-system build (this project, this doc, the
  worker/MCP work, etc.). Same priority/labeling conventions as everything
  else.

**Lauren/Emma duplicate handling:** the two relationship projects sometimes
end up with duplicate tasks (an "integration conversation" lands in both).
When the agent spots a likely duplicate, flag it to the user and ask whether
one block can cover both — do NOT delete or merge tasks across these projects
without explicit confirmation.

## Priority tiers

Three tiers, all tasks should be tiered:

- **P1** — high importance. NOT automatically non-negotiable for the week —
  see prioritization rules below.
- **P2** — meaningful, should generally land this week if there's room.
- **P3** — backlog, lower priority.

P4 is unused; don't assign it.

## Labels — the exhaustive set

These are the only labels in active use. If the agent encounters a label not on
this list, surface it for user decision — don't infer meaning.

**State labels** (every active task should carry exactly one):
- `active` — executable, nothing blocking.
- `waiting` — blocked by something (someone else's action, an event, etc.).
- `someday` — long-term, not an active priority. Out of scope for any weekly
  plan until promoted to `active`.
- `needs scoping` — placeholder for larger blocks of work that haven't been
  broken down yet. The right next step is usually to schedule a *scoping
  block* (a planning session for the work, not the work itself). When a
  `needs scoping` task is successfully scoped, it should be retired and
  replaced by the specific tasks that came out of scoping.

**Time-window labels** (optional hints, not required):
- `15 min` / `30 min` / `60 min` / `90 min` / `2 hr+`

Time-window labels are hints for the scheduler — when present, they tell the
agent how long a block to allocate. When the agent generates a task or adds
data, it may suggest a time-window label and confirm before writing. Untagged
items are still schedulable; the agent should ask about expected duration if
it matters for placement.

## Date conventions

Tasks may have either:
- A **specific date** — meaning "should be completed that date."
- A **due date** — meaning "should be completed by that date."

The two are different commitment shapes. A specific-date task is a
commitment to a day; a due-date task is a deadline with flexibility before it.
The agent should respect this distinction when slotting and surfacing items.

Slip tracking (future): when an item's specific date or due date moves
forward across weeks, that's a slip. Repeated slips (2+, escalating at 3+) are
a signal worth surfacing in the prioritization stage. This depends on date
assignment becoming more diligent than it has been — early weeks won't have
much slip data; it accumulates as the convention strengthens.

## Inbox triage

Items in the inbox need a project, a priority tier, and (usually) a state
label before they're meaningful to the system.

The agent triages inbox items in **batched mode**: it reads the inbox, infers
project / tier / state label from task text where it has reasonable signal,
and presents the inferred set for batch confirm. The user responds in batches
(approve / adjust). For items the agent can't reasonably infer, it surfaces
them individually with one targeted question. Do NOT walk every inbox item
one-at-a-time; that's friction without benefit on items the agent can clearly
classify.

## Weekly prioritization (stage 5 of the check-in)

There is no hard non-negotiable rule. The agent surfaces the active backlog by
priority, with relevant flags (specific date this week, due date this week,
slipped, blocked, etc.), and works through it collaboratively with the user
to identify what needs to land this week.

The agent's job in this stage:

1. Pull `active`-state tasks across projects, ranked: tasks with a specific
   date this week first, then tasks with a due date this week, then by
   priority tier (P1 → P2 → P3), with slip-flag prominent.
2. Surface the prioritized view to the user with available time slots from
   stage 3 (flagged open windows) visible.
3. Work through collaboratively — user decides what gets a slot this week,
   what defers, what gets deferred-and-flagged-as-slip.
4. Write agreed do-dates to Todoist as items are committed (sequential write,
   per the protocol's staged-negotiation model).
5. When the backlog exceeds available slots (it usually will), name what's
   being deferred explicitly and surface those items as watch-fors for next
   week's review. Do NOT silently drop items off the consideration list —
   visible deferral is the discipline.

The agent should NOT treat any classification rule as overriding user
judgment. P1 doesn't mean "must land"; specific-date doesn't mean "non-
negotiable." All of these are signals the user weighs against the week's
actual capacity.

## Live-update applicability (future)

When the scheduler develops the ability to update calendar and Todoist live
(Step 3 of the system roadmap), the same conventions apply: same project
structure, same priority tiers, same labels, same date conventions. Live
updates do NOT change the rules; they just shift *when* the updates happen.
This doc is the source of truth for both weekly and live operations.

## Maintenance

Review and prune at the quarterly system review. Stale conventions (labels
that fell out of use, project structure that evolved) are worse than no
convention because the agent applies them anyway. If the inbox-triage rules
get refined through use, update here.
