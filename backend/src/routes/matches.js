/**
 * TUKLAS — Case Matching Routes
 *
 * GET  /api/matches          — fetch pending (unreviewed) match suggestions
 * POST /api/matches/run      — run the matching engine and upsert suggestions
 * PATCH /api/matches/:id     — dismiss or confirm a match
 */

import { Router } from 'express';
import { supabase }          from '../lib/supabase.js';
import { logAction }         from '../lib/auditLogger.js';
import { requireAuth }       from '../middleware/auth.js';
import { pointToLatLng }     from '../lib/geoTransform.js';
import { findCandidatePairs } from '../lib/matcher.js';

const router = Router();

/* ── Helpers ─────────────────────────────────────────────── */

/* Fetch active cases for the matching engine.
   Falls back gracefully if the view doesn't have all columns yet. */
async function fetchActiveCases() {
  /* Try the full view first */
  let { data, error } = await supabase
    .from('cases_with_coords')
    .select(`
      id, type, status, gender,
      full_name, age_approx, age_range_min, age_range_max,
      description, barangay_id, barangay_name,
      location_text, incident_date,
      coords_geojson,
      reporter_name, reporter_contact,
      primary_photo_url
    `)
    .in('status', ['VERIFIED', 'FOUND', 'IDENTIFIED'])
    .order('created_at', { ascending: false });

  /* If the view is missing columns (migration not run), fall back to
     the cases table directly — no coords, but matching still works
     via barangay name comparison. */
  if (error) {
    const isColErr = error.code === '42703'
      || (error.message && error.message.toLowerCase().includes('column'));

    if (isColErr) {
      console.warn('[matches/run] cases_with_coords missing columns — falling back to cases table.');
      const fallback = await supabase
        .from('cases')
        .select(`
          id, type, status, gender,
          full_name, age_approx, age_range_min, age_range_max,
          description, barangay_id,
          location_text, incident_date,
          reporter_name, reporter_contact
        `)
        .in('status', ['VERIFIED', 'FOUND', 'IDENTIFIED'])
        .order('created_at', { ascending: false });

      if (fallback.error) throw fallback.error;

      /* Resolve barangay names separately */
      const { data: barangays } = await supabase
        .from('barangays').select('id, name');
      const bMap = {};
      for (const b of (barangays ?? [])) bMap[b.id] = b.name;

      return (fallback.data ?? []).map(c => ({
        ...c,
        barangay_name: bMap[c.barangay_id] ?? null,
        coords:        null,
        photo_url:     null,
      }));
    }

    throw error;
  }

  return (data ?? []).map(c => ({
    ...c,
    coords:    pointToLatLng(c.coords_geojson),
    photo_url: c.primary_photo_url ?? null,
    coords_geojson:    undefined,
    primary_photo_url: undefined,
  }));
}

