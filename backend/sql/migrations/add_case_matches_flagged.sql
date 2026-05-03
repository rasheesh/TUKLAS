-- =============================================================
-- Migration: add_case_matches_flagged
-- Adds a flagged column to case_matches for "needs second opinion"
-- Run this in Supabase Dashboard → SQL Editor.
-- =============================================================

ALTER TABLE case_matches
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN case_matches.flagged IS
  'TRUE when an admin has flagged this match for a second opinion before confirming or dismissing.';

CREATE INDEX IF NOT EXISTS idx_case_matches_flagged
  ON case_matches (flagged)
  WHERE flagged = TRUE;
