# Life System Architecture Spec

*Operationalization Layer — Todoist + Calendar + Scheduler*
*Drafted April 26, 2026 · Living document*

## Purpose

This document specifies the technical and operational architecture for extending the Life System dashboard from a passive viewer (Oura + manual check-in) into an active operating layer (task management + calendar + scheduling).

It exists to give future Claude sessions full context without rebuilding it from conversation, to lock design decisions before implementation drift, and to provide a single source of truth for what we are building and why.

Companion to: `life_system_reference.docx` (strategic layer) and `dashboard_state.docx` (current technical state).

## Status & Recent Decisions

Newest entries at top. Log meaningful timing changes, scope shifts, and external blockers here so future sessions can reconstruct the trajectory without rebuilding it from conversation.

### 2026-05-10
- Todoist lifecycle review completed (Sunday check-in Part 2). Project structure locked: 9 top-level projects + 3 Work sub-projects, 10 labels, Todoist native priorities for tier, native Deadline + Due date for hard-date vs. do-date distinction.
- Architectural patterns established: `needs-scoping` state for thematic work with deadline-as-staleness signal; Pattern A (reference doc canonical for phased commitments, Todoist mirrors active phase).
- Triage cadence: Sunday weekly check-in handles both triage and planning. Friday flex block freed for execution only.
- Phase progression review cadence defined: weekly surfacing + quarterly formal audit. Quarterly review is system-triggered via System Cadences section, not manual calendar blocking.
- Decision: condition-based phase transition triggers explicitly rejected. Phase progression evaluation happens via weekly surfacing + quarterly review, based on accumulated observations and deliberate judgment, not predefined criteria.
- Build project populated with Phase 1/2/3 tasks and habit tracking refactor.
- Phase 1 (Todoist integration) build window confirmed for May 16-17.

### 2026-05-08
- Phase 0 complete. Cloudflare infrastructure layer in place: KV namespace `life-system-tokens` provisioned and bound as `env.TOKENS`. D1 database `life-system-db` provisioned and bound as `env.DB`. Existing Oura proxy worker (`plain-hill-28ab`) brought into the repo at `workers/life-system/`, refactored into multi-route structure: existing Oura proxy preserved at root, `/health` endpoint, `/oauth/todoist/callback` and `/oauth/google/callback` stubs. Worker now deployed via wrangler CLI from repo (no more web UI editing). Phase 1 (Todoist) unblocked — pending Todoist lifecycle review session before coding.
- Phase 0 shipped Friday May 8 in ~45min, well under the 4-6 hour estimate. Unblocks Phase 1 and Phase 2 architecturally. Phase 1 committed for May 16-17 weekend with hard deadline 5/17.

