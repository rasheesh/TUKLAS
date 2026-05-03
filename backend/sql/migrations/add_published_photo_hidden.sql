-- =============================================================
-- Migration: add published and photo_hidden columns
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- 1. Add only the two new columns (resolution columns already exist in schema)
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS published    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS photo_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill: existing VERIFIED/FOUND/IDENTIFIED cases are already published
UPDATE cases
SET published = TRUE
WHERE status IN ('VERIFIED', 'FOUND', 'IDENTIFIED');

-- 3. Recreate the cases_with_coords view to expose the new columns.
--    DROP + CREATE is required when adding columns to a view.
DROP VIEW IF EXISTS cases_with_coords;

CREATE VIEW cases_with_coords AS
SELECT
  c.id,
  c.type,
  c.status,
  c.full_name,
  c.nickname,
  c.age_approx,
  c.age_range_min,
  c.age_range_max,
  c.gender,
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

-- 4. Index for public query performance
CREATE INDEX IF NOT EXISTS idx_cases_published
  ON cases (published)
  WHERE published = TRUE;
