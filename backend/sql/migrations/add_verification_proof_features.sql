-- ============================================================
-- Migration: add_verification_proof_features.sql
-- Adds: proof documents, source link, trust level, claim
--       workflow, DPA consent, minor protection flag,
--       and SLA tracking columns.
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. proof_documents ──────────────────────────────────────
-- JSONB array: [{ filename, url, mime_type, size_bytes, uploaded_at }]
-- Stored in private bucket 'case-proofs' (admin-only signed URLs).
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS proof_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 2. source_link ──────────────────────────────────────────
-- URL to police announcement, news article, or official FB post.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS source_link TEXT;

-- Enforce max length at DB level as a belt-and-suspenders guard.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cases_source_link_length'
  ) THEN
    ALTER TABLE cases
      ADD CONSTRAINT cases_source_link_length
      CHECK (char_length(source_link) <= 2048);
  END IF;
END $$;

-- ── 3. trust_level ──────────────────────────────────────────
-- AUTO-COMPUTED trust tier based on submitted evidence:
--   HIGH   – police/barangay cert attached
--   MEDIUM – source link provided OR other supporting doc
--   LOW    – no proof and no source link
-- Admins can manually override (e.g. after phone verification).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'trust_level_enum'
  ) THEN
    CREATE TYPE trust_level_enum AS ENUM ('HIGH', 'MEDIUM', 'LOW');
  END IF;
END $$;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS trust_level trust_level_enum NOT NULL DEFAULT 'LOW';

-- ── 4. claimed_by / claimed_at ──────────────────────────────
-- Prevents two admins reviewing the same pending case.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- ── 5. DPA consent tracking ─────────────────────────────────
-- Records explicit consent at submission time (DPA 2012 compliance).
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS consent_given BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS consent_ip TEXT;

-- ── 6. Minor protection flag ────────────────────────────────
-- Set to TRUE when age_approx < 18 or age_range_max < 18.
-- Forces photo_hidden = TRUE and blocks public photo display.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 7. SLA tracking ─────────────────────────────────────────
-- Track when review was completed vs submission time.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS review_completed_at TIMESTAMPTZ;

-- ── 8. Rejection reason ─────────────────────────────────────
-- Admin must provide a reason when rejecting (for audit trail).
-- Stored before hard-delete so it persists in audit_logs.description.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ── 9. proof_doc_access_log table ───────────────────────────
-- Every admin view / download of a proof document is logged here.
-- Supports DPA 2012 access audit trail requirement.
CREATE TABLE IF NOT EXISTS proof_doc_access_log (
  id          BIGSERIAL PRIMARY KEY,
  case_id     UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  admin_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_url     TEXT        NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT
);

CREATE INDEX IF NOT EXISTS idx_proof_doc_access_case   ON proof_doc_access_log(case_id);
CREATE INDEX IF NOT EXISTS idx_proof_doc_access_admin  ON proof_doc_access_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_proof_doc_access_time   ON proof_doc_access_log(accessed_at DESC);

-- ── 10. Performance indexes ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cases_trust_level  ON cases(trust_level);
CREATE INDEX IF NOT EXISTS idx_cases_claimed_by   ON cases(claimed_by);
CREATE INDEX IF NOT EXISTS idx_cases_is_minor     ON cases(is_minor);
CREATE INDEX IF NOT EXISTS idx_cases_consent      ON cases(consent_given);

-- ── 11. Rebuild cases_with_coords view ──────────────────────
-- DROP first: CREATE OR REPLACE cannot reorder existing columns.
-- Column order must exactly match the previous migration
-- (add_missing_columns_and_rebuild_view.sql); new columns appended last.
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
  b.name                                              AS barangay_name,
  c.location_text,
  c.incident_date,
  c.incident_time,
  CASE
    WHEN c.location_coords IS NOT NULL
    THEN ST_AsGeoJSON(c.location_coords)::json
    ELSE NULL
  END                                                 AS coords_geojson,
  (
    SELECT cp.url
    FROM   case_photos cp
    WHERE  cp.case_id = c.id
      AND  cp.is_primary = TRUE
    LIMIT  1
  )                                                   AS primary_photo_url,
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
  c.updated_at,
  /* ── New columns appended after updated_at ── */
  c.proof_documents,
  c.source_link,
  c.trust_level,
  c.claimed_by,
  c.claimed_at,
  c.consent_given,
  c.consent_at,
  c.is_minor,
  c.review_completed_at
FROM cases      c
JOIN barangays  b ON b.id = c.barangay_id;

-- ── 12. Auto-set is_minor on insert / update ─────────────────
CREATE OR REPLACE FUNCTION auto_set_is_minor()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.is_minor := (
    (NEW.age_approx    IS NOT NULL AND NEW.age_approx    < 18) OR
    (NEW.age_range_max IS NOT NULL AND NEW.age_range_max < 18)
  );
  -- If the person is a minor, force photo_hidden = TRUE.
  IF NEW.is_minor THEN
    NEW.photo_hidden := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_is_minor ON cases;
CREATE TRIGGER trg_auto_set_is_minor
  BEFORE INSERT OR UPDATE OF age_approx, age_range_max
  ON cases
  FOR EACH ROW EXECUTE FUNCTION auto_set_is_minor();

-- ── 13. RLS policies for proof_doc_access_log ───────────────
ALTER TABLE proof_doc_access_log ENABLE ROW LEVEL SECURITY;

-- Only authenticated admin users can read logs (enforced in backend via requireAuth).
-- Supabase service role bypasses RLS — backend uses service role key.
