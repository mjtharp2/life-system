# Session Log Format

**Purpose:** Standard format for every workout log entry. Designed to be (1) scannable on mobile during and after sessions, and (2) parseable for future migration to a database layer via Claude Code.

**Maintained strictly.** The trainer does not improvise format variations. Structural consistency is what makes the future import script possible.

## Format specification

Every session log is a single fenced YAML block, optionally followed by a free-text "notes" block. YAML is human-readable, mobile-friendly, and trivial to parse programmatically.

### Template

```yaml
schema_version: "1.0"

session:
  date: 2026-04-28
  day: tue
  type: lower_body
  phase: calibration
  duration_min: 58
  location: home_gym
  travel: false

readiness:
  energy: 7              # 1-10 self-report at session start
  sleep_hours: 7.5       # optional, from Oura if available
  hrv: null              # optional
  rhr: null              # optional
  pec_baseline: 3        # 1-5 how the pec felt at start of session
  notes: "Slight residual fatigue from Mon, otherwise good"

tirzepatide:
  weeks_since_first_dose: 0
  weeks_since_last_escalation: 0
  current_dose_mg: 2.5
  appetite: normal       # normal | suppressed | very_suppressed | n/a
  gi_symptoms: false

lifts:
  - name: trap_bar_deadlift
    category: primary
    sets:
      - { weight: 185, reps: 5, rpe: 6, note: "warmup feel" }
      - { weight: 225, reps: 5, rpe: 7 }
      - { weight: 245, reps: 5, rpe: 8, note: "top set, form held" }
    pec_engagement: null   # not applicable for this lift
    progression: baseline_set
    notes: "First time testing — established 245x5 as working baseline"

  - name: romanian_deadlift
    category: secondary
    sets:
      - { weight: 135, reps: 8, rpe: 7 }
      - { weight: 155, reps: 8, rpe: 8 }
      - { weight: 155, reps: 8, rpe: 8 }
    pec_engagement: null
    progression: held
    notes: ""

  - name: leg_press
    category: accessory
    sets:
      - { weight: 270, reps: 12, rpe: 7 }
      - { weight: 270, reps: 12, rpe: 8 }
    pec_engagement: null
    progression: held
    notes: ""

cardio: []

flags: []

next_session:
  date: 2026-04-29
  day: wed
  type: upper_pull_pec_rehab
  prescription_hints:
    - "DB row: try 70s if 65s × 8 felt ≤ RPE 8 last time"
    - "Pulldown: bump to 165 from 160"
    - "Pec rehab: hold cable crossover weight if engagement was 3+"

summary:
  what_moved_up: ["trap_bar_dl baseline established at 245x5"]
  what_held: ["RDL 155x8x3", "leg press 270x12"]
  what_dropped: []
  notable: "First proper lower body session in a while. Trap bar felt solid. Hip hinge mobility holding up under load."
```

### Free-text notes (optional, after the YAML block)

A 1–3 sentence narrative if anything needs more context than the structured fields capture. Skip when the YAML covers it.

## Field definitions

### `schema_version` (top-level field)

