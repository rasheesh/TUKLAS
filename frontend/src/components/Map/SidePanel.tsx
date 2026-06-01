'use client';

import { MapCase, CaseStatus } from './MapContainer';
import { PersonIcon } from '../PersonIcon';

interface SidePanelProps {
  activeCase: MapCase | null;
  allCases: MapCase[];
  onClose: () => void;
  onSelectCase: (c: MapCase) => void;
}

/* Haversine distance in km */
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface ScoredMatch extends MapCase {
  dist:       number;
  score:      number;
  confidence: 'High' | 'Medium' | 'Low';
  reasons:    string[];
}

/* ── Multi-factor match scoring ───────────────────────────────
   A missing-person report is matched against unidentified-person
   reports (and vice-versa) using gender, age, distance, and date —
   not location alone. Biologically/chronologically impossible pairs
   are excluded outright; the rest are scored 0–100 and ranked.       */
function scoreMatch(active: MapCase, cand: MapCase): ScoredMatch | null {
  /* Identify which side is the missing report and which is the find */
  const missing      = active.status === 'missing' ? active : cand;
  const unidentified = active.status === 'missing' ? cand   : active;

  const lastSeen = new Date(missing.date).getTime();
  const found    = new Date(unidentified.date).getTime();
  const datesKnown = !Number.isNaN(lastSeen) && !Number.isNaN(found);

  /* ── Hard implausibility gates ── */
  /* Can't be found before going missing (2-day grace for data-entry slack) */
  if (datesKnown && found < lastSeen - 2 * DAY_MS) return null;
  /* Different known gender — a missing person's gender doesn't change */
  if (active.gender !== 'Unknown' && cand.gender !== 'Unknown'
      && active.gender !== cand.gender) return null;
  /* Wildly different ages (both known) — allow 30 yrs for estimation error */
  if (active.age > 0 && cand.age > 0
      && Math.abs(active.age - cand.age) > 30) return null;

  const reasons: string[] = [];
  let score = 0;

  /* ── Gender (30) ── */
  if (active.gender !== 'Unknown' && cand.gender !== 'Unknown') {
    score += 30;                                   // equal (mismatches already gated out)
    reasons.push(`Same gender (${cand.gender})`);
  } else {
    score += 12;                                   // unknown on one side — partial
  }

  /* ── Distance (25) ── */
  const dist = haversine(active.lat, active.lng, cand.lat, cand.lng);
  if      (dist <= 1)  score += 25;
  else if (dist <= 3)  score += 18;
  else if (dist <= 5)  score += 10;
  else if (dist <= 10) score += 4;
  reasons.push(`${dist.toFixed(1)} km away`);

  /* ── Age (30) ── */
  if (active.age > 0 && cand.age > 0) {
    const diff = Math.abs(active.age - cand.age);
    if      (diff <= 2)  { score += 30; reasons.push('Age within 2 yrs'); }
    else if (diff <= 5)  { score += 22; reasons.push('Age within 5 yrs'); }
    else if (diff <= 10) { score += 12; reasons.push('Age within 10 yrs'); }
    else if (diff <= 15) { score += 5;  }
  } else {
    score += 12;                                   // unknown age — partial
  }

  /* ── Date proximity (15) ── */
  if (datesKnown) {
    const gapDays = Math.abs(found - lastSeen) / DAY_MS;
    if      (gapDays <= 30)  { score += 15; reasons.push(`Found ${Math.round(gapDays)}d after last seen`); }
    else if (gapDays <= 180) { score += 10; }
    else if (gapDays <= 365) { score += 5;  }
    else                     { score += 2;  }
  }

  const confidence: ScoredMatch['confidence'] =
    score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Low';

  return { ...cand, dist, score, confidence, reasons };
}

export function SidePanel({ activeCase, allCases, onClose, onSelectCase }: SidePanelProps) {
  /* Match a missing report against finds and vice-versa; nothing to match for
     already-resolved ("found") cases. */
  const oppositeType: CaseStatus | null =
    activeCase?.status === 'missing'      ? 'unidentified'
    : activeCase?.status === 'unidentified' ? 'missing'
    : null;

  const matches: ScoredMatch[] = activeCase && oppositeType
    ? allCases
        .filter(c => c.id !== activeCase.id && c.status === oppositeType)
        .map(c => scoreMatch(activeCase, c))
        .filter((m): m is ScoredMatch => m !== null && m.score >= 35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
    : [];

  return (
    <aside className={`map-side-panel${activeCase ? ' open' : ''}`} aria-label="Case details">
      {activeCase && (
        <>
          {/* Close */}
          <button className="panel-close" onClick={onClose} aria-label="Close panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          {/* Photo */}
          <div className="panel-photo">
            {activeCase.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
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
                {activeCase.age} yrs · {activeCase.gender}
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
            <div className="panel-matches">
              <div className="panel-matches-title">
                Potential Matches
              </div>
              {matches.length > 0 ? (
                matches.map(m => {
                  const badgeColor =
                    m.confidence === 'High'   ? '#27ae60'
                    : m.confidence === 'Medium' ? '#f39c12'
                    : '#95a5a6';
                  return (
                    <button
                      key={m.id}
                      className="panel-match-card"
                      onClick={() => onSelectCase(m)}
                      aria-label={`View match: ${m.name} — ${m.confidence} confidence`}
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
                          {m.barangay} · {m.gender}{m.age > 0 ? ` · ${m.age} yrs` : ''}
                        </div>
                        <div
                          className="panel-match-reasons"
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--color-text-light, #7f8c8d)',
                            marginTop: '2px',
                            lineHeight: 1.35,
                          }}
                        >
                          {m.reasons.join(' · ')}
                        </div>
                      </div>
                      <span
                        className="panel-match-dist"
                        style={{
                          background: `${badgeColor}1a`,
                          color: badgeColor,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          fontSize: '0.66rem',
                          whiteSpace: 'nowrap',
                          alignSelf: 'flex-start',
                        }}
                      >
                        {m.confidence}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="panel-no-matches">
                  No likely matches found.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
