/**
 * TUKLAS Case Matching Engine
 *
 * Scores MISSING ↔ UNIDENTIFIED case pairs using a weighted combination of:
 *   - Gender match (hard filter + bonus)
 *   - Age proximity
 *   - Geographic proximity (haversine distance)
 *   - TF-IDF cosine similarity on physical description text
 *
 * No external APIs required — runs entirely in Node.js.
 */

/* ── Haversine distance (km) ─────────────────────────────── */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Simple tokeniser ────────────────────────────────────── */
function tokenise(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/* ── TF-IDF cosine similarity ────────────────────────────── */
function tfIdfSimilarity(textA, textB) {
  const tokensA = tokenise(textA);
  const tokensB = tokenise(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  /* Build term frequency maps */
  const tfA = {};
  const tfB = {};
  for (const t of tokensA) tfA[t] = (tfA[t] ?? 0) + 1;
  for (const t of tokensB) tfB[t] = (tfB[t] ?? 0) + 1;

  /* Vocabulary union */
  const vocab = new Set([...Object.keys(tfA), ...Object.keys(tfB)]);

  /* IDF — simple: log(2 / (1 + df)) where df is 0, 1, or 2 */
  let dot = 0, magA = 0, magB = 0;
  for (const term of vocab) {
    const df = (tfA[term] ? 1 : 0) + (tfB[term] ? 1 : 0);
    const idf = Math.log(3 / (1 + df));
    const a = (tfA[term] ?? 0) * idf;
    const b = (tfB[term] ?? 0) * idf;
    dot  += a * b;
    magA += a * a;
    magB += b * b;
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/* ── Age overlap ─────────────────────────────────────────── */
function ageScore(missing, unidentified) {
  /* Resolve age range for each case */
  const mMin = missing.age_range_min ?? missing.age_approx ?? null;
  const mMax = missing.age_range_max ?? missing.age_approx ?? null;
  const uMin = unidentified.age_range_min ?? unidentified.age_approx ?? null;
  const uMax = unidentified.age_range_max ?? unidentified.age_approx ?? null;

  if (mMin == null || uMin == null) return 0.3; // unknown — neutral

  const mLo = mMin, mHi = mMax ?? mMin;
  const uLo = uMin, uHi = uMax ?? uMin;

  /* Expand ranges by ±5 years to account for estimation error */
  const expandedMLo = mLo - 5;
  const expandedMHi = mHi + 5;

  /* Check overlap */
  if (uHi < expandedMLo || uLo > expandedMHi) return 0; // no overlap

  /* Overlap ratio */
  const overlapLo  = Math.max(uLo, expandedMLo);
  const overlapHi  = Math.min(uHi, expandedMHi);
  const overlapLen = overlapHi - overlapLo;
  const unionLen   = Math.max(expandedMHi, uHi) - Math.min(expandedMLo, uLo);
  return unionLen > 0 ? overlapLen / unionLen : 1;
}

/* ── Main scoring function ───────────────────────────────── */
/**
 * Score a MISSING ↔ UNIDENTIFIED pair.
 *
 * @param {object} missing       - case row with type='MISSING'
 * @param {object} unidentified  - case row with type='UNIDENTIFIED'
 * @param {object} [mCoords]     - { lat, lng } for missing case (optional)
 * @param {object} [uCoords]     - { lat, lng } for unidentified case (optional)
 * @returns {{ score: number, distanceKm: number|null, reasons: string[] }}
 */
export function scorePair(missing, unidentified, mCoords, uCoords) {
  const reasons = [];
  let score = 0;

  /* ── Gender (hard filter + bonus) ── */
  const mGender = missing.gender;
  const uGender = unidentified.gender;
  if (mGender !== 'UNKNOWN' && uGender !== 'UNKNOWN') {
    if (mGender !== uGender) {
      return { score: 0, distanceKm: null, reasons: [] }; // hard mismatch
    }
    score += 20;
    reasons.push(`Same gender (${mGender.charAt(0) + mGender.slice(1).toLowerCase()})`);
  }

  /* ── Age ── */
  const ageSim = ageScore(missing, unidentified);
  if (ageSim === 0) {
    return { score: 0, distanceKm: null, reasons: [] }; // age mismatch
  }
  const agePoints = Math.round(ageSim * 25);
  score += agePoints;
  if (ageSim >= 0.8) reasons.push('Similar age');
  else if (ageSim >= 0.5) reasons.push('Overlapping age range');

  /* ── Geographic proximity ── */
  let distanceKm = null;
  if (mCoords && uCoords) {
    distanceKm = haversineKm(mCoords.lat, mCoords.lng, uCoords.lat, uCoords.lng);
    distanceKm = Math.round(distanceKm * 100) / 100;

    if (distanceKm > 50) {
      return { score: 0, distanceKm, reasons: [] }; // too far apart
    }

    let geoPoints;
    if (distanceKm <= 1)       { geoPoints = 30; reasons.push('Same area (< 1 km)'); }
    else if (distanceKm <= 5)  { geoPoints = 25; reasons.push('Very close (< 5 km)'); }
    else if (distanceKm <= 10) { geoPoints = 18; reasons.push('Nearby (< 10 km)'); }
    else if (distanceKm <= 25) { geoPoints = 10; reasons.push('Same general area (< 25 km)'); }
    else                       { geoPoints = 3; }
    score += geoPoints;
  } else {
    /* No coords — same barangay check */
    if (missing.barangay_name && missing.barangay_name === unidentified.barangay_name) {
      score += 20;
      reasons.push(`Same barangay (${missing.barangay_name})`);
    }
  }

  /* ── Description TF-IDF ── */
  const descSim = tfIdfSimilarity(missing.description, unidentified.description);
  const descPoints = Math.round(descSim * 35);  // up to 35 pts — most informative signal
  score += descPoints;

  if (descSim >= 0.5) {
    reasons.push(`Strong description match (${Math.round(descSim * 100)}% similarity)`);
  } else if (descSim >= 0.25) {
    reasons.push(`Partial description match (${Math.round(descSim * 100)}% similarity)`);
  } else if (descSim >= 0.1) {
    reasons.push(`Some description overlap (${Math.round(descSim * 100)}% similarity)`);
  }
  /* If both have descriptions but similarity is very low, note it */
  if (descSim < 0.1 && missing.description && unidentified.description) {
    reasons.push('Descriptions differ significantly');
  }

  /* Clamp to 0–100 */
  score = Math.min(100, Math.max(0, score));

  return { score, distanceKm, reasons };
}
/* ── Batch: find all candidate pairs above threshold ─────── */
/**
 * Given arrays of missing and unidentified cases (with coords),
 * return all pairs with score >= minScore, sorted descending.
 *
 * @param {object[]} missingCases
 * @param {object[]} unidentifiedCases
 * @param {number}   [minScore=40]
 * @returns {Array<{ missingId, unidentifiedId, score, distanceKm, reasons }>}
 */
export function findCandidatePairs(missingCases, unidentifiedCases, minScore = 40) {
  const results = [];

  for (const m of missingCases) {
    for (const u of unidentifiedCases) {
      const mCoords = m.coords ?? null;
      const uCoords = u.coords ?? null;
      const { score, distanceKm, reasons } = scorePair(m, u, mCoords, uCoords);

      /* Lower the bar when description similarity is strong — descriptions
         are the most reliable signal when geo/age data is sparse. */
      const hasStrongDesc = reasons.some(r => r.startsWith('Strong description'));
      const effectiveMin  = hasStrongDesc ? Math.min(minScore, 30) : minScore;

      if (score >= effectiveMin) {
        results.push({
          missingId:       m.id,
          unidentifiedId:  u.id,
          score,
          distanceKm,
          reasons,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
