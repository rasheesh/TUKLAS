export type CaseStatus = 'missing' | 'unidentified' | 'found';
export type VerificationStatus = 'verified' | 'pending';

export interface CaseData {
  id: string;
  name: string;
  barangay: string;
  age: number;
  gender: 'Male' | 'Female';
  lastSeen: string;
  imageUrl?: string;
  status: CaseStatus;
  verification: VerificationStatus;
  /* Extended fields shown in the detail modal */
  heightFt?: number | null;
  location?: string;
  description?: string;
  reporterName?: string;
  reporterContact?: string;
  caseType?: 'MISSING' | 'UNIDENTIFIED';
}

interface CaseCardProps {
  data: CaseData;
  onClick?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/* Tinted background per status */
const STATUS_BG: Record<CaseStatus, string> = {
  missing:      '#f5e8e8',
  unidentified: '#fef3e2',
  found:        '#e8f5ee',
};

const STATUS_ICON_COLOR: Record<CaseStatus, string> = {
  missing:      '#c0392b',
  unidentified: '#d35400',
  found:        '#1e8449',
};

/* Labels that match the report form exactly */
const TYPE_LABEL: Record<CaseStatus, string> = {
  missing:      'Missing Person',
  unidentified: 'Unidentified Person',
  found:        'Case Resolved',
};

/* Date label matches the form field label per type */
function getDateLabel(status: CaseStatus): string {
  if (status === 'missing')      return 'Date Last Seen';
  if (status === 'unidentified') return 'Date Found';
  return 'Date Reported';
}

/* Barangay label matches the form field label per type */
function getBarangayLabel(status: CaseStatus): string {
  if (status === 'missing')      return 'Last Seen Barangay';
  if (status === 'unidentified') return 'Found in Barangay';
  return 'Barangay';
}

/* Convert decimal feet to display string: 5.75 → "5′9″" */
export function formatHeight(heightFt: number | null | undefined): string {
  if (heightFt == null) return '—';
  const ft = Math.floor(heightFt);
  const inches = Math.round((heightFt - ft) * 12);
  return `${ft}′${inches}″`;
}

/* ── Branded "No Image" placeholder ────────────────────────── */
function NoImagePlaceholder({ status }: { status: CaseStatus }) {
  const color = STATUS_ICON_COLOR[status];
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="No photo available"
      style={{ width: '70%', height: '70%', opacity: 0.55 }}
    >
      <circle cx="60" cy="38" r="22" fill={color} />
      <path d="M20 110 C20 78 38 62 60 60 C82 62 100 78 100 110Z" fill={color} />
      <line x1="18" y1="18" x2="102" y2="102" stroke={color} strokeWidth="5" strokeLinecap="round" opacity="0.4" />
      <path d="M8 30 L8 8 L30 8" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M90 8 L112 8 L112 30" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M8 90 L8 112 L30 112" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M90 112 L112 112 L112 90" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

export function CaseCard({ data, onClick }: CaseCardProps) {
  const { name, barangay, age, gender, lastSeen, status, imageUrl, heightFt } = data;
  const bg    = STATUS_BG[status];

  const dateLabel     = getDateLabel(status);
  const barangayLabel = getBarangayLabel(status);

  /* Age display: unidentified uses a range label */
  const ageDisplay = status === 'unidentified'
    ? `Est. ${age} yrs`
    : `${age} yrs`;

  return (
    <article
      className="case-card"
      role="article"
      aria-label={`Case: ${name}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      {/* Photo or branded placeholder */}
      <div
        className="case-card-image"
        style={{ background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Photo of ${name}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <NoImagePlaceholder status={status} />
        )}
      </div>

      {/* Body */}
      <div className="case-card-body">
        <h4 className="case-card-name" title={name}>{name}</h4>

        <div className="case-card-meta">
          {/* Barangay — label changes per type */}
          <div className="case-card-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span title={barangayLabel}>{barangay}</span>
          </div>

          {/* Date — label changes per type */}
          <div className="case-card-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>{dateLabel}: {formatDate(lastSeen)}</span>
          </div>

          {/* Age / Gender */}
          <div className="case-card-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>{ageDisplay} · {gender}</span>
          </div>

          {/* Height — only shown when available */}
          {heightFt != null && (
            <div className="case-card-detail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="12" y1="2" x2="12" y2="22"/><polyline points="17 7 12 2 7 7"/><polyline points="7 17 12 22 17 17"/>
              </svg>
              <span>Height: {formatHeight(heightFt)}</span>
            </div>
          )}
        </div>

        <div className="case-card-footer">
          <span className={`case-tag ${status}`}>
            {TYPE_LABEL[status]}
          </span>
          {onClick && (
            <button
              className="case-card-view-btn"
              onClick={e => { e.stopPropagation(); onClick(); }}
              aria-label={`View full details for ${name}`}
            >
              View Details
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
