-- =============================================================
-- Migration: add_height_ft
-- Adds approximate height in feet to the cases table.
-- Stored as a decimal (e.g. 5.75 = 5 ft 9 in).
-- Optional on all cases — aids case matching.
-- =============================================================

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS height_ft NUMERIC(4, 2)
    CHECK (height_ft IS NULL OR (height_ft >= 1.0 AND height_ft <= 9.0));

COMMENT ON COLUMN cases.height_ft IS
  'Approximate height in feet as a decimal (e.g. 5.75 = 5 ft 9 in). Optional. Used for case matching.';
