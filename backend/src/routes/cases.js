import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase.js';
import { pointToLatLng } from '../lib/geoTransform.js';
import { logAction } from '../lib/auditLogger.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/* ── Multer — memory storage with file size + MIME type guard ── */
/* Photos: images only. Documents: PDFs / Word docs / images (proof). */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  ...ALLOWED_MIME_TYPES,
  'application/pdf',
  /* Legacy .doc (application/msword) is intentionally excluded — it shares the
     CFB/OLE2 container with .msi installers and other executables. Use .docx. */
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/* Per-file size caps — must match the Supabase Storage bucket limits, or
   uploads pass app validation then get rejected by the bucket.
     case-photos bucket → 20 MB
     case-proofs bucket → 10 MB
   multer enforces the larger cap globally; documents are checked against the
   smaller cap explicitly in the POST handler. */
const PHOTO_MAX_BYTES = 20 * 1024 * 1024;   // 20 MB — case-photos bucket
const DOC_MAX_BYTES   = 10 * 1024 * 1024;   // 10 MB — case-proofs bucket

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES },   // global cap; documents further limited below
  fileFilter(_req, file, cb) {
    /* Photos must be images; documents may also be PDF/Word */
    const allowed = file.fieldname === 'documents'
      ? ALLOWED_DOCUMENT_MIME_TYPES
      : ALLOWED_MIME_TYPES;
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else if (file.fieldname === 'documents') {
      cb(new Error(`Invalid document type "${file.mimetype}". Accepted: PDF, Word (.docx), JPEG, PNG, WebP, GIF.`));
    } else {
      cb(new Error(`Invalid file type "${file.mimetype}". Only JPEG, PNG, WebP, and GIF images are accepted.`));
    }
  },
});

const BUCKET       = process.env.SUPABASE_STORAGE_BUCKET || 'case-photos';
const PROOF_BUCKET = process.env.SUPABASE_PROOF_BUCKET   || 'case-proofs';

/* ── Content-based file validation (anti-spoofing) ────────────
   Client-declared MIME types come from the request headers and are
   trivially spoofable, so we sniff the real file content by its magic
   bytes (file signature). This blocks executables / scripts renamed to
   look like an image or document.

   NOTE: signature checks cannot detect malware hidden *inside* a
   structurally-valid PDF or Office file (e.g. a macro or embedded
   payload). For that you need an antivirus pass — see SECURITY note in
   the POST /cases handler. Legacy Office (.doc/.xls — the CFB/OLE2
   container, which also covers .msi installers) is intentionally NOT
   accepted to shrink the attack surface; use PDF or modern .docx. */