### 2026-05-01
- Phase 0 timing updated: scheduled for vacation week (May 7-11), where 4-6 hour focus blocks are realistic. Prior plan was the May 2-3 weekend; vacation work-windows are a better fit given two full-time nannies covering family time.
- ChatGPT context extraction in flight via Cowork (first export request didn't land May 1, re-requested same day).
- Open architectural question: Cowork-on-always-on-server architecture may significantly reduce Phase 1-3 build scope. Cost is not a meaningful constraint; the real question is whether the operational complexity of running personal infrastructure (vs. fully cloud-hosted via Cloudflare) earns its keep. Revisit Sunday May 4 weekly

## The Core Problem

The current dashboard observes the system but does not run it. Tasks live in Todoist (or in head, or scattered). Calendar is fragmented across Outlook (work) and Google (personal). The reference doc lists action items strategically but they have no live status. Daily execution requires holding all of this in working memory.

This is exactly the load that triggers the depletion → executive function collapse → compensatory behavior loop. The fix is not more discipline. The fix is moving the load out of working memory and into a system that surfaces what matters today, when it matters.

## Source of Truth Map

Each system component owns a specific layer. No duplication. No ambiguity about where a thing lives.

| Component | Owns | Update cadence |
|---|---|---|
| Reference doc | Strategy, tiers, weekly skeleton template, goals, regulation protocol | Quarterly review |
| Todoist | Every actionable next step. Tier and domain metadata. | Continuous (capture) + weekly (triage) |
| Calendar | Time. Fixed commitments, skeleton blocks, scheduled tasks. | Continuous (work) + weekly (proposal) |
| Dashboard | Live read of all sources + daily check-in capture + weekly review interface | Daily use |
| D1 database | Check-in history, scheduling proposals, system audit log | Continuous (writes) |

## Architecture Overview

### Host Stack

- GitHub Pages — static dashboard frontend (existing)
- Cloudflare Workers — API routes, OAuth handlers, scheduler engine
- Cloudflare KV — OAuth tokens, refresh tokens, user config
- Cloudflare D1 — relational data: check-ins, proposals, audit log
- Cloudflare Cron Triggers — background scheduler tasks (token refresh, weekly proposal generation)

Rationale: extends existing infrastructure, single account, free tier covers usage, cron solves the dashboard-not-open problem, and KV+D1 provide both fast token reads and structured query support.

### External Services

- Oura API v2 (existing) — sleep, readiness, activity
- Todoist REST API v2 — tasks, projects, labels, filters
- Google Calendar API — read/write personal calendar
- Microsoft Graph API — read work calendars (Outlook). Deferred to Phase 4.

### Data Flow

1. User captures task → Todoist Inbox (untriaged)
2. Friday 3:30-5pm flex block → user opens dashboard Triage view → assigns tier, domain, duration, block-type → task moves to Active project, no due date
3. Sunday 3-3:30pm review block → user clicks Generate Proposal → scheduler reads calendar, identifies open blocks, matches queued tasks to blocks, returns proposal
4. User reviews proposal → edits/removes/swaps → clicks Approve
5. Scheduler writes due dates back to Todoist + creates calendar events for high-tier deep work blocks
6. Throughout the week: dashboard surfaces today's tasks + today's calendar shape. Completing a task in dashboard marks done in Todoist.
7. Following Sunday: review captures what got done vs. what was proposed. Slip patterns feed regulation protocol.

## Todoist Structure

The locked structure for task management. Phase 1 build integrates against this.

### Projects (9 top-level + 3 Work sub-projects)

- **Work** (with sub-projects: Sentinel, Netcov, Tenex)
- **Health**
- **Lauren**
- **Emma**
- **Family**
- **Friends**
- **Self**
- **Build**
- **House**

Inbox is Todoist's built-in untriaged bucket, not a separate project.

### Labels (10 total)

**State (4, exactly one per triaged item):**
- `active` — being worked, gets scheduled
- `waiting` — blocked on someone/something else
- `someday` — deferred, not pulled by scheduler
- `needs-scoping` — committed but requires design/sequencing before becoming actionable

**Estimated time (5, opportunistic):**
- `15min`, `30min`, `60min`, `90min`, `2hr+`

**Focus (1, opportunistic):**
- `focus` — requires uninterrupted block

### Tier

Todoist native priorities: P1 / P2 / P3 (P4 unused, "no tier set"). No tier label needed.

### Dates

Two distinct fields, both Todoist-native:

- **Deadline** — hard external date by which the work must be complete. Set when there's a real outside-imposed date.
- **Due date** — the do-date, the day work is planned to happen. Set during Sunday planning for items committed to that week.

Both can coexist on a task. Neither is required.

### Filters (7)

- **Triage Queue** — items in Inbox
- **Today** — Todoist built-in
- **This Week** — items due in next 7 days
- **T1 Active** — `p1` & `@active`
- **Waiting On** — `@waiting`
- **Someday Review** — `@someday`
- **Stuck** — `no date & @active`

### Lifecycle

- **Capture:** lands in Inbox with no metadata required. Friction-free capture per design principle 3.
- **Triage:** assigned during Sunday weekly check-in/planning session. Process Inbox: assign project, state, tier, deadline if hard, optional time/focus labels.
- **Sunday planning:** in same session as triage, assign do dates (due dates in Todoist) to active items committed to the week ahead.
- **Mid-week:** adjust do dates as reality shifts; capture new items to Inbox for next Sunday's triage.

### Pattern: Thematic work needing design before action

Strategic threads that need scoping/sequencing before they produce executable next actions are captured as "Build plan for X" tasks with `needs-scoping` state. A deadline is assigned to create a staleness signal — when the deadline passes without progress, the lack of action surfaces. Substance and design happen in the appropriate context (work Claude account for professional themes, life design conversations for personal themes); the life system tracks only that the work exists and when it's getting stale.

### Pattern: Phased commitments tracked in reference doc, not Todoist

For items that map to named phases of the strategic plan (Health phases 1-3, therapy pipeline tracks, system architecture phases 0-6, etc.), the reference doc (`life_system_reference.md`) is canonical. Todoist contains only items currently in active execution. Future-phase commitments live in the reference doc until their phase activates, at which point they migrate to Todoist as active items. This prevents Todoist bloat with un-actionable future commitments while keeping the strategic plan fully addressable in markdown.

## Calendar Architecture

### Calendar Roles

| Calendar | Mode | Purpose |
|---|---|---|
| Google (personal) | Read + Write | Skeleton blocks, workouts, relationship time, scheduled tasks |
| Outlook (Tenex) | Read only (Phase 4) | Existing work meetings — treated as fixed commitments |
| Outlook (Sentinel) | Read only (Phase 4) | Existing work meetings — treated as fixed commitments |
| Outlook (Netcov) | Read only (Phase 4) | Existing work meetings — treated as fixed commitments |

### Skeleton Block Types Written by Scheduler

- Workouts — per the workout pattern, with location
- Addie shifts — morning/evening per weekly skeleton
- Relationship nights — Lauren M/T/W/F, Emma Th/Sa, marked appropriately
- Daily 90-min focus block — placed in highest-quality available slot
- Friday flex block 3:30-5pm — admin/triage
- Sunday weekly review 3-3:30pm
- Self time 11-11:30pm — daily reminder

## Scheduler Algorithm

Triggered manually during Sunday review block. Generates a proposal for the upcoming Monday-Sunday week.

### Step A — Read Calendar State

- Pull next 7 days from all connected calendars
- Identify fixed commitments (existing meetings, all-day events)
- Detect travel week — search for travel events Tue/Wed/Thu, flag if found

### Step B — Lay Down Skeleton

- Apply weekly skeleton template (or travel-week variant)
- Resolve conflicts — fixed commitments win, skeleton block shifts to nearest open slot or marked 'unable to place'
- Skeleton placement is proposed, not yet written

### Step C — Identify Open Blocks

After fixed + skeleton placements, classify remaining time:

- `@focus` block — 90+ minutes uninterrupted, mid-morning preferred
- `@admin` block — 30-60 minutes between commitments
- `@micro` block — <30 minutes, suitable for 15min tasks only

### Step D — Match Tasks to Blocks

Pull tasks from active projects (any project except Someday) with `@active` state and no due date set. Sort by deadline urgency first (items with deadlines in the planning window prioritized), then by tier, then by age descending (older first).

For each task, find best-fit block:
1. Block type label (`focus` vs. flex) must match if specified
2. Block duration must accommodate task duration label if set
3. Domain-aware placement — relationship tasks go on relationship nights, etc.
4. Greedy fill: T1 first, then T2. T3 only if blocks remain.

Tasks that don't fit are returned as 'overflow' with reason.

Todoist's native Deadline field is treated as the hard external date. The due date written by the scheduler is the do-date (planned execution day). The scheduler proposes due dates against deadlines; the user approves.

### Step E — Render Proposal

- Visual week grid — gray (fixed), blue (skeleton), green (proposed task assignment)
- Each green block clickable to: swap task, remove, change duration
- Overflow list shown separately with reason for non-placement
- Summary stats — focus block hours, T1 tasks scheduled, T1 tasks overflowed

### Step F — On Approval

- Write Todoist due dates for all proposed task assignments
- Create Google Calendar events for skeleton blocks (configurable per block type)
- Create Google Calendar events for high-tier scheduled deep work (configurable)
- Log full proposal + approval state to D1 audit table

## Phase Progression Review

Phases across domains (Health 1-3, system build 0-6, therapy pipeline, etc.) advance based on explicit review, not implicit drift. Two cadences:

**Weekly check-in surfacing.** During Sunday check-in's forward plan, a brief scan: any phase showing readiness to advance, or obviously stuck? Light-touch — captures observations as watch-fors or quarterly-review inputs, doesn't formally evaluate. Weekly check-in also surfaces approaching 90-day review when within 2 weeks.

**Quarterly 90-day system review.** System-triggered based on date-of-last-review tracking in the System Cadences section below. When the next review is within 2 weeks, weekly check-in surfaces it as a watch-for. When within 1 week, weekly check-in expands surfacing to include "block ~2 hours for the review, identify inputs." Review session produces a new last-review timestamp that resets the counter.

The review itself: formal phase audit. For each active phase across domains:
- Are the conditions for advancement met? If yes, advance.
- Is the phase stuck? If yes, re-scope or accept and re-tier.
- Are new phases needed that weren't in original plan? If yes, add.

Review is based on accumulated observations from weekly check-ins plus deliberate evaluation at the session. No trigger-definition rigor required (see explicit decision in 2026-05-10 Status entry).

### 90-Day Review Protocol

Each quarterly 90-day review session covers:

1. **Domain backward review.** Walk through the questions in `life_system_reference.md` "90-Day Review" section — is sleep floor holding, is depletion cycle shorter, are relationship commitments being honored, is the dashboard being used daily, etc.

2. **Phase progression audit.** Per Phase Progression Review section above, evaluate every active phase across domains (Health 1-3, system architecture 0-6, therapy pipeline tracks). Advance ready phases, re-scope stuck ones, add new phases if needed.

3. **Ideation log surfacing.** Fetch `ideation_log.md`. Surface any entries with "trigger to revisit: 90-day review" or similar trigger language. For each: action, re-park with updated trigger, or delete.

4. **System Cadences update.** Update the System Cadences section below with new last-review date. Next-due automatically becomes ~13 weeks out.

5. **Architecture spec audit.** Quick scan: do design principles still hold? Any new principles needed? Any sections that have gone stale or need revision?

Output: a 90-day review entry in `weekly_log.md` capturing decisions made, phases advanced, and watch-fors carried forward into the next quarter.

## System Cadences

State tracking for system-managed review cadences. The weekly check-in fetches this section to determine which cadences are approaching their next instance.

### 90-Day System Review

- Last review: never (system formalized 2026-04-26)
- Next due: 2026-07-26
- Status: not yet due

### Sunday Weekly Check-in

Recurring weekly, no separate tracking needed.

## Build Phases

> Phase 0 must complete before any feature work. Subsequent phases are independent and can ship sequentially.

### Phase 0 — Infrastructure ✅ Complete (shipped 2026-05-08)

- [x] Set up Claude Code locally connected to life-system repo
- [x] Provision Cloudflare KV namespace (life-system-tokens)
- [x] Provision Cloudflare D1 database (life-system-db)
- [x] Refactor existing worker into multi-route worker structure
- [x] Set up wrangler.toml configuration with bindings
- [x] Create OAuth callback handler stub for Todoist + Google

### Phase 1 — Todoist Read + Write

- Dedicated Todoist lifecycle review (do this before coding)
- Todoist OAuth flow (authorize → store token in KV)
- Worker route: `/api/todoist/tasks?filter=today`
- Worker route: `/api/todoist/tasks?filter=triage`
- Dashboard: Today view — list of due tasks with checkboxes
- Dashboard: Triage view — Inbox items with tier/domain/duration assignment UI
- Worker route: `POST /api/todoist/complete` (mark task done)
- Worker route: `POST /api/todoist/triage` (apply labels, move to Active)
- Validate end-to-end before Phase 2

### Phase 2 — Calendar Read

- Google Calendar OAuth flow
- Worker route: `/api/calendar/week` (returns 7-day event list)
- Dashboard: Today's shape view — calendar timeline + due tasks combined
- Dashboard: Week view — full week visual

### Phase 3 — Scheduler v1

- Skeleton template stored as JSON config in KV
- Open-block detection algorithm
- Task-to-block matching algorithm
- Worker route: `POST /api/scheduler/propose`
- Dashboard: Proposal view with edit affordances
- Worker route: `POST /api/scheduler/approve` (writes Todoist + Calendar)
- Audit log to D1 on every approval

### Phase 4 — Polish

- Microsoft Graph integration for Outlook calendars
- Travel week auto-detection
- Token auto-refresh via cron trigger
- Migrate localStorage check-in data to D1

### Phase 5 — Deferred

- Mobile PWA optimization
- Push notifications
- Claude training interface for fitness module

### Phase 6 — ChatGPT Corpus Integration

Two artifacts: curated reference docs (synthesized current-state thinking by domain — relationship, training, health, professional, decision history) and searchable archive (full corpus indexed via Cloudflare Vectorize, exposed as MCP tool for on-demand retrieval).

**Sequencing:** Reference docs first, archive second. Reference docs are an analytical-synthesis project (~2-4 hours per domain, one domain per session). Archive is an infrastructure project (vector DB, embedding pipeline, retrieval endpoint, ~6-10 hours).

**Trigger to start:** Either (a) a real, repeated moment where searchable history would have unblocked something — wait for the lack to be felt, or (b) Phase 4 completes and the substrate can hold the integration cleanly.

**Privacy gate:** Relationship and personal-history reference docs likely contain content unsuitable for the public `life-system` repo. Decide on private repo, local-only, or Claude.ai project file storage before producing content that needs a non-public home.

**What unlocks:** Years of accumulated personal context becomes addressable by current agents. Trainer can reference historical training, relationship work can reference evolved positions, decision-making can reference prior reasoning. Expanded persistent memory across the system.

## Design Principles

These are the constraints that prevent the system from becoming another source of overload. They take precedence over feature requests.

### 1. The system serves regulation, not optimization

Every feature must answer: does this reduce cognitive load, or add to it? Optimization features that increase cognitive load are rejected even when they would 'work.'

### 2. Proposal over automation

The scheduler proposes, never decides. The user retains full agency at the weekly review checkpoint. Automatic scheduling without explicit approval is forbidden — it would replace one external authority (calendar tyranny) with another.

### 3. Capture must be frictionless

Adding a task to Todoist Inbox must work from anywhere with no tier/domain/duration required. Triage happens during the flex block, not at capture time. Forcing metadata at capture creates resistance and tasks end up nowhere.

### 4. The dashboard is the daily surface, not the system

Todoist and Calendar are usable on their own. The dashboard adds synthesis but never becomes a single point of failure. If the dashboard breaks, the underlying systems still function.

### 5. Every write is reversible or auditable

Approving a scheduling proposal writes potentially dozens of due dates and calendar events. Every write logs to D1 with a proposal ID, so 'undo last proposal' is always possible. No silent state changes.

### 6. Build for bad weeks, not good ones

The system must be usable at Level 2 dysregulation. Default views must show the minimum (today's tasks, today's calendar, check-in capture). Advanced features (proposals, trends, weekly review) are opt-in surfaces, not required surfaces.

## Open Questions

Items deferred to specific phase decisions or pending more information.

- **Existing Todoist setup** — does user have projects/labels already that we should adapt to vs. propose fresh structure? *Dedicated review session planned before Phase 1.*
- **Outlook integration complexity** — Microsoft Graph requires Azure app registration. Confirm worth it for Phase 4 or treat work calendar as 'busy' via manual blocks.
- **Phone capture path** — Todoist mobile is the obvious answer, but worth confirming this is friction-free vs. needing a custom shortcut.
- **Travel week auto-detection** — what signals reliably indicate travel? Calendar event title patterns? Location change?
- **Sentinel/Netcov calendar access** — does Tenex IT permit personal app OAuth against work mailbox?

---

*Last updated: April 26, 2026. Update at each phase boundary or material design change.*
