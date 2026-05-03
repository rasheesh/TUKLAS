-- =============================================================
-- Migration: add_case_reference
-- Adds a unique, human-readable reference number to each case.
-- Format: TKL-YYYY-NNNNN  (e.g. TKL-2026-00001)
-- =============================================================

-- 1. Sequence for the numeric part (global, never resets)
CREATE SEQUENCE IF NOT EXISTS case_reference_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- 2. Add the column (nullable first so existing rows don't fail)
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS case_reference VARCHAR(20) UNIQUE;

-- 3. Back-fill existing rows with a reference
UPDATE cases
SET case_reference = 'TKL-' || TO_CHAR(EXTRACT(YEAR FROM created_at)::INT, 'FM9999')
                   || '-' || LPAD(nextval('case_reference_seq')::TEXT, 5, '0')
WHERE case_reference IS NULL;

-- 4. Default for new rows — auto-generated on INSERT
ALTER TABLE cases
  ALTER COLUMN case_reference
  SET DEFAULT 'TKL-' || TO_CHAR(EXTRACT(YEAR FROM NOW())::INT, 'FM9999')
              || '-' || LPAD(nextval('case_reference_seq')::TEXT, 5, '0');

-- 5. Index for fast lookup by reference
CREATE INDEX IF NOT EXISTS idx_cases_reference ON cases (case_reference);