function detectFileKind(buf) {
  if (!buf || buf.length < 12) return null;
  const at = (sig, offset = 0) => sig.every((byte, i) => buf[offset + i] === byte);

  /* Images */
  if (at([0xFF, 0xD8, 0xFF])) return 'jpg';
  if (at([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'png';
  if (at([0x47, 0x49, 0x46, 0x38])) return 'gif';                       // GIF8
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return 'webp';  // RIFF…WEBP
  /* Documents */
  if (at([0x25, 0x50, 0x44, 0x46, 0x2D])) return 'pdf';                 // %PDF-
  if (at([0x50, 0x4B, 0x03, 0x04]) || at([0x50, 0x4B, 0x05, 0x06]) || at([0x50, 0x4B, 0x07, 0x08])) {
    return 'zip';                                                       // .docx (OOXML is a zip)
  }
  return null;
}

const PHOTO_KINDS = new Set(['jpg', 'png', 'gif', 'webp']);
const DOC_KINDS   = new Set(['jpg', 'png', 'gif', 'webp', 'pdf', 'zip']);

/* Canonical content-type for a verified image kind — used when storing
   photos so the public bucket never serves attacker-controlled types. */
const IMAGE_KIND_MIME = {
  jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
};

/* Allowed enum values — mirror add_proof_and_sources.sql */
const PROOF_DOCUMENT_TYPES = new Set([
  'POLICE_REPORT', 'BARANGAY_CERTIFICATION', 'MISSING_PERSON_CERT',
  'NEWS_ARTICLE', 'FACEBOOK_POST', 'IDENTIFICATION', 'SUPPORTING_DOC', 'OTHER',
]);
const SOURCE_LINK_TYPES = new Set([
  'FACEBOOK', 'NEWS_ARTICLE', 'POLICE_ANNOUNCEMENT', 'OTHER',
]);

/** True for a valid http(s) URL. */
function isValidUrl(str) {
  try {
    const u = new URL(String(str));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** True when an error indicates a missing table/relation (un-migrated DB). */
function isMissingRelationError(err) {
  return err && (
    err.code === '42P01' ||                                  // undefined_table
    (err.message && err.message.toLowerCase().includes('does not exist'))
  );
}

/* ── Field length limits ─────────────────────────────────── */
const LIMITS = {
  full_name:        200,
  nickname:         100,
  description:      2000,
  location_text:    300,
  reporter_name:    200,
  reporter_contact: 50,
  barangay_name:    120,
};

/**
 * Truncates a string to maxLen characters and trims whitespace.
 * Returns null if the value is falsy.
 */
function sanitizeText(value, maxLen) {
  if (!value) return null;
  return String(value).trim().slice(0, maxLen) || null;
}

/* ── Select fragments ────────────────────────────────────── */
/*
 * Column availability depends on which migrations have been run:
 *
 *   CORE_SELECT      — columns that exist in the original schema view.
 *                      Always safe to query.
 *
 *   +height_ft       — added by add_height_ft.sql
 *   +case_reference  — added by add_case_reference.sql
 *   +published,
 *   +photo_hidden,
 *   +resolution_*    — added by add_published_photo_hidden.sql
 *                      (also rebuilds the view to include height_ft
 *                       and case_reference)
 *
 * safeFetchCases() tries the richest select first and falls back
 * through progressively simpler ones until a query succeeds.
 * The definitive fix is to run add_missing_columns_and_rebuild_view.sql
 * which adds all columns and rebuilds the view in one shot.
 */

/* Columns present in the original schema view — always safe */
const CORE_SELECT = `
  id, type, status,
  full_name, nickname, age_approx, age_range_min, age_range_max,
  gender, description,
  barangay_id, barangay_name, location_text, incident_date,
  coords_geojson, primary_photo_url,
  reporter_name, reporter_contact,
  created_at
`;

/* Full select after all migrations have been run */
const FULL_ADMIN_SELECT = CORE_SELECT + `,
  case_reference, height_ft,
  resolution_notes, identified_name, resolved_at,
  published, photo_hidden,
  verified_by, verified_at
`;

/* Public select — same as full admin minus verified_by/verified_at */
const FULL_PUBLIC_SELECT = CORE_SELECT + `,
  case_reference, height_ft,
  resolution_notes, identified_name, resolved_at,
  published, photo_hidden
`;

/* Intermediate: height_ft + case_reference but no published/photo_hidden */
const MID_SELECT = CORE_SELECT + `, case_reference, height_ft`;

/* Backward-compat aliases used by the rest of the file */
const BASE_CASE_SELECT   = CORE_SELECT;
const PUBLIC_CASE_SELECT = FULL_PUBLIC_SELECT;
const ADMIN_CASE_SELECT  = FULL_ADMIN_SELECT;

/* ── Format helpers ──────────────────────────────────────── */

/* Public: hides photo when photo_hidden is true */
function formatCase(c) {
  return {
    ...c,
    coords:    pointToLatLng(c.coords_geojson),
    photo_url: (c.photo_hidden ? null : c.primary_photo_url) ?? null,
    coords_geojson:    undefined,
    primary_photo_url: undefined,
  };
}

/* Admin: always returns the real photo */
function formatCaseAdmin(c) {
  return {
    ...c,
    coords:    pointToLatLng(c.coords_geojson),
    photo_url: c.primary_photo_url ?? null,
    coords_geojson:    undefined,
    primary_photo_url: undefined,
  };
}

/* ── safeFetchCases ──────────────────────────────────────── */
/*
 * Tries the richest select first, then falls back through
 * progressively simpler column sets until one succeeds.
 * This keeps the app functional regardless of which migrations
 * have been run.
 *
 * Fallback ladder (admin):
 *   FULL_ADMIN_SELECT  → MID_SELECT → CORE_SELECT
 *
 * Fallback ladder (public):
 *   FULL_PUBLIC_SELECT → MID_SELECT → CORE_SELECT
 *
 * The caller passes (buildQuery, preferredSelect, fallbackSelect).
 * When preferredSelect fails with a column error we cascade down.
 */
function isColErr(err) {
  return err && (
    err.code === '42703' ||
    (err.message && err.message.toLowerCase().includes('column'))
  );
}

async function safeFetchCases(buildQuery, preferredSelect, _fallbackSelect) {
  /* Determine the full fallback ladder based on the preferred select */
  const isAdmin  = preferredSelect.includes('verified_by');
  const ladder   = isAdmin
    ? [FULL_ADMIN_SELECT,  MID_SELECT, CORE_SELECT]
    : [FULL_PUBLIC_SELECT, MID_SELECT, CORE_SELECT];

  /* Start from the preferred select (may already be a mid-level one) */
  const startIdx = ladder.indexOf(preferredSelect);
  const tries    = startIdx >= 0 ? ladder.slice(startIdx) : [preferredSelect, ...ladder];

  let lastError;
  for (const sel of tries) {
    const { data, error } = await buildQuery(sel);
    if (!error) return data;
    if (!isColErr(error)) throw error;   // non-column error — don't retry
    lastError = error;
    console.warn(`[cases] Column missing with select level — trying simpler select. (${error.message})`);
  }
  throw lastError;
}

/* ── Startup: verify migration columns exist ─────────────── */
async function checkMigrationColumns() {
  const { data, error } = await supabase
    .from('cases')
    .select('published, photo_hidden')
    .limit(1);

  if (error) {
    const isColErr = error.code === '42703'
      || (error.message && error.message.toLowerCase().includes('column'));
    if (isColErr) {
      console.warn(
        '\n⚠️  MIGRATION REQUIRED ⚠️\n' +
        '   The "published" and "photo_hidden" columns are missing from the cases table.\n' +
        '   Run: backend/sql/migrations/add_published_photo_hidden.sql in Supabase SQL Editor.\n' +
        '   Publish and Hide Photo features will use optimistic local state until then.\n'
      );
    } else {
      console.error('[startup] Column check failed:', error.message);
    }
  }
}
checkMigrationColumns();

/* ── GET /api/cases — public verified cases ─────────────── */
router.get('/', async (req, res) => {
  try {
    const { barangay_id, type, gender } = req.query;

    const data = await safeFetchCases(
      (sel) => {
        let q = supabase
          .from('cases_with_coords')
          .select(sel)
          .in('status', ['VERIFIED', 'FOUND', 'IDENTIFIED'])
          .order('incident_date', { ascending: false });
        /* Only filter by published when the column is in the select
           (i.e. the migration has been run) */
        if (sel.includes('published')) q = q.eq('published', true);
        if (barangay_id) q = q.eq('barangay_id', barangay_id);
        if (type)        q = q.eq('type', type.toUpperCase());
        if (gender)      q = q.eq('gender', gender.toUpperCase());
        return q;
      },
      FULL_PUBLIC_SELECT,
      CORE_SELECT
    );

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ cases: data.map(formatCase) });
  } catch (err) {
    console.error('[GET /cases]', err.message);
    res.status(500).json({ error: 'Failed to fetch cases.' });
  }
});

/* ── GET /api/cases/barangays — barangay lookup list ─────── */
router.get('/barangays', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('barangays')
      .select('id, name')
      .order('name');
    if (error) throw error;
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.json({ barangays: data });
  } catch (err) {
    console.error('[GET /cases/barangays]', err.message);
    res.status(500).json({ error: 'Failed to fetch barangays.' });
  }
});

/* ── GET /api/cases/track/:reference — public status lookup ──
   Lets a reporter check the status of THEIR report (including PENDING)
   using only the reference number printed on the success screen.
   Returns a sanitized, public-safe subset — never reporter contact info. */
router.get('/track/:reference', async (req, res) => {
  try {
    const reference = (req.params.reference || '').trim().toUpperCase();

    /* Format guard — TKL-YYYY-NNNNN. Reject obviously malformed input early. */
    if (!/^TKL-\d{4}-\d+$/.test(reference)) {
      return res.status(400).json({
        error: 'Invalid reference number. It should look like TKL-2026-00001.',
      });
    }

    const BASE_TRACK_SELECT =
      'case_reference, type, status, full_name, nickname, barangay_name, ' +
      'location_text, incident_date, created_at, verified_at, resolved_at, identified_name';
    /* rejection_reason requires add_rejection_reason.sql — fall back without
       it on un-migrated databases so tracking keeps working. */
    const FULL_TRACK_SELECT = BASE_TRACK_SELECT + ', rejection_reason, rejected_at';

    let { data, error } = await supabase
      .from('cases_with_coords')
      .select(FULL_TRACK_SELECT)
      .eq('case_reference', reference)
      .maybeSingle();

    if (error && isColErr(error)) {
      /* rejection_reason column missing — retry with the base columns */
      ({ data, error } = await supabase
        .from('cases_with_coords')
        .select(BASE_TRACK_SELECT)
        .eq('case_reference', reference)
        .maybeSingle());
    }

    if (error) {
      /* case_reference column not present yet (un-migrated DB) */
      if (isColErr(error)) {
        return res.status(503).json({
          error: 'Status tracking is not available yet. Please contact the team with your reference number.',
        });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        error: 'No report found with that reference number. Double-check the number on your confirmation screen.',
      });
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      report: {
        reference:       data.case_reference,
        type:            data.type,
        status:          data.status,
        full_name:       data.full_name ?? null,
        nickname:        data.nickname ?? null,
        barangay_name:   data.barangay_name ?? null,
        location_text:   data.location_text ?? null,
        incident_date:   data.incident_date ?? null,
        created_at:      data.created_at ?? null,
        verified_at:     data.verified_at ?? null,
        resolved_at:     data.resolved_at ?? null,
        identified_name: data.identified_name ?? null,
        rejection_reason: data.rejection_reason ?? null,
        rejected_at:      data.rejected_at ?? null,
      },
    });
  } catch (err) {
    console.error('[GET /cases/track/:reference]', err.message);
    res.status(500).json({ error: 'Failed to look up report status.' });
  }
});

