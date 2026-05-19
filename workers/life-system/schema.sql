-- Training log schema for life-system-db
-- Additive migration: extends the existing D1 database with trainer-domain tables.
-- All tables prefixed `training_` to coexist with future domain tables.
--
-- Source of truth: YAML logs produced by the trainer agent (see trainer/log_format.md).
-- Schema mirrors the YAML structure faithfully; round-trip should be lossless.
--
-- D1 / SQLite notes:
--   - TEXT for dates (ISO YYYY-MM-DD) and timestamps (ISO datetime)
--   - REAL for floating-point values (RPE, weight, engagement)
--   - INTEGER for counts and whole numbers
--   - JSON columns store arrays as JSON strings (prescription_hints, summary lists)
--   - Foreign keys ON DELETE CASCADE so deleting a session removes all children

-- ============================================================================
-- training_sessions: one row per workout session.
-- Combines session, readiness, and tirzepatide YAML blocks (all 1:1 with session).
-- ============================================================================
CREATE TABLE training_sessions (
  id                          TEXT PRIMARY KEY,           -- UUID
  -- session block
  date                        TEXT NOT NULL,              -- ISO YYYY-MM-DD
  day                         TEXT NOT NULL,              -- mon|tue|wed|thu|fri|sat|sun
  type                        TEXT NOT NULL,              -- enum: lower_body, upper_push_pec_rehab, etc.
  phase                       TEXT,                       -- calibration|build|post_emg
  duration_min                INTEGER,
  location                    TEXT,                       -- home_gym|home|hotel|outdoor|other
  travel                      INTEGER NOT NULL DEFAULT 0, -- boolean (0/1)
  -- readiness block
  energy                      INTEGER,                    -- 1-10
  sleep_hours                 REAL,
  hrv                         REAL,
  rhr                         INTEGER,
  pec_baseline                REAL,                       -- 1-5, half-points allowed
  readiness_notes             TEXT,
  -- tirzepatide block
  weeks_since_first_dose      INTEGER,
  weeks_since_last_escalation INTEGER,
  current_dose_mg             REAL,
  appetite                    TEXT,                       -- normal|suppressed|very_suppressed|n/a
  gi_symptoms                 INTEGER,                    -- boolean (0/1)
  -- summary block
  summary_what_moved_up       TEXT,                       -- JSON array of strings
  summary_what_held           TEXT,                       -- JSON array of strings
  summary_what_dropped        TEXT,                       -- JSON array of strings
  summary_notable             TEXT,                       -- single string
  -- next_session block
  next_session_date           TEXT,                       -- ISO YYYY-MM-DD
  next_session_day            TEXT,
  next_session_type           TEXT,
  next_session_notes          TEXT,
  next_session_hints          TEXT,                       -- JSON array of strings
  -- bookkeeping
  schema_version              TEXT NOT NULL DEFAULT '1.0',
  created_at                  TEXT NOT NULL,              -- ISO datetime, when this row was inserted
  -- prevent duplicate inserts on backfill reruns
  UNIQUE (date, type)
);

CREATE INDEX idx_training_sessions_date          ON training_sessions(date);
CREATE INDEX idx_training_sessions_type          ON training_sessions(type);
CREATE INDEX idx_training_sessions_phase         ON training_sessions(phase);

-- ============================================================================
-- training_lift_entries: one row per lift within a session.
-- ============================================================================
CREATE TABLE training_lift_entries (
  id                TEXT PRIMARY KEY,                     -- UUID
  session_id        TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  order_in_session  INTEGER NOT NULL,                     -- 0-indexed position within session
  name              TEXT NOT NULL,                        -- snake_case lift name from log_format vocab
  category          TEXT NOT NULL,                        -- primary|secondary|accessory|pec_rehab|core|mobility
  pec_engagement    REAL,                                 -- 1-5, null for non-chest lifts
  progression       TEXT,                                 -- progressed|held|regressed|baseline_set|not_progressed_pec_gate
  notes             TEXT
);

CREATE INDEX idx_training_lift_entries_session   ON training_lift_entries(session_id);
CREATE INDEX idx_training_lift_entries_name      ON training_lift_entries(name);
CREATE INDEX idx_training_lift_entries_category  ON training_lift_entries(category);

-- ============================================================================
-- training_sets: one row per set within a lift entry.
-- ============================================================================
CREATE TABLE training_sets (
  id              TEXT PRIMARY KEY,                       -- UUID
  lift_entry_id   TEXT NOT NULL REFERENCES training_lift_entries(id) ON DELETE CASCADE,
  set_number      INTEGER NOT NULL,                       -- 1-indexed position within lift
  weight          REAL,                                   -- lb; null/0 for bodyweight
  reps            INTEGER,
  rpe             REAL,                                   -- supports decimals like 7.5
  note            TEXT                                    -- singular per YAML convention
);

CREATE INDEX idx_training_sets_lift_entry        ON training_sets(lift_entry_id);

-- ============================================================================
-- training_cardio_entries: one row per cardio block within a session.
-- ============================================================================
CREATE TABLE training_cardio_entries (
  id            TEXT PRIMARY KEY,                         -- UUID
  session_id    TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  order_in_session INTEGER NOT NULL,                      -- 0-indexed
  modality      TEXT,                                     -- bike|tread|elliptical|row|tennis|other
  type          TEXT,                                     -- zone2|vo2_intervals|tempo|recovery
  duration_min  INTEGER,
  avg_hr        INTEGER,
  rpe           REAL,
  notes         TEXT
);

CREATE INDEX idx_training_cardio_session         ON training_cardio_entries(session_id);

-- ============================================================================
-- training_flags: one row per flag within a session.
-- ============================================================================
CREATE TABLE training_flags (
  id          TEXT PRIMARY KEY,                           -- UUID
  session_id  TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  order_in_session INTEGER NOT NULL,                      -- 0-indexed
  type        TEXT,                                       -- pec_off|new_symptom|equipment|schedule|pain|other
  detail      TEXT
);

CREATE INDEX idx_training_flags_session          ON training_flags(session_id);
CREATE INDEX idx_training_flags_type             ON training_flags(type);
