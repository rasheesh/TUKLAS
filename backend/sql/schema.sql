-- =============================================================
-- TUKLAS — PostgreSQL Schema
-- Baguio City Missing Persons Information System
-- =============================================================
-- Requirements:
--   PostgreSQL 14+
--   PostGIS extension (for GEOGRAPHY columns and GIST indexes)
--   pgcrypto extension (for gen_random_uuid())
--
-- Run order:
--   1. Enable extensions
--   2. Create enums
--   3. Create tables
--   4. Create indexes
--   5. Enable RLS + policies
--   6. Create triggers
-- =============================================================


-- -------------------------------------------------------------
-- 0. EXTENSIONS
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- -------------------------------------------------------------
-- 1. ENUMS
-- -------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',    -- full system access, manages all profiles
  'SYSTEM_OWNER',   -- can create/update ADMIN and MODERATOR accounts
  'ADMIN',          -- can insert, update, delete cases
  'MODERATOR'       -- can select and update cases only
);

CREATE TYPE user_status AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

CREATE TYPE case_type AS ENUM (
  'MISSING',
  'UNIDENTIFIED'
);

CREATE TYPE case_status AS ENUM (
  'PENDING',      -- submitted, awaiting admin review
  'VERIFIED',     -- approved and published to public
  'FOUND',        -- missing person has been located
  'IDENTIFIED'    -- unidentified person has been identified
);

CREATE TYPE gender_type AS ENUM (
  'MALE',
  'FEMALE',
  'UNKNOWN'
);

CREATE TYPE log_action AS ENUM (
  'LOGIN',
  'LOGOUT',
  'CASE_CREATED',
  'CASE_APPROVED',
  'CASE_REJECTED',
  'CASE_UPDATED',
  'CASE_DELETED',
  'CASE_STATUS_CHANGED',
  'MATCH_CONFIRMED',
  'MATCH_DISMISSED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'USER_DELETED'
);


-- -------------------------------------------------------------
-- 2. TABLES
-- -------------------------------------------------------------

-- ── barangays ─────────────────────────────────────────────────
-- Normalized lookup table — avoids repeating string names
-- in every case record and keeps barangay data consistent.
CREATE TABLE barangays (
  id       SERIAL       PRIMARY KEY,
  name     VARCHAR(120) NOT NULL,
  district VARCHAR(80),                    -- optional grouping (e.g. "Central", "South")

  CONSTRAINT barangays_name_unique UNIQUE (name)
);

COMMENT ON TABLE  barangays         IS 'Normalized lookup of all 128 Baguio City barangays.';
COMMENT ON COLUMN barangays.name    IS 'Official COMELEC barangay name.';
COMMENT ON COLUMN barangays.district IS 'Optional district grouping for analytics.';