/* ── GET /api/matches — pending match suggestions ─────────── */
router.get('/', requireAuth, async (req, res) => {
  try {
    /* Try selecting flagged column; fall back gracefully if migration not run */
    let matchRows, matchError;

    ({ data: matchRows, error: matchError } = await supabase
      .from('case_matches')
      .select(`
        id, score, distance_km, match_reasons,
        confirmed, dismissed, flagged,
        missing_case_id, unidentified_case_id
      `)
      .eq('confirmed', false)
      .eq('dismissed', false)
      .order('score', { ascending: false })
      .limit(100));

    /* If flagged column missing, retry without it */
    if (matchError) {
      const isCol = matchError.code === '42703'
        || (matchError.message && matchError.message.toLowerCase().includes('column'));
      if (isCol) {
        console.warn('[GET /matches] flagged column missing — run add_case_matches_flagged.sql. Falling back.');
        ({ data: matchRows, error: matchError } = await supabase
          .from('case_matches')
          .select(`
            id, score, distance_km, match_reasons,
            confirmed, dismissed,
            missing_case_id, unidentified_case_id
          `)
          .eq('confirmed', false)
          .eq('dismissed', false)
          .order('score', { ascending: false })
          .limit(100));
      }
      if (matchError) throw matchError;
    }
    if (!matchRows || matchRows.length === 0) {
      return res.json({ matches: [] });
    }

    /* Collect all case IDs we need */
    const caseIds = [
      ...new Set([
        ...matchRows.map(m => m.missing_case_id),
        ...matchRows.map(m => m.unidentified_case_id),
      ]),
    ];

    /* Fetch case details — fall back to core columns if view is missing extended ones */
    let caseData;
    {
      let { data, error: cErr } = await supabase
        .from('cases_with_coords')
        .select(`
          id, type, status, gender,
          full_name, age_approx, age_range_min, age_range_max,
          description, barangay_name, location_text, incident_date,
          coords_geojson, primary_photo_url,
          reporter_name, reporter_contact
        `)
        .in('id', caseIds);

      if (cErr) {
        const isCol = cErr.code === '42703'
          || (cErr.message && cErr.message.toLowerCase().includes('column'));
        if (isCol) {
          console.warn('[GET /matches] cases_with_coords missing columns — falling back to core select.');
          ({ data, error: cErr } = await supabase
            .from('cases_with_coords')
            .select(`
              id, type, status, gender,
              full_name, age_approx, age_range_min, age_range_max,
              description, barangay_name, location_text, incident_date,
              coords_geojson, primary_photo_url,
              reporter_name, reporter_contact
            `)
            .in('id', caseIds));
        }
        if (cErr) throw cErr;
      }
      caseData = data;
    }

    const caseMap = {};
    for (const c of caseData) {
      caseMap[c.id] = {
        ...c,
        coords:    pointToLatLng(c.coords_geojson),
        photo_url: c.primary_photo_url ?? null,
        coords_geojson:    undefined,
        primary_photo_url: undefined,
      };
    }

    /* Shape into the MatchRecord format the frontend expects */
    const matches = matchRows
      .map(m => {
        const mc = caseMap[m.missing_case_id];
        const uc = caseMap[m.unidentified_case_id];
        if (!mc || !uc) return null;

        const ageStr = (c) => {
          if (c.age_approx) return String(c.age_approx);
          if (c.age_range_min && c.age_range_max) return `${c.age_range_min}–${c.age_range_max}`;
          return '—';
        };

        const genderLabel = (g) =>
          g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Unknown';

        return {
          id:              String(m.id),
          score:           m.score,
          distanceKm:      m.distance_km ?? null,
          matchReasons:    m.match_reasons ?? [],
          flagged:         m.flagged ?? false,
          missingCaseId:   m.missing_case_id,
          unidentifiedCaseId: m.unidentified_case_id,
          missing: {
            name:            mc.full_name ?? 'Unknown',
            age:             ageStr(mc),
            gender:          genderLabel(mc.gender),
            barangay:        mc.barangay_name ?? '',
            date:            mc.incident_date ?? '',
            location:        mc.location_text ?? '',
            description:     mc.description ?? '',
            photo:           mc.photo_url ?? '',
            reporterContact: mc.reporter_contact ?? '',
          },
          unidentified: {
            name:            uc.full_name ?? 'Unidentified Person',
            age:             ageStr(uc),
            gender:          genderLabel(uc.gender),
            barangay:        uc.barangay_name ?? '',
            date:            uc.incident_date ?? '',
            location:        uc.location_text ?? '',
            description:     uc.description ?? '',
            photo:           uc.photo_url ?? '',
            reporterContact: uc.reporter_contact ?? '',
          },
        };
      })
      .filter(Boolean);

    res.json({ matches });
  } catch (err) {
    console.error('[GET /matches]', err.message);
    res.status(500).json({ error: 'Failed to fetch matches.' });
  }
});

