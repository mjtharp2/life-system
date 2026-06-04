# Life System Architecture

*Substrate-centric operating system for personal life management.*
*Living document — last fully refreshed 2026-06-03.*

## Purpose

This document is the architectural source of truth for the Life System: what
it's for, how it's structured, what's been decided, what's underway, and what
the system is converging toward. Future Claude sessions read this to get full
context without rebuilding it from conversation.

Companion docs:
- `life_system_reference.md` — strategy, tiers, skeleton, regulation protocol
- `dashboard_state.md` — technical state: data sources, connectors, write rules
- `weekly_log/INDEX.md` — weekly check-in library
- `weekly_checkin_protocol.md` — the ritual-runner for weekly check-ins
- `todoist_taxonomy.md` — Todoist conventions: projects, labels, priorities
- `ideation_log.md` — parked ideation, reviewed at quarterly checkpoints

## What the system is

A personal operating system whose primary job is **regulation, not
optimization**. It exists to interrupt the depletion → executive function
collapse → compensatory behavior loop by moving cognitive load out of working
memory and into substrate that surfaces what matters when it matters.

The architecture has two layers:

**Substrate (the durable layer).** Reference docs in this repo, structured
data in a Cloudflare D1 database, accessed through a custom MCP server.
External systems (Todoist, Google Calendar, M365, Apple Health, Spotify,
Gmail, trainer log) federate in read-time rather than being mirrored —
substrate holds only what has no other home (check-ins, regulation events,
scheduler proposals, training history, agent-write audit lineage).

**Conversations (the operational layer).** Fresh-thread Claude conversations
read substrate at session start, run the work, write durable outputs back to
substrate, and die. No important context lives in any single thread; threads
are runtime, not memory. Compression and thread death are non-events because
intelligence lives in the substrate.

The end state this architecture converges toward is a small set of
domain-specific agents (each carrying a persona via a Skill, mounted over
shared substrate) coordinating through that substrate, with the user
interacting through a unified surface. See End State below.

## Status & Recent Decisions

Newest entries at top. Log meaningful timing changes, scope shifts, and
external blockers here so future sessions can reconstruct the trajectory
without rebuilding it from conversation.

### 2026-06-03 — Architecture doc wholesale refresh

This doc rewritten to reflect the substrate-centric model that emerged after
the 2026-05-11 architectural reorientation. The April-26 dashboard-centric
framing (worker as integration layer, dashboard as operational surface,
deterministic scheduler writing to Todoist/Calendar from the dashboard) has
been replaced with the current substrate-centric model (substrate is the
integration and memory layer, conversations are the operational layer,
agents read/write substrate via MCP). The original dashboard-and-deterministic-
scheduler content was archived in the decision log up through this entry; the
forward-looking sections (Build Phases, Scheduler Algorithm, Open Questions)
have been retired in favor of Current Build Status, End State, and Roadmap
Items.

Substantive decisions captured in this refresh that hadn't yet landed in the
doc:

- **Weekly check-in is a staged-negotiation ritual.** Step 4 of
  `weekly_checkin_protocol.md` walks 5 stages in order: parenting (batched,
  user-supplied), workouts (against default pattern in `trainer/program.md`),
  flag open windows, work-calendar triage, prioritize Todoist. Each stage
  writes to its target surface (Tharp Family / personal Google / Todoist)
  before the next stage begins; substrate row is composed at the end via
  `weekly_write_checkin`.
- **Calendar interpretation rules accumulate in each weekly log entry.** No
  separate doc — rules live at the end of each weekly entry under a "Calendar
  interpretation rules" section, carried forward and updated weekly per Step 7
  of the protocol. One non-holding → proposed deletion; user-flagged durable
  rules → proposed addition; user reviews and approves in Step 7. This
  substitutes substrate-recorded episodic memory for the in-thread context
  fresh threads would otherwise lack.
