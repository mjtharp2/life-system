-- Add subjective self-rating columns to weekly_checkins.
-- Additive migration. NOT idempotent — SQLite ALTER TABLE ADD COLUMN has no
-- IF NOT EXISTS; re-running this file will error on already-added columns.
-- That's harmless: the desired schema is reached after the first successful run.
--
-- Apply with:
--   npx wrangler d1 execute life-system-db --remote --file=schema-weekly-checkins-self-ratings.sql

ALTER TABLE weekly_checkins ADD COLUMN energy_self_rating INTEGER;         -- 1-10, nullable
ALTER TABLE weekly_checkins ADD COLUMN mood_self_rating INTEGER;           -- 1-10, nullable
ALTER TABLE weekly_checkins ADD COLUMN sleep_quality_self_rating INTEGER;  -- 1-10, nullable