/* ── POST /api/cases — submit new report (public) ────────── */
router.post('/', (req, res, next) => {
  upload.fields([
    { name: 'photos',    maxCount: 10 },
    { name: 'documents', maxCount: 10 },
  ])(req, res, (err) => {
    if (err) {
      /* Multer file-type rejection → return a clear 422 instead of a 500 */
      if (err.message && err.message.startsWith('Invalid document type')) {
        return res.status(422).json({
          error: 'Unsupported document format. Please upload PDF, Word (.doc/.docx), or image files.',
        });
      }
      if (err.message && err.message.startsWith('Invalid file type')) {
        return res.status(422).json({
          error: 'Unsupported photo format. Please upload JPG, PNG, WebP, or GIF images. ' +
                 'If you are on a Mac or iPhone, convert HEIC photos to JPG before uploading.',
        });
      }
      /* File too large */
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(422).json({ error: 'One or more files are too large. Photos must be 20 MB or less, and supporting documents 10 MB or less.' });
      }
      return next(err);
    }
    next();
  });
}, async (req, res) => {
  try {
    const {
      type, gender, barangay_name,
      first_name, last_name, nickname,
      age_approx, age_range_min, age_range_max,
      height_ft,
      description, location_text, incident_date, incident_time,
      lat, lng,
      reporter_first_name, reporter_last_name, reporter_contact,
    } = req.body;

    /* Required field validation */
    const missing = [];
    if (!type)          missing.push('type');
    if (!gender)        missing.push('gender');
    if (!barangay_name) missing.push('barangay_name');
    if (!incident_date) missing.push('incident_date');
    if (!location_text) missing.push('location_text');

    if (missing.length) {
      return res.status(422).json({ error: 'Missing required fields.', fields: missing });
    }

    /* ── Legal consent gate (Data Privacy Act of 2012 / RA 10173) ──
       Both acknowledgments are mandatory and enforced server-side so the
       consent can't be bypassed by calling the API directly. */
    if (req.body.data_privacy_consent !== 'true') {
      return res.status(422).json({
        error: 'Data privacy consent is required to submit a report (Data Privacy Act of 2012, RA 10173).',
      });
    }
    if (req.body.accuracy_declaration !== 'true') {
      return res.status(422).json({
        error: 'Please confirm that the information provided is true and submitted in good faith.',
      });
    }

    /* ── Supporting proof — REQUIRED at submission ──
       Parse source_links (JSON array string) defensively, then require
       at least one supporting document OR one source link. */
    const documentFiles = req.files?.documents ?? [];

    /* Documents go to the 10 MB case-proofs bucket. Reject oversized files up
       front with a clear error rather than letting the bucket silently drop
       them (which would create a case with no usable proof). */
    const oversizedDoc = documentFiles.find((f) => f.size > DOC_MAX_BYTES);
    if (oversizedDoc) {
      return res.status(422).json({
        error: `Supporting document "${oversizedDoc.originalname}" exceeds the 10 MB limit. Please upload a smaller file.`,
      });
    }

    /* ── SECURITY: verify real file content, not just the declared type ──
       Reject any photo/document whose magic bytes don't match a genuine
       image / PDF / .docx — this stops executables or scripts renamed to
       look like an allowed upload. (Does not scan for malware *inside* a
       valid PDF/Office file; add an antivirus pass if that threat matters.) */
    const photoFiles = req.files?.photos ?? [];
    for (const f of photoFiles) {
      const kind = detectFileKind(f.buffer);
      if (!kind || !PHOTO_KINDS.has(kind)) {
        return res.status(422).json({
          error: `The photo "${f.originalname}" doesn't appear to be a genuine image file and was rejected.`,
        });
      }
      f.detectedKind = kind;
    }
    for (const f of documentFiles) {
      const kind = detectFileKind(f.buffer);
      if (!kind || !DOC_KINDS.has(kind)) {
        return res.status(422).json({
          error: `The document "${f.originalname}" isn't a genuine PDF, Word (.docx), or image file and was rejected.`,
        });
      }
      f.detectedKind = kind;
    }

    let sourceLinks = [];
    if (req.body.source_links) {
      try {
        const parsed = JSON.parse(req.body.source_links);
        if (Array.isArray(parsed)) {
          sourceLinks = parsed
            .filter(l => l && isValidUrl(l.url))
            .map(l => ({
              url:       String(l.url).slice(0, 2000),
              link_type: SOURCE_LINK_TYPES.has(l.link_type) ? l.link_type : 'OTHER',
            }));
        }
      } catch {
        return res.status(422).json({ error: 'Invalid source_links format.' });
      }
    }

    if (documentFiles.length === 0 && sourceLinks.length === 0) {
      return res.status(422).json({
        error: 'At least one supporting document or source link is required to submit a report.',
      });
    }

    /* Normalize gender to DB enum: MALE | FEMALE | UNKNOWN */
    const rawGender = (gender ?? '').trim().toUpperCase();
    const normalizedGender =
      rawGender === 'MALE'   ? 'MALE'   :
      rawGender === 'FEMALE' ? 'FEMALE' : 'UNKNOWN';

    /* Resolve barangay_id from name — direct indexed DB query instead of fetching all */
    const trimmedName = (barangay_name ?? '').trim();
    const { data: barangayRows, error: bErr } = await supabase
      .from('barangays')
      .select('id, name')
      .ilike('name', trimmedName)
      .limit(1);

    if (bErr) {
      console.error('[POST /cases] Barangay fetch failed:', bErr.message);
      return res.status(500).json({ error: 'Database error: failed to resolve barangay. Please try again.' });
    }

    const barangay = barangayRows?.[0] ?? null;

    if (!barangay) {
      console.error('[POST /cases] Barangay not found:', trimmedName);
      return res.status(422).json({ error: `Invalid Barangay: "${trimmedName}" was not found in the database.` });
    }

    const coordsExpr = (lat && lng)
      ? `SRID=4326;POINT(${parseFloat(lng)} ${parseFloat(lat)})`
      : null;

    const fullName = sanitizeText(
      (first_name && last_name)
        ? `${first_name.trim()} ${last_name.trim()}`
        : (first_name?.trim() || last_name?.trim() || null),
      LIMITS.full_name
    );

    const reporterName = sanitizeText(
      (reporter_first_name && reporter_last_name)
        ? `${reporter_first_name.trim()} ${reporter_last_name.trim()}`
        : (reporter_first_name?.trim() || reporter_last_name?.trim() || null),
      LIMITS.reporter_name
    );

    /* Populate reported_by if the request comes from an authenticated user */
    let reportedBy = null;
    const cookieToken  = req.cookies?.tuklas_session;
    const bearerToken  = req.headers?.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7) : null;
    const sessionToken = cookieToken || bearerToken;
    if (sessionToken) {
      const { data: { user: authUser } } = await supabase.auth.getUser(sessionToken).catch(() => ({ data: { user: null } }));
      if (authUser) reportedBy = authUser.id;
    }

    /* Build the insert payload.
       height_ft requires the add_height_ft migration — omit it if not provided
       so a missing column doesn't break submissions on un-migrated databases. */
    const insertPayload = {
      type:             type.toUpperCase(),
      gender:           normalizedGender,
      barangay_id:      barangay.id,
      full_name:        fullName,
      nickname:         sanitizeText(nickname, LIMITS.nickname),
      age_approx:       age_approx ? parseInt(age_approx) : null,
      age_range_min:    age_range_min ? parseInt(age_range_min) : null,
      age_range_max:    age_range_max ? parseInt(age_range_max) : null,
      description:      sanitizeText(description, LIMITS.description),
      location_text:    sanitizeText(location_text, LIMITS.location_text),
      incident_date,
      incident_time:    incident_time || null,
      location_coords:  coordsExpr,
      reporter_name:    reporterName,
      reporter_contact: sanitizeText(reporter_contact, LIMITS.reporter_contact),
      reported_by:      reportedBy,
      status:           'PENDING',
    };
    /* Only include height_ft when a value was actually submitted */
    if (height_ft) insertPayload.height_ft = parseFloat(height_ft);

    /* ── Insert helper — retries with progressively simpler payloads/selects
       to stay functional when optional migration columns are missing. ── */
    async function tryInsert(payload, selectCols) {
      const { data, error } = await supabase
        .from('cases')
        .insert(payload)
        .select(selectCols)
        .single();
      return { data, error };
    }

    function isColumnError(err) {
      return err && (
        err.code === '42703' ||
        (err.message && err.message.toLowerCase().includes('column'))
      );
    }

    function handleNonColumnInsertError(err) {
      console.error('[POST /cases] Insert failed:', err.message, err.code);
      if (err.code === '23503') {
        return res.status(422).json({ error: 'Invalid Barangay ID — the selected barangay does not exist.' });
      }
      if (err.code === '23514') {
        return res.status(422).json({ error: 'Validation error: please check the submitted data (e.g. age range or gender).' });
      }
      if (err.code === '23505') {
        /* Reached only if the reference still collides after several retries —
           the sequence is badly out of sync. Run harden_case_reference.sql. */
        return res.status(409).json({
          error: 'Could not generate a unique reference number. Please try again in a moment.',
        });
      }
      if (err.code === 'PGRST301' || err.message?.includes('timeout')) {
        return res.status(503).json({ error: 'Database Connection Timeout — please try again in a moment.' });
      }
      return null; // caller should throw
    }

    /* True when the error is a unique-violation on the case_reference column. */
    function isReferenceCollision(err) {
      return err && err.code === '23505'
        && (err.message || '').toLowerCase().includes('case_reference');
    }

    /* Run one insert, cascading through column-fallback selects/payloads so a
       missing optional migration column doesn't break the submission. */
    async function insertCaseOnce(payload) {
      /* Attempt 1: full payload + case_reference in select */
      let { data, error } = await tryInsert(payload, 'id, case_reference');

      if (error && isColumnError(error)) {
        /* Attempt 2: case_reference column missing in select — try id only */
        console.warn('[POST /cases] case_reference column missing — run add_missing_columns_and_rebuild_view.sql. Falling back.');
        ({ data, error } = await tryInsert(payload, 'id'));
      }

      if (error && isColumnError(error)) {
        /* Attempt 3: height_ft column also missing in payload — strip it and retry */
        console.warn('[POST /cases] height_ft column missing — run add_missing_columns_and_rebuild_view.sql. Stripping height_ft.');
        const { height_ft: _dropped, ...payloadWithoutHeight } = payload;
        ({ data, error } = await tryInsert(payloadWithoutHeight, 'id'));
      }

      return { data, error };
    }

    let newCase;
    {
      let data, error;
      /* Retry on reference collision: the DB default advances the sequence on
         each attempt, so a retry gets the next number. Bounded to avoid loops. */
      for (let attempt = 0; attempt < 5; attempt++) {
        ({ data, error } = await insertCaseOnce(insertPayload));
        if (!isReferenceCollision(error)) break;
        console.warn(`[POST /cases] case_reference collision (attempt ${attempt + 1}) — retrying. Run harden_case_reference.sql to resync the sequence.`);
      }

      if (error) {
        const handled = handleNonColumnInsertError(error);
        if (handled) return handled;
        throw error;
      }

      newCase = data;
    }

    /* Upload photos — use the VERIFIED kind for both the file extension and
       the stored content-type so the public bucket never echoes an
       attacker-supplied filename/MIME. */
    const files = photoFiles;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext  = file.detectedKind ?? 'jpg';
      const contentType = IMAGE_KIND_MIME[file.detectedKind] ?? 'application/octet-stream';
      const path = `${newCase.id}/${Date.now()}-${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file.buffer, { contentType });

      if (uploadError) {
        console.error('[Photo upload]', uploadError.message);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

      await supabase.from('case_photos').insert({
        case_id:    newCase.id,
        url:        publicUrl,
        is_primary: i === 0,
      });
    }

    /* ── Upload supporting documents → case-proofs bucket + proof_documents ──
       Each step is wrapped so a missing bucket/table on an un-migrated DB
       logs a warning and continues rather than failing the whole submission. */
    for (let i = 0; i < documentFiles.length; i++) {
      const file = documentFiles[i];
      const docType = PROOF_DOCUMENT_TYPES.has(req.body[`document_type_${i}`])
        ? req.body[`document_type_${i}`]
        : 'OTHER';
      const safeName = (file.originalname || 'document').replace(/[^\w.\-]+/g, '_').slice(0, 255);
      const path = `${newCase.id}/${Date.now()}-${i}-${safeName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from(PROOF_BUCKET)
          .upload(path, file.buffer, { contentType: file.mimetype });
        if (uploadError) {
          console.warn('[Proof upload] storage failed (bucket may be missing):', uploadError.message);
          continue;
        }

        const { error: insertError } = await supabase.from('proof_documents').insert({
          case_id:       newCase.id,
          document_type: docType,
          file_name:     safeName,
          file_path:     path,
          file_size:     file.size,
          mime_type:     file.mimetype,
        });
        if (insertError) {
          console.warn('[Proof upload] proof_documents insert failed (run add_proof_and_sources.sql):', insertError.message);
        }
      } catch (e) {
        console.warn('[Proof upload] unexpected error — skipping document:', e.message);
      }
    }

    /* ── Persist source links → source_links ── */
    for (const link of sourceLinks) {
      try {
        const { error: linkError } = await supabase.from('source_links').insert({
          case_id:   newCase.id,
          url:       link.url,
          link_type: link.link_type,
        });
        if (linkError) {
          console.warn('[Source link] insert failed (run add_proof_and_sources.sql):', linkError.message);
        }
      } catch (e) {
        console.warn('[Source link] unexpected error — skipping link:', e.message);
      }
    }

    /* Use the DB-generated reference (TKL-YYYY-NNNNN from case_reference_seq).
       Fall back to UUID slice only if migration hasn't been run yet. */
    const year = new Date().getFullYear();
    const ref  = newCase.case_reference
      ?? `TKL-${year}-${newCase.id.slice(0, 5).toUpperCase()}`;

    /* Audit log — non-blocking */
    const caseLabel = fullName
      ? `"${fullName}"`
      : `${type.toUpperCase()} case`;
    logAction({
      adminId:     reportedBy,
      action:      'CASE_CREATED',
      targetId:    newCase.id,
      targetType:  'case',
      description: `New case report submitted for ${caseLabel} (ref: ${ref}).`,
      ipAddress:   req.ip,
    }).catch(err => console.error('[POST /cases] Audit log failed:', err.message));

    res.status(201).json({ id: newCase.id, reference: ref });
  } catch (err) {
    console.error('[POST /cases]', err.message);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

/* ── GET /api/admin/cases/pending — admin queue ──────────── */
router.get('/admin/pending', requireAuth, async (req, res) => {
  try {
    const data = await safeFetchCases(
      (sel) => supabase
        .from('cases_with_coords')
        .select(sel)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true }),
      FULL_ADMIN_SELECT,
      CORE_SELECT
    );
    res.json({ cases: data.map(formatCaseAdmin) });
  } catch (err) {
    console.error('[GET /admin/cases/pending]', err.message);
    res.status(500).json({ error: 'Failed to fetch pending cases.' });
  }
});

