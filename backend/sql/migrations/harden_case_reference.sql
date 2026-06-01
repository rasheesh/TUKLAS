-- =============================================================
-- Migration: harden_case_reference
--
-- Run this in Supabase Dashboard → SQL Editor.
--
-- Makes the human-readable reference number (TKL-YYYY-NNNNN)
-- bullet-proof:
--   1. Guarantees the sequence, column, unique constraint,
--      default and index all exist.
--   2. Back-fills any rows still missing a reference.
--   3. RE-SYNCS the sequence to the highest number already in use.
--      This is the key fix: if rows were ever imported or the
--      sequence drifted behind the max used value, the next INSERT
--      would collide on the UNIQUE constraint and fail. Resyncing
--      removes that failure mode entirely.
--
-- Safe to run multiple times.
-- =============================================================

-- ── 1. Sequence + column + default + index (idempotent) ───────
CREATE SEQUENCE IF NOT EXISTS case_reference_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS case_reference VARCHAR(20);

-- UNIQUE constraint (guard: ADD CONSTRAINT has no IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_case_reference_key'
  ) THEN
    ALTER TABLE cases
      ADD CONSTRAINT cases_case_reference_key UNIQUE (case_reference);
  END IF;
END$$;

ALTER TABLE cases
  ALTER COLUMN case_reference
  SET DEFAULT 'TKL-' || TO_CHAR(EXTRACT(YEAR FROM NOW())::INT, 'FM9999')
              || '-' || LPAD(nextval('case_reference_seq')::TEXT, 5, '0');

CREATE INDEX IF NOT EXISTS idx_cases_reference ON cases (case_reference);

-- ── 2. Back-fill rows that have no reference yet ──────────────
UPDATE cases
SET case_reference = 'TKL-' || TO_CHAR(EXTRACT(YEAR FROM created_at)::INT, 'FM9999')
                   || '-' || LPAD(nextval('case_reference_seq')::TEXT, 5, '0')
WHERE case_reference IS NULL;

-- ── 3. Re-sync the sequence to the highest number in use ──────
-- Parses the numeric NNNNN suffix from every well-formed reference
-- and advances the sequence past the maximum, so the next INSERT
-- can never collide.
SELECT setval(
  'case_reference_seq',
  GREATEST(
    (
      SELECT COALESCE(MAX(split_part(case_reference, '-', 3)::BIGINT), 0)
      FROM cases
      WHERE case_reference ~ '^TKL-[0-9]{4}-[0-9]+$'
    ),
    1
  ),
  true   -- is_called = true → next nextval() returns max + 1
);

-- ── 4. Verification (optional — inspect the output) ───────────
--   Confirms: no NULLs, no duplicates, sequence ahead of max.
-- SELECT
--   COUNT(*)                                   AS total_cases,
--   COUNT(*) FILTER (WHERE case_reference IS NULL) AS missing_refs,
--   COUNT(*) - COUNT(DISTINCT case_reference)  AS duplicate_refs,
--   (SELECT last_value FROM case_reference_seq) AS seq_position
-- FROM cases;
