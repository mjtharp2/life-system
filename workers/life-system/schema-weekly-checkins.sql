-- Weekly check-ins schema for life-system-db
-- Additive migration: extends the database with weekly check-in tables.
-- Pattern follows training_* tables: UUID PK, FK ON DELETE CASCADE,
-- one D1 batch per write.
--
-- Apply with:
--   npx wrangler d1 execute life-system-db --remote --file=schema-weekly-checkins.sql

-- ============================================================================
-- weekly_checkins: one row per check-in.
-- Companion to the markdown narrative in weekly_log/YYYY-MM-DD.md;
-- this row holds the queryable signals + a pointer to the narrative.
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_checkins (
  id                  TEXT PRIMARY KEY,            -- UUID, returned from write
  week_start          TEXT NOT NULL,               -- ISO YYYY-MM-DD (Monday of planned week)
  checkin_date        TEXT NOT NULL,               -- ISO YYYY-MM-DD (when the check-in was done)
  sleep_avg_7d        REAL,
  regulation_events   TEXT,                        -- "none" | "level_1" | "level_2" | "level_3" | freeform
  workout_adherence   TEXT,                        -- qualitative free-text
  stimulant_contract  TEXT,                        -- "held" | "wavered_once" | "wavered_multiple" | "not_recorded"
  operating_mode      TEXT,                        -- short framing label, e.g. "pressed", "travel"
  headline            TEXT,                        -- one-line week summary
  watchfors           TEXT,                        -- JSON array of slug strings
  narrative_path      TEXT,                        -- relative path to weekly_log/<file>.md
  created_at          TEXT NOT NULL,               -- ISO datetime
  UNIQUE (week_start)                              -- one check-in per planned week
);

CREATE INDEX IF NOT EXISTS idx_weekly_checkins_week_start ON weekly_checkins(week_start);

-- ============================================================================
-- weekly_training_slots: trainer-bridge contract — agreed training slots
-- for the week, child rows of a check-in.
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_training_slots (
  id              TEXT PRIMARY KEY,                -- UUID
  checkin_id      TEXT NOT NULL REFERENCES weekly_checkins(id) ON DELETE CASCADE,
  day             TEXT NOT NULL,                   -- ISO YYYY-MM-DD (the specific date the slot is for)
  time            TEXT,                            -- e.g. "06:00" or "evening"
  category        TEXT,                            -- lift | cardio | tennis | mobility | rest
  constraint_note TEXT,                            -- e.g. "45min cap", "hotel/no equipment", "lower-impact: achilles"
                                                   -- (renamed from `constraint` to avoid SQL keyword collision)
  order_in_week   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weekly_training_slots_checkin ON weekly_training_slots(checkin_id);