/* ── GET /api/admin/cases/verified — verified database ───── */
router.get('/admin/verified', requireAuth, async (req, res) => {
  try {
    const { type, status, gender, search } = req.query;

    const data = await safeFetchCases(
      (sel) => {
        let q = supabase
          .from('cases_with_coords')
          .select(sel)
          /* Verified database = approved/resolved cases only.
             PENDING are still in the queue; REJECTED are soft-deleted
             reports kept solely for reporter tracking. */
          .in('status', ['VERIFIED', 'FOUND', 'IDENTIFIED'])
          .order('created_at', { ascending: false });
        if (type)   q = q.eq('type', type.toUpperCase());
        if (status) q = q.eq('status', status.toUpperCase());
        if (gender) q = q.eq('gender', gender.toUpperCase());
        if (search) q = q.ilike('full_name', `%${search}%`);
        return q;
      },
      FULL_ADMIN_SELECT,
      CORE_SELECT
    );

    res.json({ cases: data.map(formatCaseAdmin) });
  } catch (err) {
    console.error('[GET /admin/cases/verified]', err.message);
    res.status(500).json({ error: 'Failed to fetch verified cases.' });
  }
});

/* ── PATCH /api/admin/cases/:id — approve / reject / resolve / publish / toggle-photo */
/* Publish and toggle-photo are available to all authenticated roles (including MODERATOR).
   Approve, reject, and resolve require ADMIN or above. */