/* ── POST /api/matches/run — run matching engine ─────────── */
router.post('/run', requireAuth, async (req, res) => {
  try {
    const allCases = await fetchActiveCases();
    const missing      = allCases.filter(c => c.type === 'MISSING');
    const unidentified = allCases.filter(c => c.type === 'UNIDENTIFIED');

    if (missing.length === 0 || unidentified.length === 0) {
      return res.json({ inserted: 0, message: 'No cases to match.' });
    }

    const pairs = findCandidatePairs(missing, unidentified, 40);

    if (pairs.length === 0) {
      return res.json({ inserted: 0, message: 'No matches found above threshold.' });
    }

    /* Fetch existing pairs (any state) to avoid re-inserting dismissed or confirmed ones */
    const { data: existing } = await supabase
      .from('case_matches')
      .select('missing_case_id, unidentified_case_id')
      .in('missing_case_id', pairs.map(p => p.missingId));

    const existingSet = new Set(
      (existing ?? []).map(e => `${e.missing_case_id}:${e.unidentified_case_id}`)
    );

    const newRows = pairs
      .filter(p => !existingSet.has(`${p.missingId}:${p.unidentifiedId}`))
      .map(p => ({
        missing_case_id:      p.missingId,
        unidentified_case_id: p.unidentifiedId,
        score:                p.score,
        distance_km:          p.distanceKm,
        match_reasons:        p.reasons,
      }));

    if (newRows.length > 0) {
      const { error: insertErr } = await supabase
        .from('case_matches')
        .insert(newRows);

      if (insertErr) {
        console.error('[POST /matches/run] Insert error:', insertErr.code, insertErr.message);
        throw insertErr;
      }
    }

    await logAction({
      adminId:     req.user.id,
      action:      'CASE_UPDATED',
      targetId:    null,
      targetType:  'match',
      description: `Matching engine run by ${req.user.full_name} — ${newRows.length} new pair(s) inserted (${pairs.length} total candidates).`,
      ipAddress:   req.ip,
    });

    res.json({
      inserted: newRows.length,
      message:  newRows.length > 0
        ? `${newRows.length} new match(es) generated.`
        : `No new matches — ${pairs.length} candidate(s) already in queue.`,
    });
  } catch (err) {
    console.error('[POST /matches/run]', err.message);
    res.status(500).json({ error: 'Failed to run matching engine.' });
  }
});

