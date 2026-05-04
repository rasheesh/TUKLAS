import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase.js';
import { pointToLatLng } from '../lib/geoTransform.js';
import { logAction } from '../lib/auditLogger.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/* ── Multer — memory storage with file size + MIME type guard ── */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB per file
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type "${file.mimetype}". Only JPEG, PNG, WebP, and GIF images are accepted.`));
    }
  },
});

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'case-photos';

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

/* ── POST /api/cases — submit new report (public) ────────── */
router.post('/', (req, res, next) => {
  upload.array('photos', 10)(req, res, (err) => {
    if (err) {
      /* Multer file-type rejection → return a clear 422 instead of a 500 */
      if (err.message && err.message.startsWith('Invalid file type')) {
        return res.status(422).json({
          error: 'Unsupported photo format. Please upload JPG, PNG, WebP, or GIF images. ' +
                 'If you are on a Mac or iPhone, convert HEIC photos to JPG before uploading.',
        });
      }
      /* File too large */
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(422).json({ error: 'One or more photos exceed the 10 MB size limit.' });
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
      if (err.code === 'PGRST301' || err.message?.includes('timeout')) {
        return res.status(503).json({ error: 'Database Connection Timeout — please try again in a moment.' });
      }
      return null; // caller should throw
    }

    let newCase;
    {
      /* Attempt 1: full payload + case_reference in select */
      let { data, error } = await tryInsert(insertPayload, 'id, case_reference');

      if (error && isColumnError(error)) {
        /* Attempt 2: case_reference column missing in select — try id only */
        console.warn('[POST /cases] case_reference column missing — run add_missing_columns_and_rebuild_view.sql. Falling back.');
        ({ data, error } = await tryInsert(insertPayload, 'id'));
      }

      if (error && isColumnError(error)) {
        /* Attempt 3: height_ft column also missing in payload — strip it and retry */
        console.warn('[POST /cases] height_ft column missing — run add_missing_columns_and_rebuild_view.sql. Stripping height_ft.');
        const { height_ft: _dropped, ...payloadWithoutHeight } = insertPayload;
        ({ data, error } = await tryInsert(payloadWithoutHeight, 'id'));
      }

      if (error) {
        const handled = handleNonColumnInsertError(error);
        if (handled) return handled;
        throw error;
      }

      newCase = data;
    }

    /* Upload photos */
    const files = req.files ?? [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext  = file.originalname.split('.').pop();
      const path = `${newCase.id}/${Date.now()}-${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file.buffer, { contentType: file.mimetype });

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
          .neq('status', 'PENDING')
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

    /* ── Reject ── */
    if (status === 'REJECTED') {
      await logAction({
        adminId: req.user.id, action: 'CASE_REJECTED', targetId: id, targetType: 'case',
        description: `Case ${id} rejected and deleted by ${req.user.full_name}`,
        ipAddress: req.ip,
      });
      const { error } = await supabase.from('cases').delete().eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Case rejected and removed.' });
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

export default router;