router.patch('/admin/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, resolution, action } = req.body ?? {};

  /* Role check for destructive/status-change actions */
  const isPrivilegedAction = status === 'VERIFIED' || status === 'REJECTED'
    || status === 'FOUND' || status === 'IDENTIFIED';

  if (isPrivilegedAction) {
    const allowed = ['ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowed.join(' or ')}.`,
      });
    }
  }

  try {
    /* ── Publish ── */
    if (action === 'PUBLISH') {
      /* Publish gate — require at least one VERIFIED proof document or source link.
         If the proof tables are missing (un-migrated DB), fall back to allowing
         the publish rather than blocking every case. */
      try {
        const [{ count: verifiedDocs, error: docErr }, { count: verifiedLinks, error: linkErr }] =
          await Promise.all([
            supabase.from('proof_documents')
              .select('id', { count: 'exact', head: true })
              .eq('case_id', id).eq('is_verified', true),
            supabase.from('source_links')
              .select('id', { count: 'exact', head: true })
              .eq('case_id', id).eq('verified', true),
          ]);

        const tablesPresent = !isMissingRelationError(docErr) && !isMissingRelationError(linkErr);
        if (tablesPresent && (verifiedDocs ?? 0) === 0 && (verifiedLinks ?? 0) === 0) {
          return res.status(409).json({
            error: 'Cannot publish: this case has no verified supporting proof. ' +
                   'Verify at least one document or source link first.',
          });
        }
      } catch (gateErr) {
        console.warn('[PATCH publish] proof gate check skipped:', gateErr.message);
      }

      const { error: updateError } = await supabase
        .from('cases').update({ published: true }).eq('id', id);

      if (updateError) {
        /* Column doesn't exist yet — migration not run. Return optimistic success. */
        const isColErr = updateError.code === '42703'
          || (updateError.message && updateError.message.toLowerCase().includes('column'));
        if (isColErr) {
          console.warn('[PATCH publish] published column missing — run migration. Returning optimistic response.');
          return res.json({ case: { id, published: true } });
        }
        throw updateError;
      }

      const data = await safeFetchCases(
        (sel) => supabase.from('cases_with_coords').select(sel).eq('id', id).single(),
        FULL_ADMIN_SELECT, CORE_SELECT
      );
      await logAction({
        adminId: req.user.id, action: 'CASE_UPDATED', targetId: id, targetType: 'case',
        description: `Case "${data.full_name ?? id}" published to public by ${req.user.full_name}`,
        ipAddress: req.ip,
      });
      return res.json({ case: formatCaseAdmin(data) });
    }

    /* ── Toggle photo visibility ── */
    if (action === 'TOGGLE_PHOTO') {
      /* Read current photo_hidden value from the cases table */
      const { data: current, error: fetchErr } = await supabase
        .from('cases')
        .select('id, photo_hidden')
        .eq('id', id)
        .single();

      if (fetchErr) {
        console.error('[TOGGLE_PHOTO] fetch error:', fetchErr.code, fetchErr.message);
        const isColErr = fetchErr.code === '42703'
          || (fetchErr.message && fetchErr.message.toLowerCase().includes('column'));
        if (!isColErr) throw fetchErr;
        /*
         * Column missing — migration not yet run.
         * Use the client-supplied current state (req.body.currentPhotoHidden)
         * to compute the correct toggle so the button works both ways.
         * Falls back to false (visible) if the client didn't send it.
         */
        console.warn('[TOGGLE_PHOTO] photo_hidden column missing — run migration. Using client-supplied state for optimistic toggle.');
        const clientCurrent = req.body?.currentPhotoHidden === true;
        return res.json({ case: { id, photo_hidden: !clientCurrent } });
      }

      const currentHidden = current?.photo_hidden ?? false;
      const newHidden = !currentHidden;

      const { data: updated, error: updateError } = await supabase
        .from('cases')
        .update({ photo_hidden: newHidden })
        .eq('id', id)
        .select('id, photo_hidden')
        .single();

      if (updateError) {
        console.error('[TOGGLE_PHOTO] update error:', updateError.code, updateError.message);
        const isColErr = updateError.code === '42703'
          || (updateError.message && updateError.message.toLowerCase().includes('column'));
        if (isColErr) {
          console.warn('[TOGGLE_PHOTO] photo_hidden column missing — run migration.');
          return res.json({ case: { id, photo_hidden: newHidden } });
        }
        throw updateError;
      }

      /*
       * Return the photo_hidden value directly from the UPDATE result rather
       * than re-fetching from cases_with_coords. The view may not expose
       * photo_hidden if it was not rebuilt after the migration, which would
       * cause the response to return photo_hidden: undefined and break the
       * frontend toggle state.
       */
      const confirmedHidden = updated?.photo_hidden ?? newHidden;

      /* Fetch the rest of the case fields for the response, then override photo_hidden */
      const data = await safeFetchCases(
        (sel) => supabase.from('cases_with_coords').select(sel).eq('id', id).single(),
        ADMIN_CASE_SELECT, BASE_CASE_SELECT
      );
      return res.json({ case: { ...formatCaseAdmin(data), photo_hidden: confirmedHidden } });
    }

    /* ── Reject (soft delete — keep the record so the reporter can see why) ──
       The report is NOT deleted: it is marked REJECTED with a human-readable
       reason so the original reporter can read it on the public tracking page.
       Rejected cases are excluded from the public list and the verified
       database query, so they never surface anywhere except tracking. */
    if (status === 'REJECTED') {
      const reason = sanitizeText(req.body?.rejectionReason, 1000);

      const { data: updated, error } = await supabase
        .from('cases')
        .update({
          status:           'REJECTED',
          rejection_reason: reason,
          rejected_at:      new Date().toISOString(),
          rejected_by:      req.user.id,
        })
        .eq('id', id)
        .select('id, full_name');

      if (error) {
        /* Migration (add_rejection_reason.sql) not run yet: either the
           'REJECTED' enum value or the rejection_* columns are missing.
           Fall back to the old hard-delete so rejection still works — the
           reason just can't be stored until the migration is applied. */
        const enumMissing = error.code === '22P02'
          || (error.message && error.message.toLowerCase().includes('invalid input value for enum'));
        if (isColErr(error) || enumMissing) {
          console.warn('[PATCH reject] add_rejection_reason.sql not run — falling back to hard delete. Reason will not be stored.');
          const { data: deleted, error: delErr } = await supabase
            .from('cases')
            .delete()
            .eq('id', id)
            .select('id, full_name');
          if (delErr) throw delErr;
          if (!deleted || deleted.length === 0) {
            return res.status(404).json({ error: 'Case not found — it may have already been removed.' });
          }
          await logAction({
            adminId: req.user.id, action: 'CASE_REJECTED', targetId: id, targetType: 'case',
            description: `Case "${deleted[0].full_name ?? id}" rejected and deleted by ${req.user.full_name}`,
            ipAddress: req.ip,
          });
          return res.json({ message: 'Case rejected and removed.', id });
        }
        throw error;
      }

      if (!updated || updated.length === 0) {
        return res.status(404).json({ error: 'Case not found — it may have already been removed.' });
      }

      await logAction({
        adminId: req.user.id, action: 'CASE_REJECTED', targetId: id, targetType: 'case',
        description: `Case "${updated[0].full_name ?? id}" rejected by ${req.user.full_name}`
          + (reason ? ` — reason: ${reason}` : ''),
        ipAddress: req.ip,
      });
      return res.json({ message: 'Case rejected.', id });
    }

    /* ── Approve (PENDING → VERIFIED) ── */
    if (status === 'VERIFIED') {
      const { error: updateError } = await supabase
        .from('cases')
        .update({ status: 'VERIFIED', verified_by: req.user.id, verified_at: new Date().toISOString() })
        .eq('id', id);
      if (updateError) throw updateError;

      const data = await safeFetchCases(
        (sel) => supabase.from('cases_with_coords').select(sel).eq('id', id).single(),
        ADMIN_CASE_SELECT, BASE_CASE_SELECT
      );
      await logAction({
        adminId: req.user.id, action: 'CASE_APPROVED', targetId: id, targetType: 'case',
        description: `Case "${data.full_name ?? id}" approved by ${req.user.full_name}`,
        ipAddress: req.ip,
      });
      return res.json({ case: formatCaseAdmin(data) });
    }

    /* ── Resolution — FOUND or IDENTIFIED ── */
    if (status === 'FOUND' || status === 'IDENTIFIED') {
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          status,
          resolved_at:      new Date().toISOString(),
          resolved_by:      req.user.id,
          resolution_notes: resolution?.notes ?? null,
          identified_name:  resolution?.identifiedName ?? null,
        })
        .eq('id', id);
      if (updateError) throw updateError;

      const data = await safeFetchCases(
        (sel) => supabase.from('cases_with_coords').select(sel).eq('id', id).single(),
        ADMIN_CASE_SELECT, BASE_CASE_SELECT
      );
      await logAction({
        adminId: req.user.id, action: 'CASE_STATUS_CHANGED', targetId: id, targetType: 'case',
        description: `Case "${data.full_name ?? id}" marked as ${status} by ${req.user.full_name}`,
        ipAddress: req.ip,
      });
      return res.json({ case: formatCaseAdmin(data) });
    }

    res.status(400).json({ error: 'Invalid status value.' });
  } catch (err) {
    console.error('[PATCH /admin/cases/:id]', err.message);
    res.status(500).json({ error: 'Failed to update case.' });
  }
});