/* ── PATCH /api/matches/:id — dismiss, confirm, or flag ──── */
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { action, resolution } = req.body ?? {};

  if (!['dismiss', 'confirm', 'flag', 'unflag'].includes(action)) {
    return res.status(400).json({ error: 'action must be "dismiss", "confirm", "flag", or "unflag".' });
  }

  /* Confirm and dismiss require ADMIN or above */
  if (action === 'confirm' || action === 'dismiss') {
    const allowed = ['ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Confirming or dismissing matches requires ${allowed.join(' or ')}.`,
      });
    }
  }

  try {
    /* ── Flag / Unflag ── */
    if (action === 'flag' || action === 'unflag') {
      /* Gracefully handle missing flagged column (migration not run yet) */
      const { error } = await supabase
        .from('case_matches')
        .update({ flagged: action === 'flag' })
        .eq('id', id);

      if (error) {
        const isCol = error.code === '42703'
          || (error.message && error.message.toLowerCase().includes('column'));
        if (isCol) {
          console.warn('[PATCH /matches] flagged column missing — run add_case_matches_flagged.sql');
          return res.json({ message: `Match ${action}ged (optimistic — run migration to persist).` });
        }
        throw error;
      }

      await logAction({
        adminId:     req.user.id,
        action:      'CASE_UPDATED',
        targetId:    id,
        targetType:  'match',
        description: `Match ${id} ${action === 'flag' ? 'flagged for review' : 'unflagged'} by ${req.user.full_name}`,
        ipAddress:   req.ip,
      });

      return res.json({ message: `Match ${action}ged.` });
    }

    /* ── Dismiss ── */
    if (action === 'dismiss') {
      const { error } = await supabase
        .from('case_matches')
        .update({ dismissed: true, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      await logAction({
        adminId:     req.user.id,
        action:      'MATCH_DISMISSED',
        targetId:    id,
        targetType:  'match',
        description: `Match ${id} dismissed (not a match) by ${req.user.full_name}`,
        ipAddress:   req.ip,
      });

      return res.json({ message: 'Match dismissed.' });
    }

    /* ── Confirm — mark match confirmed + resolve both cases ── */
    if (action === 'confirm') {
      /* 1. Fetch the match to get both case IDs */
      const { data: matchRow, error: fetchErr } = await supabase
        .from('case_matches')
        .select('id, missing_case_id, unidentified_case_id')
        .eq('id', id)
        .single();

      if (fetchErr || !matchRow) {
        return res.status(404).json({ error: 'Match not found.' });
      }

      const { missing_case_id, unidentified_case_id } = matchRow;
      const now = new Date().toISOString();
      const dateStr = new Date(now).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      /* 2. Fetch both cases to get names and details for cross-referenced notes */
      const [{ data: missingCase }, { data: unidentifiedCase }] = await Promise.all([
        supabase.from('cases').select('id, full_name, barangay_id, incident_date, location_text').eq('id', missing_case_id).single(),
        supabase.from('cases').select('id, full_name, barangay_id, incident_date, location_text, description').eq('id', unidentified_case_id).single(),
      ]);

      /* Resolve barangay names */
      const barangayIds = [missingCase?.barangay_id, unidentifiedCase?.barangay_id].filter(Boolean);
      const { data: barangays } = await supabase.from('barangays').select('id, name').in('id', barangayIds);
      const bMap = {};
      for (const b of (barangays ?? [])) bMap[b.id] = b.name;

      const missingName       = missingCase?.full_name ?? 'Unknown';
      const unidentifiedName  = unidentifiedCase?.full_name ?? 'Unidentified Person';
      const missingBarangay   = bMap[missingCase?.barangay_id] ?? '';
      const unidentifiedBarangay = bMap[unidentifiedCase?.barangay_id] ?? '';
      const adminNotes        = resolution?.notes ? ` Admin notes: ${resolution.notes}` : '';

      /* 3. Mark the match as confirmed */
      const { error: matchErr } = await supabase
        .from('case_matches')
        .update({ confirmed: true, reviewed_by: req.user.id, reviewed_at: now })
        .eq('id', id);
      if (matchErr) throw matchErr;

      /* 4. Resolve the MISSING case → FOUND
            Resolution notes reference the unidentified case details */
      const missingNotes = [
        `Person found and identified on ${dateStr}.`,
        unidentifiedBarangay ? `Was found in ${unidentifiedBarangay}.` : '',
        `Matched with unidentified case${unidentifiedName !== 'Unidentified Person' ? ` (${unidentifiedName})` : ''} and confirmed by ${req.user.full_name}.`,
        adminNotes,
      ].filter(Boolean).join(' ');

      const { error: missingErr } = await supabase
        .from('cases')
        .update({
          status:           'FOUND',
          resolved_at:      now,
          resolved_by:      req.user.id,
          resolution_notes: missingNotes,
        })
        .eq('id', missing_case_id);
      if (missingErr) throw missingErr;

      /* 5. Resolve the UNIDENTIFIED case → IDENTIFIED
            Resolution notes reference the missing case details, identified_name = missing person's name */
      const unidentifiedNotes = [
        `Identity confirmed on ${dateStr}.`,
        missingName !== 'Unknown' ? `Identified as ${missingName}.` : '',
        missingBarangay ? `Missing person was last seen in ${missingBarangay}.` : '',
        `Matched with missing person report and confirmed by ${req.user.full_name}.`,
        adminNotes,
      ].filter(Boolean).join(' ');

      const { error: unidentifiedErr } = await supabase
        .from('cases')
        .update({
          status:           'IDENTIFIED',
          resolved_at:      now,
          resolved_by:      req.user.id,
          identified_name:  missingName !== 'Unknown' ? missingName : (resolution?.identifiedName ?? null),
          resolution_notes: unidentifiedNotes,
        })
        .eq('id', unidentified_case_id);
      if (unidentifiedErr) throw unidentifiedErr;

      /* 6. Audit log */
      await logAction({
        adminId:     req.user.id,
        action:      'MATCH_CONFIRMED',
        targetId:    id,
        targetType:  'match',
        description: `Match confirmed by ${req.user.full_name}. "${missingName}" (missing, ${missingBarangay}) → FOUND. Unidentified person (${unidentifiedBarangay}) → IDENTIFIED as "${missingName}".`,
        ipAddress:   req.ip,
      });

      return res.json({
        message:         'Match confirmed. Both cases have been resolved.',
        missingCaseId:   missing_case_id,
        unidentifiedCaseId: unidentified_case_id,
      });
    }

    res.status(400).json({ error: 'Invalid action.' });
  } catch (err) {
    console.error('[PATCH /matches/:id]', err.message);
    res.status(500).json({ error: 'Failed to update match.' });
  }
});

export default router;