- **Todoist taxonomy formalized in `todoist_taxonomy.md`.** Stage 5 of the
  check-in surfaces active backlog ranked by date / priority / slip, works
  through it collaboratively; no hard non-negotiable rule.
- **Trainer-bridge contract.** `weekly_checkins.weekly_training_slots` holds
  the week's scheduler-agreed workout slots (day, time, category,
  constraint_note). Scheduler writes via `weekly_write_checkin`; trainer reads
  via `weekly_query_checkin slots_only` at session start. Scheduler owns
  *when/what category*; trainer owns *what specifically*. Default workout
  pattern (3 gym + Sat tennis + 1 home VO2 + Sunday stretching + 1 flex,
  often yoga) lives in `trainer/program.md`.
- **MCP edit functionality.** `training_update_session` and
  `weekly_update_checkin` deployed alongside the write tools — full-replace
  semantics, UUID preserved, atomic D1 batch. Lets agents amend prior writes
  cleanly.
- **Manual-only gate removed from check-in writes.** Personal Google + Todoist
  write directly; Tharp Family confirm-before-each-mutation (real reason:
  shared calendar, nannies coordinate against it). Sentinel / Tenex / M365
  never written.

### 2026-05-25 — Weekly ritual migrated to library + protocol model

`weekly_log.md` (single append-only file) split into `weekly_log/` — per-week
files (`YYYY-MM-DD.md`, named by the Monday of the week being planned) with
frontmatter (queryable signals) + verbatim narrative, plus `INDEX.md`
(conventions, current pointer, recent-weeks trajectory, active watch-fors).
Original archived to `archive/weekly_log_pre-library.md`.

The check-in process, previously described inline in project instructions, is
now `weekly_checkin_protocol.md` (Tier 2) — a fresh thread reads it and runs the
ritual: backward review off prior watch-fors, scheduler-assisted forward plan
(reads Sentinel via M365 connector, Tenex + personal + Tharp Family via Google
connector, Todoist, trainer MCP; preprocessing per dashboard_state.md Data
Sources), phase/90-day scan, triage, writes the new entry.

Rationale: continuity moves to substrate (queryable library) rather than thread
scrollback; fresh-thread-per-week reading the library never degrades, unlike a
rolling thread. Scheduler-propose logic lives in the protocol; first runs may
keep write-back manual until propose quality + write path are trusted.

### 2026-05-24 — Calendar federation wired and verified

Scheduler input sources are live and verified end-to-end:

- **Sentinel** work calendar via the Microsoft 365 connector (read-only, full
  detail, UTC-stamped).
- **Tenex** work calendar via published ICS subscribed into personal Google
  Calendar, read through the Google connector (read-only). Routed this way
  because the M365 connector binds one tenant at a time and Sentinel holds that
  slot; Tenex-through-Google avoids a second tenant connection and keeps firm
  data out of a direct connector grant.
- **Google** personal calendar via native connector — scheduling reads limited
  to an explicit allowlist (personal primary, Tharp Family, Tenex feed); sports
  feeds, Home Maintenance, Emma's, and the legacy Family calendar excluded.
- **Todoist** (read/write) and **trainer log** (D1 via custom MCP) previously
  verified/built.