/* ── GET /api/cases/admin/proof-documents/:docId/url — signed download ──
   Documents live in a (typically private) bucket; return a short-lived
   signed URL so admins can open the file in the review screen. */
router.get('/admin/proof-documents/:docId/url', requireAuth, async (req, res) => {
  try {
    const { data: doc, error } = await supabase
      .from('proof_documents')
      .select('file_path')
      .eq('id', req.params.docId)
      .single();
    if (error || !doc) return res.status(404).json({ error: 'Document not found.' });

    const { data: signed, error: signErr } = await supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(doc.file_path, 60 * 10);   // 10 minutes
    if (signErr) {
      /* Bucket may be public — fall back to a public URL */
      const { data: pub } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(doc.file_path);
      return res.json({ url: pub.publicUrl });
    }
    res.json({ url: signed.signedUrl });
  } catch (err) {
    console.error('[GET proof-documents/:docId/url]', err.message);
    res.status(500).json({ error: 'Failed to generate document URL.' });
  }
});

/* ── GET /api/cases/admin/:id/proof — proof + sources for review ── */
router.get('/admin/:id/proof', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [docsRes, linksRes] = await Promise.all([
      supabase.from('proof_documents')
        .select('id, document_type, file_name, file_size, mime_type, is_verified, verified_at, rejection_reason, created_at')
        .eq('case_id', id).order('created_at', { ascending: false }),
      supabase.from('source_links')
        .select('id, url, link_type, title, verified, verified_at, created_at')
        .eq('case_id', id).order('created_at', { ascending: false }),
    ]);

    /* Missing tables (un-migrated DB) → return empty arrays rather than 500 */
    const documents    = isMissingRelationError(docsRes.error)  ? [] : (docsRes.data  ?? []);
    const source_links = isMissingRelationError(linksRes.error) ? [] : (linksRes.data ?? []);

    if (docsRes.error  && !isMissingRelationError(docsRes.error))  throw docsRes.error;
    if (linksRes.error && !isMissingRelationError(linksRes.error)) throw linksRes.error;

    res.json({ documents, source_links });
  } catch (err) {
    console.error('[GET /admin/cases/:id/proof]', err.message);
    res.status(500).json({ error: 'Failed to fetch proof documents.' });
  }
});

