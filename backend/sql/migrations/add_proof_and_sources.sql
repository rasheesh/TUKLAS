-- =============================================================
-- Migration: add_proof_and_sources
--
-- Run this in Supabase Dashboard → SQL Editor.
--
-- Adds report-verification support:
--   1. proof_documents  — uploaded supporting files (police report,
--                          barangay cert, news clipping, ID, etc.)
--   2. source_links     — external verification URLs (Facebook,
--                          news article, official police announcement)
--
-- Safe to run multiple times — uses IF NOT EXISTS / guarded DO blocks.
-- A public Storage bucket named 'case-proofs' must also be created
-- (Dashboard → Storage → New bucket) for document uploads.
-- =============================================================


-- ── 1. ENUMS ──────────────────────────────────────────────────
-- CREATE TYPE has no "IF NOT EXISTS", so guard with a DO block.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proof_document_type') THEN
    CREATE TYPE proof_document_type AS ENUM (
      'POLICE_REPORT',
      'BARANGAY_CERTIFICATION',
      'MISSING_PERSON_CERT',
      'NEWS_ARTICLE',
      'FACEBOOK_POST',
      'IDENTIFICATION',
      'SUPPORTING_DOC',
      'OTHER'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_link_type') THEN
    CREATE TYPE source_link_type AS ENUM (
      'FACEBOOK',
      'NEWS_ARTICLE',
      'POLICE_ANNOUNCEMENT',
      'OTHER'
    );
  END IF;
END$$;


-- ── 2. proof_documents ────────────────────────────────────────
-- One-to-many supporting files per case. Files live in the
-- 'case-proofs' Storage bucket; file_path is the bucket-relative key.
CREATE TABLE IF NOT EXISTS proof_documents (
  id               UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID                NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_type    proof_document_type NOT NULL DEFAULT 'OTHER',
  file_name        VARCHAR(255)        NOT NULL,
  file_path        VARCHAR(500)        NOT NULL,
  file_size        INTEGER             NOT NULL CHECK (file_size > 0),
  mime_type        VARCHAR(120),
  is_verified      BOOLEAN             NOT NULL DEFAULT FALSE,
  verified_by      UUID                REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at      TIMESTAMPTZ,
  rejection_reason VARCHAR(1000),
  created_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  proof_documents              IS 'Supporting proof files uploaded with a case report. Verified by admins before publication.';
COMMENT ON COLUMN proof_documents.file_path    IS 'Storage key relative to the case-proofs bucket.';
COMMENT ON COLUMN proof_documents.is_verified  IS 'TRUE once an admin has confirmed the document is legitimate.';

CREATE INDEX IF NOT EXISTS idx_proof_documents_case_id     ON proof_documents (case_id);
CREATE INDEX IF NOT EXISTS idx_proof_documents_is_verified ON proof_documents (is_verified);


-- ── 3. source_links ───────────────────────────────────────────
-- External verification URLs attached to a case.
CREATE TABLE IF NOT EXISTS source_links (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID             NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  url          VARCHAR(2000)    NOT NULL CHECK (url ~ '^https?://'),
  link_type    source_link_type NOT NULL DEFAULT 'OTHER',
  title        VARCHAR(300),
  verified     BOOLEAN          NOT NULL DEFAULT FALSE,
  verified_by  UUID             REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  source_links          IS 'External source URLs (Facebook, news, police announcement) used to verify a case.';
COMMENT ON COLUMN source_links.verified IS 'TRUE once an admin has confirmed the source is legitimate.';

CREATE INDEX IF NOT EXISTS idx_source_links_case_id  ON source_links (case_id);
CREATE INDEX IF NOT EXISTS idx_source_links_verified ON source_links (verified);


-- ── 4. ROW LEVEL SECURITY ─────────────────────────────────────
-- Mirrors the case_matches policy pattern in schema.sql:
--   read for all authenticated staff, full management for ADMIN+.
-- The service-role client used by the backend bypasses RLS, but
-- enabling it keeps the tables locked down for any direct access.

ALTER TABLE proof_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_links    ENABLE ROW LEVEL SECURITY;

-- proof_documents
DROP POLICY IF EXISTS all_select_proof_documents ON proof_documents;
CREATE POLICY all_select_proof_documents ON proof_documents
  FOR SELECT
  USING (current_app_role() IN ('MODERATOR', 'ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'));

DROP POLICY IF EXISTS admin_manage_proof_documents ON proof_documents;
CREATE POLICY admin_manage_proof_documents ON proof_documents
  FOR ALL
  USING (current_app_role() IN ('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'))
  WITH CHECK (current_app_role() IN ('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'));

-- source_links
DROP POLICY IF EXISTS all_select_source_links ON source_links;
CREATE POLICY all_select_source_links ON source_links
  FOR SELECT
  USING (current_app_role() IN ('MODERATOR', 'ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'));

DROP POLICY IF EXISTS admin_manage_source_links ON source_links;
CREATE POLICY admin_manage_source_links ON source_links
  FOR ALL
  USING (current_app_role() IN ('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'))
  WITH CHECK (current_app_role() IN ('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'));