Federation is read-time, not mirrored — consistent with the substrate model.
Write targets are Google personal primary and Todoist (default) and Tharp Family
(full read/write for parenting logistics, gated by confirm-before-mutation
because it's a shared calendar nannies coordinate against). Work calendars are
never written. Access methods, the Google allowlist, the Tenex match-by-import
rule, and the preprocessing/write rules are documented in dashboard_state.md →
Data Sources & Access.

This completes the input/output layer for the assistant agent (weekly-planning
rhythm + live/dynamic rhythm). Sources are individually verified as readable;
first live use in a real weekly check-in is the next step. The competent agent
build is spec'd from what that surfaces in practice.

### 2026-05-24 — Phase 2 (MCP server) complete

- Phase 2 (MCP server) complete. The life-system worker now hosts an OAuth 2.1 MCP server exposing the substrate to Claude.ai conversations. This is now the PRIMARY conversation-side interface to all substrate data — every Claude conversation (trainer, future scheduler/review agents) reads and writes through this one connector. The Phase 1 HTTP routes remain as the secondary path for scheduled agents, Claude Code, and curl. Two tools live: training_write_session and training_query_log, both calling the same db.js functions as the HTTP routes. Tool registry is structured so future domains (regulation events, check-ins, scheduler proposals, etc.) add a file + registry entries with no dispatch refactor. Connector installed account-wide; read path verified end-to-end against live D1. Write path not yet verified — pending one supervised write test before trainer instructions flip to auto-write.

### 2026-05-18 — Phase 1 (HTTP substrate) complete

- Phase 1 (HTTP substrate) complete. Training-log domain tables added to life-system-db (5 tables, 10 indexes, prefixed `training_`). HTTP routes at `/api/training-log/sessions` with bearer-token auth (env.TRAINING_LOG_TOKEN). Worker refactored into modules (src/lib/, src/routes/) so shared DB and auth logic can be reused by Phase 2 MCP server tools. Backfill script ingested 18 historical trainer sessions covering 2026-04-27 through 2026-05-18. Phase 2 (MCP server for conversation writes) unblocked, deferred to a separate session.

### 2026-05-11 — Architectural reorientation (resolved)

Native Claude connectors (Todoist, Google Calendar, Apple Health/iPhone, Spotify, Gmail, Drive) now cover most integration scope the dashboard was planned to build. This raises a real architecture question: does Phase 1-3 reorient around the agent layer, with the dashboard becoming a glance surface only, and native connectors as the primary integration layer?

Three architectures emerge:

- **A — Dashboard-centric (current spec):** worker is integration layer, dashboard is operations surface. Build cost high, native connectors duplicated.
- **B — Agent-centric:** Claude conversations are primary surface, native connectors handle integration. Massively reduced build, but loses always-available glance.
- **C — Hybrid:** dashboard for glance/regulation-dip use, conversations for operational/multi-step work, worker + D1 for state and scheduled jobs. Likely correct answer.

**Decision needed before Phase 1 build window (May 16-17).** Dedicated reorientation conversation required — this is a strategic architecture decision, not a triage call. Hold Phase 1 build until decided.

**RESOLVED:** Architecture C (hybrid) was adopted, then evolved into the
substrate-centric model now described in this doc. The dashboard is deferred
(see Roadmap Items below). The agent layer became primary via Claude
conversations + custom MCP. Native connectors handle integration. This entry
preserved as the marker of the inflection point.

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

## Current Build Status

The work in flight, by named step. No numbering — sequence shifts as steps
close; names are stable.

### Weekly scheduler functional

Substantially closed. The check-in runs as a staged-negotiation conversation
reading all federated sources, proposing the week, writing to calendar /
Todoist / substrate per the protocol's stages. Remaining: ongoing accumulation
of calendar-interpretation rules through real runs (each week's Step 7
review). The first run on the rewritten protocol with all this window's work
live is the next live validation.

### Weekly log queryable library

Closed. `weekly_log/` per-week files with frontmatter + verbatim narrative,
`INDEX.md` as read-first entry point, archive at
`archive/weekly_log_pre-library.md`. Fresh-thread bootstrap proven.

### Realtime / dynamic editing

Not started. The live-assistant rhythm (reactive mid-week changes), writing
only to Google personal + Todoist (work calendars read-only; Tharp Family
confirm-gated). Same write path as the weekly scheduler, extended to
reactive use. Comes after the weekly scheduler write path is proven in real
weekly runs.

### 90-day arc tracking + check-in/regulation D1 write path

Not started; partially seeded. The protocol already runs the 90-day proximity
check. Arc-tracking requires check-in and regulation data accumulating in
queryable form — folds into the `weekly_checkins` table from this window's
build, extended with regulation_events as its own queryable surface. Wires
substrate into the phase-progression machinery already specified but
currently running on memory.

### Roadmap exercise

Not started. The sequencing pass that takes the roadmap items below and
orders them against accumulated cleanup debt. This is the work that opens
when the operational steps above stabilize. Cleanup half of this step is
underway via the current doc refresh.

## End State

The architecture this system is converging toward, decided in principle,
unbuilt in most places.

### Domain agents as Skills + substrate

Each domain agent (health, finance, relationship/reflection, possibly taste,
possibly trading) is built as **a Skill (stable persona + procedure +
durable domain knowledge) mounted over substrate (evolving memory + live data
+ history)**. The Skill carries the agent's character and is portable — it
activates wherever invoked, decoupling the agent from any single
Project/thread. Substrate carries the accumulating context the agent reads
fresh each session.

Guardrail: only durable knowledge belongs in a Skill. The test is "true in
three months regardless of what happens between now and then?" Current state
goes in substrate; baking it into the Skill produces stale agents. Skills are
maintained deliberately; same deletion-audit discipline as everything else.

### The agent set

Current trainer is the first instance. The set the system is built to grow
into:

- **Health / nutrition / wellness** — evolved trainer. Owns body, sleep,
  food, recovery, regulation signals.
- **Personal finance** — clean fit. Budgeting, cash flow, spending awareness.
- **Trading (analyze-only, separate from personal finance)** — only if
  compliance allows. Real governance question to resolve before building;
  zero execution authority regardless.
- **Relationship / reflection** — explicitly not-a-therapist, coupled to real
  therapy. Owns emotional/psychological domain, relationship intentionality.
  Highest care because of sensitivity and the failure mode of an AI drifting
  into a role it can't safely hold.
- **Taste / curatorial** — only if persistent curation proves valuable over
  transactional connector-use.

Work is deliberately walled off in the Tenex enterprise Claude — not on this
list. The only bridge into this system is read-only work calendar
availability.

### Agent coordination via substrate, not chat

Agents do not message each other. They coordinate by reading and writing the
same substrate, asynchronously. The health agent doesn't *tell* the scheduler
training load is high; it writes that state, and the scheduler reads it next
time it runs. This is far more robust than direct agent-to-agent messaging
and is the model the current architecture already supports.

### Unified surface (Slack-style)

Eventually, a single front-end (likely Slack-style) where the user talks to
the system and an orchestrator routes to the appropriate Skill against
shared substrate. Not near-term — earns its keep only when multiple agents
are producing enough signal that a unified surface beats opening individual
Project conversations. Far end of the roadmap.

### Principles

The architecture honors a small set of principles that take precedence over
feature requests:

1. **The system serves regulation, not optimization.** Every feature
   answers: does this reduce cognitive load or add to it? Optimization
   features that increase load are rejected even when they would "work."

2. **Proposal over automation.** The scheduler proposes, the user decides.
   The user retains full agency at the weekly review checkpoint.

3. **Capture must be frictionless.** Adding to Todoist Inbox works from
   anywhere with no required metadata. Triage happens later.

4. **Substrate is the durable layer; threads are runtime.** Important state
   never lives only in a thread. Thread compression and thread death are
   non-events because durable context lives in the repo and D1.

5. **Federate, don't mirror.** External systems remain their own source of
   truth. Substrate holds only what has no other home.

6. **Every write is reversible or auditable.** Agent writes log to D1 with
   audit lineage. No silent state changes.

7. **Build for bad weeks.** The system must be usable at Level 2
   dysregulation. Default surfaces show the minimum; advanced features are
   opt-in.

8. **Honesty over agreement.** Agents push back when plans are off; user
   judgment is final.

## Phase Progression Review

Phases across domains (Health 1-3, system build 0-6, therapy pipeline, etc.) advance based on explicit review, not implicit drift. Two cadences:

**Weekly check-in surfacing.** During Sunday check-in's forward plan, a brief scan: any phase showing readiness to advance, or obviously stuck? Light-touch — captures observations as watch-fors or quarterly-review inputs, doesn't formally evaluate. Weekly check-in also surfaces approaching 90-day review when within 2 weeks.

**Quarterly 90-day system review.** System-triggered based on date-of-last-review tracking in the System Cadences section below. When the next review is within 2 weeks, weekly check-in surfaces it as a watch-for. When within 1 week, weekly check-in expands surfacing to include "block ~2 hours for the review, identify inputs." Review session produces a new last-review timestamp that resets the counter.

The review itself: formal phase audit. For each active phase across domains:
- Are the conditions for advancement met? If yes, advance.
- Is the phase stuck? If yes, re-scope or accept and re-tier.
- Are new phases needed that weren't in original plan? If yes, add.

Review is based on accumulated observations from weekly check-ins plus deliberate evaluation at the session. No trigger-definition rigor required (see explicit decision in 2026-05-10 Status entry).

## 90-Day Review Protocol

Each quarterly 90-day review session covers:

1. **Domain backward review.** Walk through the questions in `life_system_reference.md` "90-Day Review" section — is sleep floor holding, is depletion cycle shorter, are relationship commitments being honored, is the dashboard being used daily, etc.

2. **Phase progression audit.** Per Phase Progression Review section above, evaluate every active phase across domains (Health 1-3, system architecture 0-6, therapy pipeline tracks). Advance ready phases, re-scope stuck ones, add new phases if needed.

3. **Ideation log surfacing.** Fetch `ideation_log.md`. Surface any entries with "trigger to revisit: 90-day review" or similar trigger language. For each: action, re-park with updated trigger, or delete.

4. **System Cadences update.** Update the System Cadences section below with new last-review date. Next-due automatically becomes ~13 weeks out.

5. **Architecture spec audit.** Quick scan: do design principles still hold? Any new principles needed? Any sections that have gone stale or need revision?

Output: a 90-day review entry in the `weekly_log/` library (the entry file for the current planning week) capturing decisions made, phases advanced, and watch-fors carried forward into the next quarter. See `weekly_log/INDEX.md` for the per-entry conventions.

## System Cadences

State tracking for system-managed review cadences. The weekly check-in
fetches this section to determine which cadences are approaching their next
instance.

### 90-Day System Review

- Last review: never (system formalized 2026-04-26)
- Next due: 2026-07-26
- Status: not yet due

### Sunday Weekly Check-in

Recurring weekly, no separate tracking needed.

## Source of Truth Map

| Domain | Source of truth | Access path | Notes |
|---|---|---|---|
| Strategy / principles / cadences | This repo (markdown) | curl / web_fetch | Tier 1: `life_system_reference.md`, `system_architecture.md`. Tier 2 loaded on task. |
| Weekly history | `weekly_log/` library | curl / web_fetch | Per-week files; INDEX.md is read-first. |
| Calendar (personal + family) | Google Calendar | Native Claude connector | Allowlist in `dashboard_state.md`. |
| Calendar (Sentinel) | Sentinel M365 tenant | Microsoft 365 connector | Read-only. |
| Calendar (Tenex) | Tenex M365 tenant | Published ICS → Google connector | Read-only via Google to avoid second M365 tenant. |
| Tasks | Todoist | Native connector | Conventions in `todoist_taxonomy.md`. |
| Training log | D1 `training_*` tables | Custom MCP (`training_query_log`, `training_write_session`, `training_update_session`) + HTTP routes | Substrate's own data. |
| Weekly check-ins | D1 `weekly_checkins` + `weekly_training_slots` | Custom MCP (`weekly_query_checkin`, `weekly_write_checkin`, `weekly_update_checkin`) + HTTP routes | Structured signals + trainer-bridge slots. |
| Health (sleep / readiness / weight) | Oura, Apple Health, eventually Withings | Apple Health connector (mobile-only) currently; worker health-proxy planned | See Roadmap Items. |

Preprocessing rules (calendar federation, timezone normalization, cancelled-
event filtering, write boundaries) are documented in `dashboard_state.md` →
Data Sources & Access. Todoist conventions are in `todoist_taxonomy.md`.

## Roadmap Items

Identified work that hasn't been sequenced yet. The Roadmap Exercise (above
in Current Build Status) is where these get ordered and timed against
accumulated cleanup debt. Listed alphabetically within each grouping; ordering
is the exercise's job.