/* ── PATCH /api/cases/admin/proof-documents/:docId — verify / reject ── */
router.patch(
  '/admin/proof-documents/:docId',
  requireAuth,
  requireRole('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'),
  async (req, res) => {
    const { docId } = req.params;
    const { is_verified, rejection_reason } = req.body ?? {};

    if (typeof is_verified !== 'boolean') {
      return res.status(422).json({ error: 'is_verified must be a boolean.' });
    }

    try {
      const updates = {
        is_verified,
        verified_by:      req.user.id,
        verified_at:      new Date().toISOString(),
        rejection_reason: !is_verified && rejection_reason ? String(rejection_reason).slice(0, 1000) : null,
      };

      const { data, error } = await supabase
        .from('proof_documents')
        .update(updates)
        .eq('id', docId)
        .select('id, is_verified, verified_at, rejection_reason')
        .single();
      if (error) throw error;

      await logAction({
        adminId: req.user.id, action: 'CASE_UPDATED', targetId: docId, targetType: 'proof_document',
        description: `Proof document ${is_verified ? 'verified' : 'rejected'} by ${req.user.full_name}`,
        ipAddress: req.ip,
      });

      res.json({ proof_document: data });
    } catch (err) {
      console.error('[PATCH /admin/proof-documents/:docId]', err.message);
      res.status(500).json({ error: 'Failed to update proof document.' });
    }
  }
);

/* ── PATCH /api/cases/admin/source-links/:linkId — verify ── */
router.patch(
  '/admin/source-links/:linkId',
  requireAuth,
  requireRole('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'),
  async (req, res) => {
    const { linkId } = req.params;
    const { verified } = req.body ?? {};

    try {
      const updates = { verified: !!verified };
      if (verified) {
        updates.verified_by = req.user.id;
        updates.verified_at = new Date().toISOString();
      } else {
        updates.verified_by = null;
        updates.verified_at = null;
      }

      const { data, error } = await supabase
        .from('source_links')
        .update(updates)
        .eq('id', linkId)
        .select('id, verified, verified_at')
        .single();
      if (error) throw error;

      await logAction({
        adminId: req.user.id, action: 'CASE_UPDATED', targetId: linkId, targetType: 'source_link',
        description: `Source link ${verified ? 'verified' : 'unverified'} by ${req.user.full_name}`,
        ipAddress: req.ip,
      });

      res.json({ source_link: data });
    } catch (err) {
      console.error('[PATCH /admin/source-links/:linkId]', err.message);
      res.status(500).json({ error: 'Failed to update source link.' });
    }
  }
);

export default router;