-- ── profiles ──────────────────────────────────────────────────
-- Admin/staff accounts only. Public reporters are anonymous
-- (identified only by contact info stored on the case).
CREATE TABLE profiles (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(254) NOT NULL,
  full_name    VARCHAR(200) NOT NULL,
  role         user_role    NOT NULL DEFAULT 'MODERATOR',
  status       user_status  NOT NULL DEFAULT 'ACTIVE',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT profiles_email_unique UNIQUE (email),
  CONSTRAINT profiles_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

COMMENT ON TABLE  profiles            IS 'Admin and staff accounts for the TUKLAS portal.';
COMMENT ON COLUMN profiles.role       IS 'RBAC role — controls what actions this user may perform.';
COMMENT ON COLUMN profiles.status     IS 'INACTIVE accounts cannot log in.';


-- ── cases ─────────────────────────────────────────────────────
CREATE TABLE cases (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type             case_type    NOT NULL,
  status           case_status  NOT NULL DEFAULT 'PENDING',

  -- Identity fields (nullable for UNIDENTIFIED cases)
  full_name        VARCHAR(200),
  nickname         VARCHAR(100),
  age_approx       SMALLINT     CHECK (age_approx >= 0 AND age_approx <= 130),
  age_range_min    SMALLINT     CHECK (age_range_min >= 0),
  age_range_max    SMALLINT     CHECK (age_range_max >= 0),
  gender           gender_type  NOT NULL DEFAULT 'UNKNOWN',
  description      TEXT,                  -- physical description (free text)

  -- Incident details
  barangay_id      INTEGER      NOT NULL REFERENCES barangays(id) ON DELETE RESTRICT,
  location_text    VARCHAR(300),          -- specific landmark / address
  incident_date    DATE,
  incident_time    TIME,

  -- Geospatial — WGS84 point (lng, lat)
  -- GEOGRAPHY type stores in meters, enabling accurate distance queries
  location_coords  GEOGRAPHY(POINT, 4326),

  -- Reporter info (kept private — admin-only visibility)
  reporter_name    VARCHAR(200),
  reporter_contact VARCHAR(200),

  -- Resolution fields (populated when status → FOUND or IDENTIFIED)
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  identified_name  VARCHAR(200), -- for UNIDENTIFIED cases only

  -- Audit trail
  reported_by      UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  verified_by      UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Ensure age range is logically valid when provided
  CONSTRAINT age_range_order CHECK (
    age_range_min IS NULL OR age_range_max IS NULL OR age_range_min <= age_range_max
  ),
  -- FOUND status only valid for MISSING cases
  CONSTRAINT found_only_for_missing CHECK (
    status != 'FOUND' OR type = 'MISSING'
  ),
  -- IDENTIFIED status only valid for UNIDENTIFIED cases
  CONSTRAINT identified_only_for_unidentified CHECK (
    status != 'IDENTIFIED' OR type = 'UNIDENTIFIED'
  )
);

COMMENT ON TABLE  cases                  IS 'Core case records for missing and unidentified persons.';
COMMENT ON COLUMN cases.location_coords  IS 'PostGIS GEOGRAPHY point (SRID 4326). Used for proximity matching and map pins.';
COMMENT ON COLUMN cases.description      IS 'Free-text physical description — primary field for semantic/vector matching.';
COMMENT ON COLUMN cases.reporter_contact IS 'Private — visible to ADMIN and above only, never exposed publicly.';
COMMENT ON COLUMN cases.age_approx       IS 'Single known age. Use age_range_min/max when only a range is known.';


-- ── case_photos ───────────────────────────────────────────────
-- Separate table so a case can have multiple photos without
-- denormalizing the cases row.
CREATE TABLE case_photos (
  id         BIGSERIAL    PRIMARY KEY,
  case_id    UUID         NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  url        TEXT         NOT NULL,        -- storage URL (e.g. Supabase Storage / S3)
  is_primary BOOLEAN      NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE case_photos IS 'One-to-many photos per case. is_primary marks the thumbnail shown in listings.';


-- ── case_matches ──────────────────────────────────────────────
-- Stores suggested or confirmed matches between a MISSING case
-- and an UNIDENTIFIED case. Populated by the matching engine.
CREATE TABLE case_matches (
  id               BIGSERIAL    PRIMARY KEY,
  missing_case_id  UUID         NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  unidentified_case_id UUID     NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  score            SMALLINT     NOT NULL CHECK (score >= 0 AND score <= 100),
  distance_km      NUMERIC(6,2),          -- haversine distance between the two cases
  match_reasons    TEXT[],                -- array of reason strings from matching engine
  confirmed        BOOLEAN      NOT NULL DEFAULT FALSE,
  dismissed        BOOLEAN      NOT NULL DEFAULT FALSE,
  reviewed_by      UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT case_matches_no_self_match CHECK (missing_case_id != unidentified_case_id),
  CONSTRAINT case_matches_unique_pair   UNIQUE (missing_case_id, unidentified_case_id)
);

COMMENT ON TABLE  case_matches        IS 'Suggested and confirmed matches between MISSING and UNIDENTIFIED cases.';
COMMENT ON COLUMN case_matches.score  IS 'Similarity score 0–100 from the matching engine (TF-IDF / vector similarity).';


-- ── audit_logs ────────────────────────────────────────────────
-- Append-only. No UPDATE or DELETE is permitted on this table
-- (enforced via RLS policy below).
CREATE TABLE audit_logs (
  id          BIGSERIAL    PRIMARY KEY,
  admin_id    UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  action_type log_action   NOT NULL,
  target_id   TEXT,                        -- UUID or other identifier of the affected record
  target_type VARCHAR(50),                 -- e.g. 'case', 'profile', 'match'
  description TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  audit_logs             IS 'Immutable append-only audit trail. RLS prevents UPDATE and DELETE.';
COMMENT ON COLUMN audit_logs.target_id   IS 'UUID (as text) of the record that was acted upon.';
COMMENT ON COLUMN audit_logs.ip_address  IS 'Client IP at time of action for security auditing.';


-- -------------------------------------------------------------
-- 3. INDEXES
-- -------------------------------------------------------------

-- B-Tree indexes for the most common filter/search columns
CREATE INDEX idx_cases_status       ON cases (status);
CREATE INDEX idx_cases_type         ON cases (type);
CREATE INDEX idx_cases_barangay     ON cases (barangay_id);
CREATE INDEX idx_cases_gender       ON cases (gender);
CREATE INDEX idx_cases_created_at   ON cases (created_at DESC);
CREATE INDEX idx_cases_incident_date ON cases (incident_date DESC);

-- Partial index — pending cases are queried most frequently by admins
CREATE INDEX idx_cases_pending      ON cases (created_at DESC)
  WHERE status = 'PENDING';

-- Partial index — active (verified but not resolved) cases for public browse
CREATE INDEX idx_cases_verified_active ON cases (barangay_id, type, gender)
  WHERE status = 'VERIFIED';

-- B-Tree on profiles for login lookup
CREATE INDEX idx_profiles_email     ON profiles (email);
CREATE INDEX idx_profiles_role      ON profiles (role);

-- GIST index on PostGIS geography column
-- Required for ST_DWithin proximity queries (case matching, map clustering)
CREATE INDEX idx_cases_location_gist ON cases USING GIST (location_coords);

-- Audit log lookup by admin and time
CREATE INDEX idx_audit_logs_admin_id   ON audit_logs (admin_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_action     ON audit_logs (action_type);

-- Case photos lookup
CREATE INDEX idx_case_photos_case_id ON case_photos (case_id);

-- Case matches lookup by either side
CREATE INDEX idx_case_matches_missing      ON case_matches (missing_case_id);
CREATE INDEX idx_case_matches_unidentified ON case_matches (unidentified_case_id);
CREATE INDEX idx_case_matches_score        ON case_matches (score DESC)
  WHERE confirmed = FALSE AND dismissed = FALSE;


-- -------------------------------------------------------------
-- 4. UPDATED_AT TRIGGER FUNCTION
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -------------------------------------------------------------
-- 5. AUDIT LOG TRIGGER — auto-record case status changes
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_fn_log_case_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (
      admin_id,
      action_type,
      target_id,
      target_type,
      description
    ) VALUES (
      NEW.verified_by,                          -- the admin who made the change
      'CASE_STATUS_CHANGED',
      NEW.id::TEXT,
      'case',
      format(
        'Case "%s" status changed from %s to %s',
        COALESCE(NEW.full_name, 'Unknown'),
        OLD.status::TEXT,
        NEW.status::TEXT
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cases_status_audit
  AFTER UPDATE OF status ON cases
  FOR EACH ROW EXECUTE FUNCTION trg_fn_log_case_status_change();


-- -------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- -------------------------------------------------------------
-- Pattern: application sets a session variable with the
-- authenticated user's role before executing queries.
--
--   SET LOCAL app.current_role = 'MODERATOR';
--   SET LOCAL app.current_user_id = '<uuid>';
--
-- In production this is handled by the auth middleware
-- (e.g. Supabase Auth, custom JWT middleware).
-- -------------------------------------------------------------

ALTER TABLE cases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_matches ENABLE ROW LEVEL SECURITY;


-- ── Helper function — current role from session variable ──────
CREATE OR REPLACE FUNCTION current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_role', TRUE), '')
$$;

CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
$$;


-- ── cases policies ────────────────────────────────────────────

-- MODERATOR: read all verified cases + pending cases
CREATE POLICY moderator_select_cases ON cases
  FOR SELECT
  USING (
    current_app_role() IN ('MODERATOR', 'ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  );

-- MODERATOR: can update cases (e.g. flag, add notes) but NOT delete
CREATE POLICY moderator_update_cases ON cases
  FOR UPDATE
  USING (
    current_app_role() IN ('MODERATOR', 'ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  )
  WITH CHECK (
    current_app_role() IN ('MODERATOR', 'ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  );

-- ADMIN and above: can insert new verified cases
CREATE POLICY admin_insert_cases ON cases
  FOR INSERT
  WITH CHECK (
    current_app_role() IN ('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  );

-- ADMIN and above: can delete cases (e.g. spam/duplicate removal)
CREATE POLICY admin_delete_cases ON cases
  FOR DELETE
  USING (
    current_app_role() IN ('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  );


-- ── profiles policies ─────────────────────────────────────────

-- All authenticated roles can read profiles (for display names, etc.)
CREATE POLICY all_select_profiles ON profiles
  FOR SELECT
  USING (
    current_app_role() IN ('MODERATOR', 'ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  );

-- SYSTEM_OWNER: can create MODERATOR and ADMIN accounts only
CREATE POLICY system_owner_insert_profiles ON profiles
  FOR INSERT
  WITH CHECK (
    current_app_role() IN ('SYSTEM_OWNER', 'SUPER_ADMIN')
    AND role IN ('MODERATOR', 'ADMIN')
  );

-- SYSTEM_OWNER: can update MODERATOR and ADMIN accounts only
CREATE POLICY system_owner_update_profiles ON profiles
  FOR UPDATE
  USING (
    current_app_role() IN ('SYSTEM_OWNER', 'SUPER_ADMIN')
    AND role IN ('MODERATOR', 'ADMIN')
  )
  WITH CHECK (
    role IN ('MODERATOR', 'ADMIN')
  );

-- SUPER_ADMIN: unrestricted profile management
CREATE POLICY super_admin_all_profiles ON profiles
  FOR ALL
  USING (current_app_role() = 'SUPER_ADMIN')
  WITH CHECK (current_app_role() = 'SUPER_ADMIN');


-- ── audit_logs policies ───────────────────────────────────────

-- All authenticated roles can read audit logs
CREATE POLICY all_select_audit_logs ON audit_logs
  FOR SELECT
  USING (
    current_app_role() IN ('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  );

-- Any authenticated role can INSERT (the trigger also inserts)
CREATE POLICY all_insert_audit_logs ON audit_logs
  FOR INSERT
  WITH CHECK (
    current_app_role() IN ('MODERATOR', 'ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  );

-- NO UPDATE policy — audit logs are immutable
-- NO DELETE policy — audit logs are immutable


-- ── case_matches policies ─────────────────────────────────────

CREATE POLICY all_select_matches ON case_matches
  FOR SELECT
  USING (
    current_app_role() IN ('MODERATOR', 'ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  );

CREATE POLICY admin_manage_matches ON case_matches
  FOR ALL
  USING (
    current_app_role() IN ('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  )
  WITH CHECK (
    current_app_role() IN ('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN')
  );
