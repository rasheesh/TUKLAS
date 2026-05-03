-- =============================================================
-- Migration: add_missing_columns_and_rebuild_view
--
-- Run this in Supabase Dashboard → SQL Editor.
-- This supersedes the three individual migration files:
--   - add_height_ft.sql
--   - add_case_reference.sql
--   - add_published_photo_hidden.sql
--
-- Run THIS file instead of all three. It is safe to run even
-- if some columns already exist (uses ADD COLUMN IF NOT EXISTS).
-- =============================================================


-- ── 1. height_ft ──────────────────────────────────────────────
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS height_ft NUMERIC(4, 2)
    CHECK (height_ft IS NULL OR (height_ft >= 1.0 AND height_ft <= 9.0));

COMMENT ON COLUMN cases.height_ft IS
  'Approximate height in feet as a decimal (e.g. 5.75 = 5 ft 9 in). Optional. Used for case matching.';


-- ── 2. case_reference ─────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS case_reference_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS case_reference VARCHAR(20) UNIQUE;

-- Back-fill existing rows that have no reference yet
UPDATE cases
SET case_reference = 'TKL-' || TO_CHAR(EXTRACT(YEAR FROM created_at)::INT, 'FM9999')
                   || '-' || LPAD(nextval('case_reference_seq')::TEXT, 5, '0')
WHERE case_reference IS NULL;

-- Auto-generate on INSERT for new rows
ALTER TABLE cases
  ALTER COLUMN case_reference
  SET DEFAULT 'TKL-' || TO_CHAR(EXTRACT(YEAR FROM NOW())::INT, 'FM9999')
              || '-' || LPAD(nextval('case_reference_seq')::TEXT, 5, '0');

CREATE INDEX IF NOT EXISTS idx_cases_reference ON cases (case_reference);


-- ── 3. published & photo_hidden ───────────────────────────────
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS published    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS photo_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill: existing verified/resolved cases are already published
UPDATE cases
SET published = TRUE
WHERE status IN ('VERIFIED', 'FOUND', 'IDENTIFIED');

CREATE INDEX IF NOT EXISTS idx_cases_published
  ON cases (published)
  WHERE published = TRUE;


-- ── 4. Rebuild cases_with_coords view ─────────────────────────
-- DROP + CREATE is required when adding columns to a view.
DROP VIEW IF EXISTS cases_with_coords;

CREATE VIEW cases_with_coords AS
SELECT
  c.id,
  c.type,
  c.status,
  c.case_reference,
  c.full_name,
  c.nickname,
  c.age_approx,
  c.age_range_min,
  c.age_range_max,
  c.gender,
  c.height_ft,
  c.description,
  c.barangay_id,
  b.name                                    AS barangay_name,
  c.location_text,
  c.incident_date,
  c.incident_time,
  CASE
    WHEN c.location_coords IS NOT NULL
    THEN ST_AsGeoJSON(c.location_coords)::json
    ELSE NULL
  END                                       AS coords_geojson,
  (
    SELECT cp.url
    FROM case_photos cp
    WHERE cp.case_id = c.id AND cp.is_primary = TRUE
    LIMIT 1
  )                                         AS primary_photo_url,
  c.reporter_name,
  c.reporter_contact,
  c.resolution_notes,
  c.identified_name,
  c.resolved_at,
  c.resolved_by,
  c.published,
  c.photo_hidden,
  c.reported_by,
  c.verified_by,
  c.verified_at,
  c.created_at,
  c.updated_at
FROM cases c
JOIN barangays b ON b.id = c.barangay_id;
