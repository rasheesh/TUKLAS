-- =============================================================
-- TUKLAS — Reference Queries
-- Common operations for the backend API layer
-- =============================================================


-- -------------------------------------------------------------
-- CASES — Public browse (verified only)
-- -------------------------------------------------------------

-- List all verified cases with barangay name (for Browse page)
SELECT
  c.id,
  c.type,
  c.status,
  c.full_name,
  c.age_approx,
  c.age_range_min,
  c.age_range_max,
  c.gender,
  c.incident_date,
  b.name AS barangay,
  c.location_text,
  ST_Y(c.location_coords::geometry) AS lat,
  ST_X(c.location_coords::geometry) AS lng,
  (
    SELECT url FROM case_photos
    WHERE case_id = c.id AND is_primary = TRUE
    LIMIT 1
  ) AS photo_url
FROM cases c
JOIN barangays b ON b.id = c.barangay_id
WHERE c.status = 'VERIFIED'
ORDER BY c.incident_date DESC NULLS LAST;


-- -------------------------------------------------------------
-- CASES — Proximity matching (within N km)
-- -------------------------------------------------------------
-- Find UNIDENTIFIED cases within 5 km of a given MISSING case.
-- Replace $1 with the missing case's UUID.

SELECT
  u.id,
  u.full_name,
  u.age_approx,
  u.age_range_min,
  u.age_range_max,
  u.gender,
  u.description,
  b.name AS barangay,
  ST_Distance(
    m.location_coords,
    u.location_coords
  ) / 1000.0 AS distance_km
FROM cases m
JOIN cases u ON u.type = 'UNIDENTIFIED'
             AND u.status = 'VERIFIED'
             AND u.id != m.id
JOIN barangays b ON b.id = u.barangay_id
WHERE m.id = $1
  AND m.type = 'MISSING'
  AND ST_DWithin(
    m.location_coords,
    u.location_coords,
    5000          -- 5 000 metres = 5 km
  )
ORDER BY distance_km ASC;


-- -------------------------------------------------------------
-- CASES — Admin queue (pending submissions)
-- -------------------------------------------------------------

SELECT
  c.id,
  c.type,
  c.status,
  c.full_name,
  c.age_approx,
  c.age_range_min,
  c.age_range_max,
  c.gender,
  c.description,
  c.location_text,
  c.incident_date,
  c.reporter_name,
  c.reporter_contact,   -- admin-only field
  b.name AS barangay,
  c.created_at
FROM cases c
JOIN barangays b ON b.id = c.barangay_id
WHERE c.status = 'PENDING'
ORDER BY c.created_at ASC;   -- oldest first (FIFO review)


-- -------------------------------------------------------------
-- CASES — Approve (PENDING → VERIFIED)
-- -------------------------------------------------------------
-- Replace $1 with case UUID, $2 with admin profile UUID.

UPDATE cases
SET
  status      = 'VERIFIED',
  verified_by = $2,
  verified_at = NOW()
WHERE id = $1
  AND status  = 'PENDING';


-- -------------------------------------------------------------
-- CASES — Mark as Found / Identified
-- -------------------------------------------------------------
-- Replace $1 with case UUID, $2 with admin UUID,
-- $3 with resolution notes, $4 with identified name (nullable).

UPDATE cases
SET
  status           = CASE type WHEN 'MISSING' THEN 'FOUND' ELSE 'IDENTIFIED' END,
  resolved_at      = NOW(),
  resolved_by      = $2,
  resolution_notes = $3,
  identified_name  = $4
WHERE id = $1
  AND status = 'VERIFIED';


-- -------------------------------------------------------------
-- CASES — Insert new submission (from public report form)
-- -------------------------------------------------------------

INSERT INTO cases (
  type,
  full_name,
  nickname,
  age_approx,
  gender,
  description,
  barangay_id,
  location_text,
  incident_date,
  incident_time,
  location_coords,
  reporter_name,
  reporter_contact
) VALUES (
  $1,                                         -- case_type enum
  $2,                                         -- full_name (NULL for unidentified)
  $3,                                         -- nickname
  $4,                                         -- age_approx
  $5,                                         -- gender_type enum
  $6,                                         -- description
  (SELECT id FROM barangays WHERE name = $7), -- barangay lookup by name
  $8,                                         -- location_text
  $9,                                         -- incident_date
  $10,                                        -- incident_time
  ST_SetSRID(ST_MakePoint($11, $12), 4326),   -- lng, lat → GEOGRAPHY point
  $13,                                        -- reporter_name
  $14                                         -- reporter_contact
)
RETURNING id;


-- -------------------------------------------------------------
-- CASE MATCHES — Upsert a suggested match from matching engine
-- -------------------------------------------------------------

INSERT INTO case_matches (
  missing_case_id,
  unidentified_case_id,
  score,
  distance_km,
  match_reasons
) VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (missing_case_id, unidentified_case_id)
DO UPDATE SET
  score         = EXCLUDED.score,
  distance_km   = EXCLUDED.distance_km,
  match_reasons = EXCLUDED.match_reasons;


-- -------------------------------------------------------------
-- CASE MATCHES — Confirm a match
-- -------------------------------------------------------------

UPDATE case_matches
SET
  confirmed   = TRUE,
  dismissed   = FALSE,
  reviewed_by = $2,
  reviewed_at = NOW()
WHERE id = $1;

-- Resolve both linked cases in one transaction
UPDATE cases SET
  status      = 'FOUND',
  resolved_at = NOW(),
  resolved_by = $2
WHERE id = (SELECT missing_case_id FROM case_matches WHERE id = $1);

UPDATE cases SET
  status      = 'IDENTIFIED',
  resolved_at = NOW(),
  resolved_by = $2
WHERE id = (SELECT unidentified_case_id FROM case_matches WHERE id = $1);


-- -------------------------------------------------------------
-- AUDIT LOGS — Insert a manual log entry
-- -------------------------------------------------------------

INSERT INTO audit_logs (
  admin_id,
  action_type,
  target_id,
  target_type,
  description,
  ip_address
) VALUES ($1, $2, $3, $4, $5, $6::INET);


-- -------------------------------------------------------------
-- AUDIT LOGS — Paginated read (admin dashboard)
-- -------------------------------------------------------------

SELECT
  al.id,
  al.created_at,
  p.full_name  AS user_name,
  p.email      AS user_email,
  al.action_type,
  al.target_id,
  al.target_type,
  al.description,
  al.ip_address
FROM audit_logs al
LEFT JOIN profiles p ON p.id = al.admin_id
ORDER BY al.created_at DESC
LIMIT $1 OFFSET $2;


-- -------------------------------------------------------------
-- PROFILES — List all staff (admin user management)
-- -------------------------------------------------------------

SELECT
  id,
  email,
  full_name,
  role,
  status,
  created_at
FROM profiles
ORDER BY
  CASE role
    WHEN 'SUPER_ADMIN'  THEN 1
    WHEN 'SYSTEM_OWNER' THEN 2
    WHEN 'ADMIN'        THEN 3
    WHEN 'MODERATOR'    THEN 4
  END,
  full_name ASC;


-- -------------------------------------------------------------
-- BARANGAYS — Full list for dropdowns
-- -------------------------------------------------------------

SELECT id, name, district
FROM barangays
ORDER BY name ASC;
