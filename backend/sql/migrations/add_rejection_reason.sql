-- =============================================================
-- Migration: add_rejection_reason
--
-- Run this in Supabase Dashboard → SQL Editor.
--
-- Purpose: rejecting a public report used to DELETE the row, which
-- meant the reporter could never find out *why* it was rejected when
-- they checked the tracking page. This migration changes rejection to
-- a soft action: the case is kept with status = 'REJECTED' and a
-- human-readable rejection_reason, so the reporter can see the reason
-- when tracking their reference number.
--
-- IMPORTANT: Step 1 (ALTER TYPE ... ADD VALUE) cannot run inside a
-- transaction block. If you paste the whole file at once and get the
-- error "ALTER TYPE ... ADD cannot run inside a transaction block",
-- run the single line in Step 1 on its own first, then run the rest.
-- =============================================================


-- ── 1. Add REJECTED to the case_status enum ──────────────────
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'REJECTED';


-- ── 2. Rejection columns ─────────────────────────────────────
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by      UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN cases.rejection_reason IS
  'Human-readable reason shown to the reporter on the tracking page when a report is rejected.';


-- ── 3. Rebuild cases_with_coords view to expose rejection fields ──
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
  c.rejection_reason,
  c.rejected_at,
  c.published,
  c.photo_hidden,
  c.reported_by,
  c.verified_by,
  c.verified_at,
  c.created_at,
  c.updated_at
FROM cases c
JOIN barangays b ON b.id = c.barangay_id;