### Near-term roadmap items

- **Cross-context health substrate.** Worker health-proxy layer pulling Oura
  directly (bypasses Apple connector's mobile-only + Oura-aggregation
  problems) and onboarding Withings as second source. MCP tools on top. Lets
  scheduler/check-in reach health data on PC, makes Withings usable cleanly.
- **Reference dashboards (deferred from original architecture, repurposed).**
  Glance surfaces over D1 substrate — health, finance, training, weekly
  adherence tracking. The D1 architecture explicitly enables this; the
  original dashboard plan is retired but the *concept* of fulsome reference
  dashboards lives on as a roadmap item. Not high priority; sits in the
  roadmap for the exercise to sequence.

### Mid-term roadmap items

- **First Skill: package the check-in protocol as a Skill.** Auto-activating,
  cache-immune, single coherent home for procedural knowledge. Build from a
  proven procedure (multiple clean runs of the current markdown protocol),
  not a guessed one.
- **Trainer as Skill (persona).** Carry the trainer's stable persona +
  procedure + durable knowledge into a Skill; substrate continues to hold
  the evolving training log and program. First instance of a *persona* Skill
  (the check-in Skill is procedural).
- **ChatGPT corpus integration.** Years of accumulated personal context made
  addressable by agents. Two artifacts: curated reference docs (synthesized
  current-state thinking per domain) and searchable archive (full corpus
  indexed via Cloudflare Vectorize, exposed as MCP tool). Reference docs
  first (analytical-synthesis project, ~2-4 hours per domain), archive
  second (~6-10 hours). Privacy gate: relationship and personal-history
  reference docs likely need a non-public home — decide on private repo,
  local-only, or Claude.ai project storage before producing content.