String. Current value: `"1.0"`. Bump when the format changes (see [Format versioning](#format-versioning) section). Every log entry must include this. The future import script uses this to handle format evolution without breaking on old logs.

### `session` block

- **`date`** — ISO format (YYYY-MM-DD).
- **`day`** — `mon` / `tue` / `wed` / `thu` / `fri` / `sat` / `sun`.
- **`type`** — one of: `lower_body`, `upper_pull_pec_rehab`, `upper_push_pec_rehab`, `conditioning_pec_rehab`, `cardio_zone2`, `cardio_vo2`, `tennis`, `mobility`, `travel_lower`, `travel_pull`, `travel_push`, `travel_cardio`, `makeup` (when swapping). Use `other` only if nothing fits and explain in notes.
- **`phase`** — `calibration` (weeks 1–2), `build` (weeks 3+), `post_emg` (after EMG-driven program revision).
- **`duration_min`** — actual active gym time, integer.
- **`location`** — `home_gym`, `home`, `hotel`, `outdoor`, `other`.
- **`travel`** — boolean. True for any session done while away from home base.

### `readiness` block

Captured at the start of the session. The trainer asks; client reports.

- **`energy`** — 1–10 subjective.
- **`sleep_hours`** — decimal, from Oura if available, else estimate. Null if not reported.
- **`hrv`, `rhr`** — null unless client reports specific values.
- **`pec_baseline`** — 1–5 how the left pec feels before training starts. Always captured on training days.
- **`notes`** — short free text.

### `tirzepatide` block

- **`weeks_since_first_dose`** — integer. Calculate from April 24, 2026 baseline.
- **`weeks_since_last_escalation`** — integer. 0 in dose-escalation week.
- **`current_dose_mg`** — decimal.
- **`appetite`** — `normal`, `suppressed`, `very_suppressed`, `n/a`.
- **`gi_symptoms`** — boolean.

### `lifts` block (list)

Each lift gets one entry. Use snake_case for name to keep parseable. Standard names — **maintain a vocabulary, don't invent new variants:**

- **Lower:** `trap_bar_deadlift`, `back_squat`, `safety_bar_squat`, `hack_squat`, `romanian_deadlift`, `bulgarian_split_squat`, `leg_press`, `walking_lunge`, `hamstring_curl`, `calf_raise`
- **Pull:** `pullup`, `assisted_pullup`, `barbell_row`, `db_row`, `chest_supported_row`, `seated_cable_row`, `lat_pulldown_wide`, `lat_pulldown_neutral`, `face_pull`, `db_curl`
- **Push:** `db_bench`, `barbell_bench`, `db_shoulder_press_seated`, `landmine_press`, `triceps_pushdown`, `lateral_raise`
- **Pec rehab:** `cable_crossover_high_to_low`, `pec_deck`, `floor_fly`, `db_squeeze_press`, `single_arm_wall_press`
- **Core:** `plank`, `dead_bug`, `bird_dog`, `hanging_leg_raise`, `cable_crunch`

**Add new entries to this vocabulary by editing this document, not by improvising in logs.**

- **`category`** — `primary` (top compound of the session), `secondary`, `accessory`, `pec_rehab`, `core`, `mobility`.
- **`sets`** — list of `{weight, reps, rpe, note}`. Weight in lb. Note is optional, short.
- **`pec_engagement`** — 1–5 for any lift involving the chest. Null otherwise.
  - 1 = barely felt
  - 2 = some engagement, mostly compensators
  - 3 = engaging but not full
  - 4 = solid engagement throughout
  - 5 = fully engaged, both sides symmetrical
- **`progression`** — `progressed` (load up), `held` (same as last session), `regressed` (load down), `baseline_set` (first time logging this lift), `not_progressed_pec_gate` (held because pec engagement didn't gate).
- **`notes`** — short free text on this lift specifically.

### `cardio` block (list)

Used for any cardio in the session. Empty list (`cardio: []`) if none.

- **`modality`** — `bike`, `tread`, `elliptical`, `row`, `tennis`, `other`.
- **`type`** — `zone2`, `vo2_intervals`, `tempo`, `recovery`.
- **`duration_min`** — integer.
- **`avg_hr`** — integer if available from Oura/watch, else null.
- **`rpe`** — 1–10.
- **`notes`** — short free text.

### `flags` block (list)

Anything noteworthy that isn't normal session data. Empty list if nothing to flag.

- **`type`** — `pec_off`, `new_symptom`, `equipment`, `schedule`, `pain`, `other`.
- **`detail`** — short free text.

Used for tracking patterns over time. If `pec_off` appears 3 sessions in a row, that's a signal worth surfacing.

### `next_session` block

The trainer's prescriptive notes for the next session. Helps the next session start fast — the trainer reads this from the most recent log to plan today's work.

- **`date`, `day`, `type`** — projected.
- **`prescription_hints`** — list of short strings, specific weight/rep targets or focus areas.

### `summary` block

Three lists for fast scanning:

- **`what_moved_up`** — lifts that progressed this session.
- **`what_held`** — lifts at maintenance.
- **`what_dropped`** — anything regressed.
- **`notable`** — single string for the headline observation.

## Logging workflow

### During the session

The trainer captures data conversationally as the client reports. Doesn't dump the full YAML mid-session — that's the end-of-session output.

### At the end of the session

Trainer outputs the complete YAML log block. Client confirms it's correct (or tells the trainer what to fix). Trainer also outputs the brief end-of-session prose summary (2–3 sentences) for the client's at-a-glance use.

### Special cases

- **Tennis day:** still log it, but `lifts: []` and use cardio block to capture it. Type = `tennis`.
- **Pure mobility day:** type = `mobility`, lifts and cardio empty, brief notes only.
- **Travel session at hotel:** type prefixed with `travel_`. `location: hotel`. `travel: true`.
- **Missed day:** don't generate a log entry. The next real session's log will reference the gap in its `summary.notable` field.
- **Partial session (cut short):** log what happened. Add a flag with type `schedule` or whatever caused the cut.

## Database migration notes (for future reference)

When the database layer is built via Claude Code, this format maps cleanly to:

- One `sessions` table — keyed on `date`, with columns for everything in the `session`, `readiness`, and `tirzepatide` blocks.
- One `lift_entries` table — one row per lift per session, foreign key to session, with `name`, `category`, `pec_engagement`, `progression`, `notes`.
- One `sets` table — one row per set, foreign key to lift_entry, with `weight`, `reps`, `rpe`, `note`, `set_order`.
- One `cardio_entries` table — one row per cardio block, foreign key to session.
- One `flags` table — one row per flag, foreign key to session.
- `next_session` and `summary` blocks can stay denormalized as JSON columns or be discarded post-migration since they're transitional planning data, not historical truth.

The standardized vocabulary (lift names, types, categories) becomes lookup tables. Hence the discipline about maintaining the vocabulary in this doc rather than improvising in logs.

## Format versioning

**Current version:** v1.0 (April 27, 2026).

If the format changes, bump the version and note what changed at the bottom of this document. Old logs in the format they were written in stay valid; the import script handles version differences.
