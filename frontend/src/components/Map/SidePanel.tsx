'use client';

import { MapCase } from './MapContainer';
import { PersonIcon } from '../PersonIcon';

interface SidePanelProps {
  activeCase: MapCase | null;
  allCases: MapCase[];
  onClose: () => void;
  onSelectCase: (c: MapCase) => void;
}

/* ── Scoring engine (mirrors backend matcher.js) ─────────── */

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function descriptionSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const tfA: Record<string, number> = {};
  const tfB: Record<string, number> = {};
  for (const t of ta) tfA[t] = (tfA[t] ?? 0) + 1;
  for (const t of tb) tfB[t] = (tfB[t] ?? 0) + 1;

  const vocab = new Set([...Object.keys(tfA), ...Object.keys(tfB)]);
  let dot = 0, magA = 0, magB = 0;

  for (const term of vocab) {
    const df = (tfA[term] ? 1 : 0) + (tfB[term] ? 1 : 0);
    const idf = Math.log(3 / (1 + df));
    const va = (tfA[term] ?? 0) * idf;
    const vb = (tfB[term] ?? 0) * idf;
    dot  += va * vb;
    magA += va * va;
    magB += vb * vb;
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

interface MatchResult {
  score: number;
  distanceKm: number;
  reasons: string[];
}

function scoreCandidate(active: MapCase, candidate: MapCase): MatchResult | null {
  const reasons: string[] = [];
  let score = 0;

  /* ── Gender hard filter ── */
  if (active.gender_raw !== 'UNKNOWN' && candidate.gender_raw !== 'UNKNOWN') {
    if (active.gender_raw !== candidate.gender_raw) return null;
    score += 20;
    reasons.push(`Same gender (${active.gender})`);
  }

  /* ── Age overlap (±5 yr buffer) ── */
  const aMin = active.age_range_min ?? active.age;
  const aMax = active.age_range_max ?? active.age;
  const cMin = candidate.age_range_min ?? candidate.age;
  const cMax = candidate.age_range_max ?? candidate.age;

  if (aMin != null && cMin != null) {
    const aLo = aMin - 5;
    const aHi = (aMax ?? aMin) + 5;
    const cLo = cMin;
    const cHi = cMax ?? cMin;

    if (cHi < aLo || cLo > aHi) return null; // age mismatch

    const overlapLo  = Math.max(cLo, aLo);
    const overlapHi  = Math.min(cHi, aHi);
    const overlapLen = Math.max(0, overlapHi - overlapLo);
    const unionLen   = Math.max(aHi, cHi) - Math.min(aLo, cLo);
    const ageSim     = unionLen > 0 ? overlapLen / unionLen : 1;
    score += Math.round(ageSim * 25);
    if (ageSim >= 0.8) reasons.push('Similar age');
    else reasons.push('Overlapping age range');
  }

  /* ── Geographic proximity ── */
  const distanceKm = Math.round(haversine(active.lat, active.lng, candidate.lat, candidate.lng) * 100) / 100;

  if (distanceKm > 50) return null; // too far

  let geoPoints: number;
  if      (distanceKm <= 1)  { geoPoints = 30; reasons.push('Same area (< 1 km)'); }
  else if (distanceKm <= 5)  { geoPoints = 25; reasons.push('Very close (< 5 km)'); }
  else if (distanceKm <= 10) { geoPoints = 18; reasons.push('Nearby (< 10 km)'); }
  else if (distanceKm <= 25) { geoPoints = 10; reasons.push('Same general area'); }
  else                       { geoPoints = 3; }
  score += geoPoints;

  /* ── Description similarity ── */
  const descSim   = descriptionSimilarity(active.description, candidate.description);
  const descPoints = Math.round(descSim * 35);
  score += descPoints;

  if      (descSim >= 0.5)  reasons.push(`Strong description match (${Math.round(descSim * 100)}%)`);
  else if (descSim >= 0.25) reasons.push(`Partial description match (${Math.round(descSim * 100)}%)`);
  else if (descSim >= 0.1)  reasons.push(`Some description overlap`);

  score = Math.min(100, Math.max(0, score));

  /* Threshold: ≥40, or ≥30 when description similarity is strong */
  const hasStrongDesc = descSim >= 0.5;
  const minScore = hasStrongDesc ? 30 : 40;
  if (score < minScore) return null;

  return { score, distanceKm, reasons };
}

/* ── Display helpers ─────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatAge(c: MapCase): string {
  if (c.age_range_min != null && c.age_range_max != null) return `${c.age_range_min}–${c.age_range_max} yrs`;
  if (c.age != null) return `~${c.age} yrs`;
  if (c.age_range_min != null) return `${c.age_range_min}+ yrs`;
  if (c.age_range_max != null) return `under ${c.age_range_max} yrs`;
  return 'Age unknown';
}

function ScoreBadge({ score }: { score: number }) {
  const color  = score >= 80 ? '#065f46' : score >= 60 ? '#92400e' : '#7c2d12';
  const bg     = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fff7ed';
  const border = score >= 80 ? 'rgba(16,185,129,0.25)' : score >= 60 ? 'rgba(217,119,6,0.25)' : 'rgba(234,88,12,0.25)';
  return (
    <span style={{
      fontSize: '0.75rem', fontWeight: 800,
      color, background: bg, border: `1px solid ${border}`,
      padding: '2px 8px', borderRadius: 20, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {score}% match
    </span>
  );
}

/* ── Component ───────────────────────────────────────────── */

export function SidePanel({ activeCase, allCases, onClose, onSelectCase }: SidePanelProps) {
  const canMatch = activeCase?.status === 'missing' || activeCase?.status === 'unidentified';
  const oppositeType = activeCase?.status === 'missing' ? 'unidentified' : 'missing';

  const matches = (canMatch && activeCase)
    ? allCases
        .filter(c => c.id !== activeCase.id && c.status === oppositeType)
        .map(c => {
          const result = scoreCandidate(activeCase, c);
          if (!result) return null;
          return { ...c, ...result };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    : [];

  return (
    <aside className={`map-side-panel${activeCase ? ' open' : ''}`} aria-label="Case details">
      {activeCase && (
        <>
          {/* Close */}
          <button className="panel-close" onClick={onClose} aria-label="Close panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {/* Photo */}
          <div className="panel-photo">
            {activeCase.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeCase.imageUrl}
                alt={`Photo of ${activeCase.name}`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 0, background: '#1a1a2e' }}
              />
            ) : (
              <PersonIcon
                gender={activeCase.gender}
                status={activeCase.status}
                style={{ width: '100%', height: '100%', borderRadius: 0 }}
              />
            )}
            <span className={`panel-photo-badge ${activeCase.status}`}>
              {activeCase.status.charAt(0).toUpperCase() + activeCase.status.slice(1)}
            </span>
          </div>

          {/* Body */}
          <div className="panel-body">
            {/* Name + age */}
            <div>
              <h2 className="panel-name">{activeCase.name}</h2>
              <p className="panel-age-gender">
                {formatAge(activeCase)} · {activeCase.gender}
              </p>
            </div>

            {/* Quick details */}
            <div className="panel-details">
              <div className="panel-detail-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span className="panel-detail-label">Barangay</span>
                <span>{activeCase.barangay}</span>
              </div>
              <div className="panel-detail-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span className="panel-detail-label">
                  {activeCase.status === 'missing' ? 'Last Seen' : 'Found'}
                </span>
                <span>{formatDate(activeCase.date)}</span>
              </div>
              <div className="panel-detail-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="panel-detail-label">Location</span>
                <span>{activeCase.location}</span>
              </div>
            </div>

            {/* Physical description */}
            {activeCase.description && (
              <div className="panel-description">
                <div className="panel-description-label">Physical Description</div>
                {activeCase.description}
              </div>
            )}

            {/* Potential matches */}
            {canMatch && (
              <div className="panel-matches">
                <div className="panel-matches-title">
                  Potential Matches
                </div>
                {matches.length > 0 ? (
                  matches.map(m => (
                    <button
                      key={m.id}
                      className="panel-match-card"
                      onClick={() => onSelectCase(m)}
                      aria-label={`View match: ${m.name}, ${m.score}% confidence`}
                    >
                      <PersonIcon
                        gender={m.gender}
                        status={m.status}
                        size={44}
                        style={{ borderRadius: '8px', flexShrink: 0 }}
                      />
                      <div className="panel-match-info">
                        <div className="panel-match-name">{m.name}</div>
                        <div className="panel-match-meta">
                          {m.barangay} · {m.distanceKm.toFixed(1)} km away
                        </div>
                        {m.reasons.length > 0 && (
                          <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem',
                          }}>
                            {m.reasons.map(r => (
                              <span key={r} style={{
                                fontSize: '0.65rem', padding: '1px 6px', borderRadius: 20,
                                background: 'rgba(112,21,21,0.07)', color: '#701515',
                                fontWeight: 600, lineHeight: 1.6, whiteSpace: 'nowrap',
                              }}>
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ScoreBadge score={m.score} />
                    </button>
                  ))
                ) : (
                  <div className="panel-no-matches">
                    No potential matches found. Factors checked: gender, age, location, and physical description.
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
