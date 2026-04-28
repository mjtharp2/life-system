# Life System Dashboard — Technical State

*Last updated: April 26, 2026 · Companion to `system_architecture.md`*

## Infrastructure

### URLs & Services

| Service | Details |
|---|---|
| Dashboard URL | https://mjtharp2.github.io/life-system |
| GitHub Repo | github.com/mjtharp2/life-system (public) |
| Cloudflare Worker | https://plain-hill-28ab.mjtharp2.workers.dev |
| Oura OAuth App | Client ID: `5ab2f062-8edd-4887-90d3-b92178fce175` |
| Worker Purpose | Oura API CORS proxy — passes path + token params to Oura v2 API |

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

> TODO: Build automatic token refresh flow so this doesn't require manual steps. (Phase 4 in architecture spec.)

### Cloudflare Worker Code

Current worker code (`plain-hill-28ab`). Edit at cloudflare.com → Workers & Pages → plain-hill-28ab → Edit code:

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    const token = url.searchParams.get('token');
    if (!path || !token) return new Response('Missing params', { status: 400 });
    const ouraUrl = 'https://api.ouraring.com/v2/usercollection/' + decodeURIComponent(path);
    const ouraRes = await fetch(ouraUrl, { headers: { Authorization: 'Bearer ' + token } });
    const data = await ouraRes.text();
    return new Response(data, {
      status: ouraRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
```

> Note: Phase 0 of the architecture spec refactors this into a multi-route worker (Oura + Todoist + Calendar + scheduler).

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

---

*Companion to `life_system_reference.md` (strategy) and `system_architecture.md` (build plan). Update at each phase boundary or material change.*
