'use client';

import { MapCase } from './MapContainer';
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

export function SidePanel({ activeCase, allCases, onClose, onSelectCase }: SidePanelProps) {
  /* Opposite type for matching */
  const oppositeType = activeCase?.status === 'missing' ? 'unidentified' : 'missing';

  const matches = activeCase
    ? allCases
        .filter(c => c.id !== activeCase.id && c.status === oppositeType)
        .map(c => ({
          ...c,
          dist: haversine(activeCase.lat, activeCase.lng, c.lat, c.lng),
        }))
        .filter(c => c.dist <= 5)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3)
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
                Potential Matches within 5km
              </div>
              {matches.length > 0 ? (
                matches.map(m => (
                  <button
                    key={m.id}
                    className="panel-match-card"
                    onClick={() => onSelectCase(m)}
                    aria-label={`View match: ${m.name}`}
                  >
                    <PersonIcon
                      gender={m.gender}
                      status={m.status}
                      size={44}
                      style={{ borderRadius: '8px', flexShrink: 0 }}
                    />
                    <div className="panel-match-info">
                      <div className="panel-match-name">{m.name}</div>
                      <div className="panel-match-meta">{m.barangay} · {m.gender}</div>
                    </div>
                    <span className="panel-match-dist">{m.dist.toFixed(1)} km</span>
                  </button>
                ))
              ) : (
                <div className="panel-no-matches">
                  No potential matches found within 5km radius.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