### Longer-term roadmap items

- **Path A: worker writes markdown to repo via GitHub API.** Lets agents
  produce markdown files directly without the Claude Code patch step.
  Defers until multi-agent write demand makes the governance trade worth it
  (currently only the check-in agent writes weekly markdown, and the patch
  step is one paste per week). Real risk: a token in the worker with repo
  write access. Real benefit: removes the manual commit step from the agent
  loop.
- **Unified front-end surface.** Slack-style (or equivalent) where user
  talks to the system and orchestrator routes to the right Skill. Earns its
  keep when multiple agents are producing enough signal to justify a shared
  surface.

### Cleanup debt (sequenced as part of the roadmap exercise)

- **Ideation log prune.** Items in `ideation_log.md` reviewed for promotion
  to roadmap, deferral, or deletion. Promoted items merge into the roadmap-
  items above; pruned items leave the log clean.
- **Stale-reference / credential hygiene.** Periodic sweep for old tokens,
  obsolete cross-references, drift between markdowns and reality.

## Maintenance

This doc is the source of architectural truth. When this thread or any
future thread decides something architectural, the decision lands here as a
Status & Recent Decisions entry. When something accumulates that would
change current state or end state, those sections get updated directly.

The 90-day review includes an architecture spec audit (step 5 of the 90-Day
Review Protocol) — that's the formal moment the whole doc gets checked for
staleness, not just the dated entries.

---

*Last fully refreshed 2026-06-03. Update Status & Recent Decisions on every
material architectural decision; update Current Build Status, End State, and
Roadmap Items as those evolve; full-doc audit at each 90-day review.*
