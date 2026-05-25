# Life System Dashboard — Technical State

*Last updated: May 24, 2026 · Companion to `system_architecture.md`*

## Infrastructure

### URLs & Services

| Service | Details |
|---|---|
| Dashboard URL | https://mjtharp2.github.io/life-system |
| GitHub Repo | github.com/mjtharp2/life-system (public) |
| Cloudflare Worker | https://plain-hill-28ab.mjtharp2.workers.dev |
| Oura OAuth App | Client ID: `5ab2f062-8edd-4887-90d3-b92178fce175` |
| Worker Purpose | Multi-route worker — Oura CORS proxy + training-log API + MCP server (substrate access for Claude conversations) + health + OAuth callback stubs (see Cloudflare Worker section) |

### Oura Token Management

Tokens expire every 30 days. When expired, regenerate using this flow:

1. Go to Oura developer portal and ensure redirect URI is set to: `http://localhost`
2. Open this URL in browser (replace CLIENT_ID if it changes):

   `https://cloud.ouraring.com/oauth/authorize?response_type=token&client_id=5ab2f062-8edd-4887-90d3-b92178fce175&redirect_uri=http%3A%2F%2Flocalhost&scope=daily+heartrate+personal+session+sleep+workout`

3. Log in and authorize — browser redirects to localhost (will show error, that's fine)
4. Copy the full URL from the address bar
5. Extract the `access_token` value from the URL — it starts with `_0XBPWQQ_`
6. Paste new token into dashboard via the Connect Oura button

**Current token (expires ~May 26, 2026):**

```
_0XBPWQQ_333c71e3-0fdc-49c6-991f-154ee319f1af
```

> TODO: Build automatic token refresh flow so this doesn't require manual steps. OAuth callback infrastructure now exists (Phase 0 complete — multi-route worker with `/oauth/*/callback` stubs and KV token store). Full auto-refresh implementation is Phase 4 in the architecture spec.

### Cloudflare Worker

The worker now lives in the repo at `workers/life-system/` (Phase 0 moved it out of Cloudflare web-UI editing). It is multi-route:

- `/` — Oura API CORS proxy, preserved unchanged. The dashboard depends on the exact `?path&token` query pattern; do not change it.
- `/health` — liveness check; reports KV/D1 binding status.
- `/api/training-log/sessions` — training-log read/write, bearer-token auth. `POST` inserts a session and children via a D1 `batch()` with idempotency on `(date, type)`; `GET` returns sessions with joined lifts, sets, cardio, and flags.
- `/oauth/todoist/callback`, `/oauth/google/callback` — OAuth callback stubs for Phase 1 (Todoist) and Phase 2 (Google); log-and-placeholder until those phases ship.
- `/mcp` — MCP streamable HTTP endpoint (stateless JSON, protocol 2025-06-18). OAuth 2.1 bearer auth from KV with audience binding to the canonical URI. Hand-rolled JSON-RPC dispatch (the official TS SDK assumes Node req/res streams).
- `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server` — RFC 9728 + RFC 8414 discovery; lets MCP clients auto-configure from a single `/mcp` URL.
- `/oauth/mcp/authorize`, `/oauth/mcp/token` — OAuth 2.1 endpoints. Pre-shared client credentials (no DCR), PKCE S256 required, RFC 8707 resource indicator bound to `/mcp`. `/authorize` GET renders a minimal Approve consent page; POST issues a single-use authorization code. `/token` handles `authorization_code` and `refresh_token` grants.

**MCP tools (v1):** `training_write_session`, `training_query_log`. Both call the same `db.js` functions as the HTTP routes (`validateSessionPayload`, `findExistingSession`, `insertTrainingSession`, `queryTrainingSessions`) — one substrate, two access paths, zero duplicated logic. The tool registry in `src/lib/mcp-tools.js` is structured so future domains (regulation, check-ins, scheduler proposals) add a file + registry entries; no dispatch refactor.

**Substrate access architecture:** The MCP connector is installed account-wide in Claude.ai and is the **primary** read/write path for substrate data from any Claude conversation (trainer, future scheduler/review agents). The Phase 1 `/api/training-log/*` HTTP routes are the **secondary** path, retained for scheduled agents, Claude Code, and curl. Training is the first domain exposed; future domains add tools to the same connector.

Source is refactored into modules — `src/index.js` (route dispatch), `src/routes/`, `src/lib/` (shared DB + auth helpers + MCP tool registry + OAuth artifact store).

**Bindings:**
- `env.TOKENS` — KV namespace `life-system-tokens` (OAuth tokens, refresh tokens, MCP access/refresh tokens, user config)
- `env.DB` — D1 database `life-system-db` (check-ins, scheduling proposals, training log)

**Secrets:**
- `env.TRAINING_LOG_TOKEN` — bearer token gating the `/api/training-log/*` routes
- `env.MCP_CLIENT_ID`, `env.MCP_CLIENT_SECRET` — pre-shared OAuth client credentials for the MCP server; pasted into the Claude.ai custom connector's Advanced Settings

**Training schema:** `workers/life-system/schema.sql` — five tables prefixed `training_` (sessions, lift_entries, sets, cardio_entries, flags) with 10 indexes. Mirrors the trainer YAML structure for a lossless round-trip.

**Deploys:** `cd workers/life-system && npx wrangler deploy` — no more web-UI editing. Refactors and feature additions happen in the repo under version control.

## What's Built

### Working Features

- Oura data pulling correctly via Cloudflare proxy — sleep score and readiness
- 4 metric boxes: sleep score (last night), sleep 7-day avg, readiness (today), readiness 7-day avg
- All 4 metrics warn red when below 70
- Regulation check-in — Level 1/2/3 with protocol reminder for each level
- Habit tracking — persists in localStorage across sessions
- Daily note — saves to localStorage
- Trends page — 7-day charts for sleep score, resting HR, Tier A compliance
- 7-day regulation history visual
- Week at a glance summary stats
- Weekly review tab — structured prompts across 4 sections, auto-saves
- Alert system — fires when sleep avg below 70, dysregulation flagged, stimulant miss

### Oura Data Architecture

Three API endpoints called on load:

- `daily_sleep` — provides sleep score per day (reliable, same-day availability)
- `sleep` (sessions) — provides `total_sleep_duration` and `lowest_heart_rate` (lags ~24hrs)
- `daily_readiness` — provides readiness score per day

Known behavior: session data (total sleep, resting HR) lags one day behind sleep score. Today's metrics show sleep score from today, session data from previous night. This is an Oura API behavior, not a bug.

## What's Broken / Incomplete

### Habit Tracking — Needs Redesign

Current habit structure is wrong. Needs to be rebuilt as:

**Non-negotiable (Tier A):**

- No unplanned stimulants
- Addie anchor

**Daily intentions (Tier B):**

- 90-min focus block
- Self time (11-11:30pm)
- Emma commitment honored
- Lauren intentional time

**Fitness (separate section, to be expanded):**

- Workout / movement logged — placeholder only, full fitness tracking to be built

Current code has structural issues with the three-category habit rendering. Needs clean rebuild.

### Missing Features — Priority Order

| Feature | Description | Priority |
|---|---|---|
| Fitness tracking module | Workout logging with type, duration, notes. Claude training interface in future. Personal Trainer project (Claude Project) is the v1 — manual logs, no dashboard integration yet. | High |
| Oura token auto-refresh | Currently manual every 30 days. Need OAuth flow built into dashboard. | High |
| Todoist integration | Pull open tasks into dashboard. See `system_architecture.md` Phase 1. | High |
| Google Calendar integration | Show week ahead, available focus blocks, relationship commitments. Phase 2. | Medium |
| Weekly review automation | Auto-populate review with prior week data. Feed forward to next week. | Medium |
| Claude training interface | AI workout partner aware of phase, injury constraints, Oura recovery score. v1 lives as a separate Claude Project; v2 integrates with dashboard. | Medium |
| Mobile optimization | Add to iPhone home screen as PWA (basic version works today via Safari "Add to Home Screen"). Full PWA work is Phase 5. | Medium |
| Alert push notifications | Currently alerts only show on dashboard. Need push to phone. | Low |
| Data persistence | Currently localStorage only. Data lost if browser cache cleared. Need cloud storage. Migrating to D1 in Phase 4. | Low |

## How To Update the Dashboard

### Current Update Process (Claude Code)

As of April 26, 2026: Claude Code is set up locally and connected to the GitHub repo at `C:\Users\mjtha\projects\life-system`. The old manual paste-to-GitHub flow is deprecated.

To update the dashboard:

1. In PowerShell: `cd $HOME\projects\life-system` then `claude`
2. Tell Claude Code what to change
3. Approve edits
4. Tell Claude Code to commit and push: "Stage changes, commit with message ..., push to origin main"
5. Live URL updates within ~60 seconds

### Local Dev Environment (Windows)

- Node v25.15.0
- npm 11.12.1
- Git 2.54.0
- Claude Code 2.1.119
- Repo path: `C:\Users\mjtha\projects\life-system`

## Data Architecture

### Current Storage (localStorage — to be migrated to D1 in Phase 4)

- `life_token` — Oura access token
- `life_ci` — daily check-ins object keyed by date YYYY-MM-DD
- `life_rv_YYYY-MM-DD` — weekly review notes per week

Risk: all data is browser-local and **per-browser**. If cache is cleared, all historical check-in data is lost. Phone and laptop browsers have separate storage and can diverge. Pick one device as primary check-in surface until D1 migration.

### Check-in Data Structure

```javascript
checkins[YYYY-MM-DD] = {
  habits: {
    stimulants: true/false,
    addie: true/false,
    focus: true/false,
    self_time: true/false,
    emma: true/false,
    lauren: true/false,
    workout: true/false
  },
  regulation: 1 | 2 | 3 | null,
  notes: 'string'
}
```

### Oura Data Structure (in memory)

```javascript
ouraData = {
  sleep: {
    'YYYY-MM-DD': {
      score: number,      // from daily_sleep endpoint
      totalMins: number,  // from sleep sessions endpoint (lags 1 day)
      rhr: number         // lowest_heart_rate from sessions (lags 1 day)
    }
  },
  readiness: {
    'YYYY-MM-DD': {
      score: number       // from daily_readiness endpoint
    }
  }
}
```

## Data Sources & Access

The system federates across external sources rather than mirroring them (see
substrate model in system_architecture.md). Each source notes how it's reached
and any preprocessing required before an agent can use it.

### Source-of-truth map

| Domain | Source of truth | Access method | Notes |
|---|---|---|---|
| Tasks / ideation | Todoist | Native Claude connector (read/write) | Verified working. Taxonomy already built. |
| Personal calendar | Google Calendar (personal) | Native Claude connector (read/write) | Primary + specific allowlisted calendars only — see allowlist below. |
| Sentinel work calendar | Sentinel M365 tenant | Microsoft 365 connector (read-only) | Full event detail. Events return UTC-stamped. |
| Tenex work calendar | Tenex M365 tenant | Published ICS → subscribed into personal Google Calendar (read-only) | Reached via the Google connector, NOT the M365 connector (one tenant per M365 connector; Sentinel holds that slot). Appears as the sole `@import.calendar.google.com` entry, summary "Calendar" (name fixed by the feed, can't be renamed in Google). Mixed per-event timezones. Physically read-only (can't write back to a subscribed ICS feed). |
| Health / sleep / workouts | Apple Health (aggregates Oura) | Apple Health connector | Replaces former dashboard Oura panel. |
| Training log | D1 (`life-system-db`, `training_*` tables) | Custom MCP server (conversation agents) + bearer-token HTTP routes (scheduled/build agents) | System's own substrate, not external. |
| Check-ins / regulation events / scheduler state | D1 (`life-system-db`) | Same dual-path as training log | System's own substrate. |
| Strategy / history / decisions | This repo (markdown) | web_fetch (read) / Claude Code (write) | Tiered; see system_architecture.md. |

### Google Calendar — scheduling allowlist

The personal Google instance holds many calendars; only a specified subset are
scheduling inputs. The planner reads ONLY these:

| Calendar | ID / identification | Role |
|---|---|---|
| Personal primary | mjtharp2@gmail.com | Personal commitments. Default WRITE target. |
| Tharp Family | `daf34f44e930e4f2be5ded80522f7fa59c327bf26f849130d67a9e8c26e26e65@group.calendar.google.com` | Parenting shifts + family-coordinated events. READ constraint AND WRITE target (see write routing). |
| Tenex (work) | sole `@import.calendar.google.com` entry (summary "Calendar") | Tenex work commitments. READ-only. |

**Explicitly excluded from scheduling reads:**
- Sports feeds (Bulls, Cubs, Bears, Illini basketball/football, Chelsea) — would
  flood proposals with false "busy" blocks for games not necessarily attended.
- Home Maintenance Calendar — reference reminders, not time-blocking commitments.
- Emma's Calendar (emm.bernstein@gmail.com) — another person's time; visibility
  only, not Matt's scheduling constraint.
- "Family" calendar (`family11194695938602297769`, UTC) — superseded by Tharp
  Family Calendar for scheduling purposes.

Reading the full instance indiscriminately degrades proposals. The allowlist is
the input contract; revisit it deliberately if a new calendar should count.

### Weekly planner / assistant — calendar access method

The planner/assistant runs as a Claude.ai conversation and reads sources via the
connectors at session start. It does NOT use hardcoded calendar IDs where
avoidable (Google can reassign import IDs on re-subscribe). Method:

1. **Google** — call `list_calendars`, then read ONLY the allowlisted calendars:
   personal primary, Tharp Family (by the `@group` ID above), and the Tenex feed
   (the sole `@import.calendar.google.com` entry). Ignore all others.
2. **Sentinel** — call the Microsoft 365 connector for the Sentinel tenant.
3. **Todoist** — native connector.
4. **Substrate** — trainer log, check-ins, regulation state via the custom MCP
   server / D1; skeleton + tiers from the reference docs.
5. Apply the preprocessing and write rules below.

NOTE: Tenex match-by-import-type holds only while it's the single ICS
subscription. If another `@import` feed is ever added, disambiguation breaks —
at that point move calendar IDs into a `config` table in `life-system-db` and
read them via MCP. (Deferred; not needed today.)

### Federation, preprocessing, and write rules

Any agent reading these sources or writing back MUST:

1. **Normalize all times to America/Chicago (Central).** Sources return mixed
   timezones — Sentinel M365 returns UTC; the Tenex ICS feed carries mixed
   per-event timezones (America/Chicago and America/New_York within the same
   feed). Trusting raw timezone fields will misplace events.

   **Specific Tenex-feed trap:** the import feed often stamps an event with a
   timezone label whose offset is *already* Central (e.g. a −05:00 event labeled
   America/New_York). Re-converting from the label subtracts an hour that was
   never there. Always compute from the absolute UTC instant, not the label.

2. **Drop cancelled events.** Cancelled occurrences persist as ghost entries in
   the ICS feed. Filter on `transparency: transparent` (reliable) rather than
   the "Canceled:" subject prefix (cosmetic).

3. **Read availability, not content.** Scheduling needs times + busy/free +
   tentative status, not meeting bodies, attendees, or join links. For M365, key
   on `showAs` (busy / tentative / free). Full event detail is for
   identity/verification only, not routine scheduling.

4. **Write routing.** Writes route by target:
   - **Personal primary (mjtharp2@gmail.com)** — workouts, focus blocks,
     personal appointments/tasks. Default write target. May earn autonomous
     (no-confirm) writes once the agent's judgment is proven.
   - **Tharp Family** — parenting shifts and family-coordinated events. Full
     read/write: the agent can add, move, edit, and delete here — managing
     parenting-shift logistics is a primary function. ONE GUARDRAIL: confirm
     before any add / move / edit / delete on this calendar. It's shared
     (Matt + Lauren write; nannies read and coordinate against it), so a quick
     confirm before any mutation is cheap insurance against a change propagating
     wrongly to childcare. Reads and proposals need no confirmation — only the
     mutation itself. Before showing a confirm, RE-READ this calendar so the
     proposed change reflects current state (Lauren may have edited it since
     session start) — correctness, not ceremony.
   - **Never write** — Tenex feed (physically read-only ICS), Sentinel / any
     M365 work calendar (read-only by choice). Constraints, not targets.

5. **Close, don't delete.** For items flagged "kill" or obsolete, complete/close
   them (reversible) rather than hard-delete; leave permanent deletion to the
   user. And don't pre-complete work that isn't done yet (e.g. a task due later
   today) — let it close when the work actually happens.

### Childcare roster & parenting-shift conventions

Reading the Tharp Family calendar:
- **Bruna, Karriemah** — nannies; recurring weekday daytime coverage. Their
  entries describe who's covering, not Matt's scheduling constraints.
- **Mo, Deb** — babysitters / backup coverage. A "Mo" or "Deb" block means
  coverage is already handled for that window — read it as availability freed,
  not a commitment to plan around (e.g. "Mo 5-8" while Karriemah is off is what
  frees an Emma overnight).

Writing parenting shifts (Tharp Family calendar):
- Discrete events named `[Name] morning shift` / `[Name] afternoon shift`.
- Canonical times: morning 7:00-8:00am, afternoon 5:30-8:00pm (Central).
- Matt and Lauren take complementary halves each day (one AM, one PM); the user
  supplies the week's split. Write both parents' shifts.
- Subject to the Tharp Family confirm-before-mutation guardrail (re-read first).
  Don't duplicate a shift the other parent already entered; if an existing entry
  differs (e.g. a 5:00 vs 5:30 start), surface it rather than silently editing
  the other parent's event.

---

*Companion to `life_system_reference.md` (strategy) and `system_architecture.md` (build plan). Update at each phase boundary or material change.*
