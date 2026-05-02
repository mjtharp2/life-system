# Life System Architecture Spec

*Operationalization Layer — Todoist + Calendar + Scheduler*
*Drafted April 26, 2026 · Living document*

## Purpose

This document specifies the technical and operational architecture for extending the Life System dashboard from a passive viewer (Oura + manual check-in) into an active operating layer (task management + calendar + scheduling).

It exists to give future Claude sessions full context without rebuilding it from conversation, to lock design decisions before implementation drift, and to provide a single source of truth for what we are building and why.

Companion to: `life_system_reference.docx` (strategic layer) and `dashboard_state.docx` (current technical state).

## Status & Recent Decisions

Newest entries at top. Log meaningful timing changes, scope shifts, and external blockers here so future sessions can reconstruct the trajectory without rebuilding it from conversation.

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

> **Note:** This structure is a working draft. A dedicated review session is planned before Phase 1 begins to finalize lifecycle rules, recurring task handling, overflow policy, and integration with any existing Todoist setup. Do not treat as final.

### Projects

| Project | Purpose | State |
|---|---|---|
| Inbox | Capture lands here. Untriaged, no metadata. Processed during flex block. | Untriaged |
| Active | Triaged tasks. Either scheduled (due date set) or queued (no due date, awaiting next proposal). | Triaged |
| Waiting On | Blocked on someone else. Mirrors reference doc Waiting On section. | Blocked |
| Someday | Tier 3 / intentional neglect / parking lot. Not pulled by scheduler. | Deferred |
| Reference | Non-actionable but worth keeping (links, info, notes). | Reference |

### Labels

Labels carry the metadata the scheduler needs to match tasks to blocks.

- **Tier** — `@t1` / `@t2` / `@t3`
- **Domain** — `@health` / `@pro` / `@lauren` / `@emma` / `@parenting` / `@self` / `@social` / `@finance`
- **Duration** — `@15min` / `@30min` / `@60min` / `@90min` / `@deep` (90+)
- **Block type** — `@focus` (deep work block) / `@admin` (flex block) / `@anywhere`

### Filters

The dashboard surfaces tasks via these filter views, not raw projects.

- **Today** — due today, sorted by tier ascending
- **This Week** — due in next 7 days
- **Triage Queue** — Inbox project items missing tier label
- **Queued by Tier** — Active project, no due date, grouped by tier
- **Waiting On** — Waiting On project
- **Stuck** — Active, no due date, no activity in 30+ days (parking lot warning)

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

Pull all tasks from Active project with no due date. Sort by tier ascending (T1 first), then by age descending (older tasks first).

For each task, find best-fit block:

1. Block type label must match (focus task → focus block, etc.)
2. Block duration must accommodate task duration
3. Domain-aware placement — relationship tasks go on relationship nights, etc.
4. Greedy fill: T1 first, then T2. T3 only if blocks remain.

Tasks that don't fit are returned as 'overflow' with reason (no matching block, schedule too full, etc.).

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

## Build Phases

> Phase 0 must complete before any feature work. Subsequent phases are independent and can ship sequentially.

### Phase 0 — Infrastructure

- [x] Set up Claude Code locally connected to life-system repo
- [ ] Provision Cloudflare KV namespace (life-system-tokens)
- [ ] Provision Cloudflare D1 database (life-system-db)
- [ ] Refactor existing worker into multi-route worker structure
- [ ] Set up wrangler.toml configuration with bindings
- [ ] Create OAuth callback handler stub for Todoist + Google

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
