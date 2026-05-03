'use client';

import { useState, useMemo } from 'react';
import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { CaseCard, type CaseData, type CaseStatus, formatHeight } from '@/src/components/CaseCard';
import { CaseGridSkeleton } from '@/src/components/CaseCardSkeleton';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { useCases } from '@/src/hooks/useCases';
import type { ApiCase } from '@/src/lib/api';
import '../../css/browse.css';

/* ── 128 Baguio City barangays ─────────────────────────────── */
const BARANGAYS = [
  'Abanao-Zandueta-Kayong-Chugum-Otek', 'Alfonso Tabora', 'Ambiong', 'Andres Bonifacio',
  'Asin Road', 'Atok Trail', 'Aurora Hill Proper', 'Aurora Hill North Central',
  'Aurora Hill South Central', 'Bagong Lipunan', 'Bakakeng Central', 'Bakakeng North',
  'Bal-Marcoville', 'Balsigan', 'Banao-Kristong Hari', 'Bayan Park East',
  'Bayan Park Village', 'Bayan Park West', 'BGH Compound', 'Brookside',
  'Brookspoint', 'Cabinet Hill-Teacher\'s Camp', 'Camdas Subdivision', 'Camp 7',
  'Camp 8', 'Camp Allen', 'Campo Filipino', 'City Camp Central', 'City Camp Proper',
  'Country Club Village', 'Cresencia Village', 'Dagsian Lower', 'Dagsian Upper',
  'Dizon Subdivision', 'Dominican Hill-Mirador', 'Dontogan', 'DPS Area',
  'Engineers Hill', 'Fairview Village', 'Ferdinand', 'Fort del Pilar',
  'Gabriela Silang', 'General Luna Road', 'Gibraltar', 'Greenwater Village',
  'Guisad Central', 'Guisad Sorong', 'Happy Hollow', 'Happy Homes-Campo Sioco',
  'Harrison Road Central', 'Holy Ghost Extension', 'Holy Ghost Proper',
  'Honeymoon (Honeymoon Road)', 'House of Providence', 'Imelda R. Marcos',
  'Imelda Village', 'Irisan', 'Kabayanihan', 'Kagitingan', 'Kayang Extension',
  'Kayang-Hilltop', 'Kias', 'Legarda-Burnham-Kisad', 'Loakan Proper',
  'Lopez Jaena', 'Lourdes Subdivision Extension', 'Lourdes Subdivision Proper',
  'Lower Dagsian', 'Lower Magsaysay', 'Lower Rock Quarry', 'Lualhati',
  'Lucnab', 'Magsaysay Private Road', 'Magsaysay Lower', 'Magsaysay Upper',
  'Malcolm Square-Perfecto', 'Manuel A. Roxas', 'Market Subdivision Upper',
  'Middle Quezon Hill', 'Middle Rock Quarry', 'Military Cut-off', 'Mines View Park',
  'Modern Site East', 'Modern Site West', 'MRR-Queen of Peace', 'New Lucban',
  'Naguilian Road', 'Outlook Drive', 'Pacdal', 'Padre Burgos', 'Padre Zamora',
  'Palma-Urbano', 'Pinsao Pilot Project', 'Pinsao Proper', 'Poliwes', 'Pucsusan',
  'Quezon Hill Proper', 'Quezon Hill Upper', 'Quirino Hill East', 'Quirino Hill Lower',
  'Quirino Hill Middle', 'Quirino Hill West', 'Quirino-Magsaysay-Prieto-Dizon',
  'Rizal Monument Area', 'Rock Quarry Lower', 'Rock Quarry Middle', 'Rock Quarry Upper',
  'Roxas-Trinidad-Montilla', 'Sagpat', 'Saint Joseph Village', 'Salud Mitra',
  'San Antonio Village', 'San Luis Village', 'San Roque Village', 'San Vicente',
  'Sanitary Camp North', 'Sanitary Camp South', 'Santa Escolastica', 'Santo Rosario',
  'Santo Tomas Proper', 'Santo Tomas School Area', 'Scout Barrio', 'Session Road Area',
  'Slaughter House Area', 'SLU-SVP Housing Village', 'South Drive', 'Teodora Alonzo',
  'Trancoville', 'Upper Dagsian', 'Upper Magsaysay', 'Upper Market Subdivision',
  'Upper QM', 'Upper Rock Quarry', 'Victoria Village',
].sort();

/* ── Filter state type ─────────────────────────────────────── */
interface Filters {
  toggle: CaseStatus | 'all';
  search: string;
  barangay: string;
  ageRange: 'all' | 'children' | 'teens' | 'adults';
  genderMale: boolean;
  genderFemale: boolean;
}

const DEFAULT_FILTERS: Filters = {
  toggle: 'all',
  search: '',
  barangay: '',
  ageRange: 'all',
  genderMale: true,
  genderFemale: true,
};

/* ── Case Detail Modal ─────────────────────────────────────── */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

const STATUS_LABEL: Record<CaseStatus, string> = {
  missing:      'Missing Person',
  unidentified: 'Unidentified Person',
  found:        'Case Resolved',
};

const STATUS_COLOR: Record<CaseStatus, string> = {
  missing:      '#c0392b',
  unidentified: '#d35400',
  found:        '#1e8449',
};

/* Match the exact field labels used in the report form */
function getDateLabel(rawStatus: string): string {
  if (rawStatus === 'FOUND' || rawStatus === 'IDENTIFIED') return 'Date Reported';
  return rawStatus === 'UNIDENTIFIED' ? 'Date Found' : 'Date Last Seen';
}

function getLocationLabel(rawStatus: string): string {
  return rawStatus === 'UNIDENTIFIED' ? 'Found at Location' : 'Specific Location / Landmark';
}

function getBarangayLabel(rawStatus: string): string {
  return rawStatus === 'UNIDENTIFIED' ? 'Found in Barangay' : 'Last Seen Barangay';
}

function getAgeLabel(rawStatus: string): string {
  return rawStatus === 'UNIDENTIFIED' ? 'Estimated Age Range' : 'Age';
}

function CaseDetailModal({
  data,
  onClose,
}: {
  data: CaseData & { _raw: ApiCase };
  onClose: () => void;
}) {
  const { name, barangay, age, gender, lastSeen, status, imageUrl,
          location, description, heightFt, reporterName, reporterContact, caseType } = data;
  const raw = data._raw;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  /* Close on Escape */
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (lightboxOpen) { setLightboxOpen(false); return; }
      onClose();
    }
  };

  const isResolved = raw.status === 'FOUND' || raw.status === 'IDENTIFIED';

  /* Form-matching labels based on the actual DB status */
  const dateLabel     = getDateLabel(raw.status);
  const locationLabel = getLocationLabel(raw.status);
  const barangayLabel = getBarangayLabel(raw.status);
  const ageLabel      = getAgeLabel(raw.status);
  const ageDisplay    = raw.type === 'UNIDENTIFIED' && raw.age_range_min && raw.age_range_max
    ? `${raw.age_range_min}–${raw.age_range_max} yrs`
    : `${age} yrs`;

  return (
    <div
      className="case-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Case details: ${name}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKey}
    >
      {/* Lightbox */}
      {lightboxOpen && imageUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Full size photo"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Close photo"
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px', color: '#fff', width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '1.1rem',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Full size photo of ${name}`}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '92vw', maxHeight: '88vh',
              objectFit: 'contain',
              borderRadius: '10px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      )}
      <div className="case-modal">
        {/* Header */}
        <div className="case-modal-header">
          <div className="case-modal-header-left">
            <span
              className="case-modal-status-pill"
              style={{ background: `${STATUS_COLOR[status]}18`, color: STATUS_COLOR[status] }}
            >
              {STATUS_LABEL[status]}
            </span>
            <h2 className="case-modal-title">{name}</h2>
          </div>
          <button className="case-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="case-modal-body">
          {/* Photo */}
          <div className="case-modal-photo-wrap">
            {imageUrl ? (
              <button
                onClick={() => setLightboxOpen(true)}
                aria-label="View photo full size"
                style={{ padding: 0, border: 'none', background: 'none', display: 'block', cursor: 'zoom-in', width: '100%' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={`Photo of ${name}`} className="case-modal-photo" />
              </button>
            ) : (
              <div className="case-modal-photo-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>No photo available</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="case-modal-details">

            {/* Section: Case Information */}
            <div className="case-modal-section">
              <h3 className="case-modal-section-title">Case Information</h3>
              <div className="case-modal-fields">
                <div className="case-modal-field">
                  <span className="case-modal-field-label">Report Type</span>
                  <span className="case-modal-field-value">
                    {caseType === 'MISSING' ? 'Missing Person Report' : 'Unidentified Person Report'}
                  </span>
                </div>
                <div className="case-modal-field">
                  <span className="case-modal-field-label">Status</span>
                  <span className="case-modal-field-value" style={{ color: STATUS_COLOR[status], fontWeight: 700 }}>
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <div className="case-modal-field">
                  <span className="case-modal-field-label">
                    {caseType === 'MISSING' ? 'Full Name' : 'Name (if known)'}
                  </span>
                  <span className="case-modal-field-value">{name}</span>
                </div>
                <div className="case-modal-field">
                  <span className="case-modal-field-label">{ageLabel} / Gender</span>
                  <span className="case-modal-field-value">{ageDisplay} · {gender}</span>
                </div>
                {heightFt != null && (
                  <div className="case-modal-field">
                    <span className="case-modal-field-label">Height</span>
                    <span className="case-modal-field-value">{formatHeight(heightFt)}</span>
                  </div>
                )}
                <div className="case-modal-field">
                  <span className="case-modal-field-label">{barangayLabel}</span>
                  <span className="case-modal-field-value">{barangay || '—'}</span>
                </div>
                <div className="case-modal-field">
                  <span className="case-modal-field-label">{locationLabel}</span>
                  <span className="case-modal-field-value">{location || '—'}</span>
                </div>
                <div className="case-modal-field">
                  <span className="case-modal-field-label">{dateLabel}</span>
                  <span className="case-modal-field-value">{formatDate(lastSeen)}</span>
                </div>
              </div>
            </div>

            {/* Section: Physical Description */}
            {description && (
              <div className="case-modal-section">
                <h3 className="case-modal-section-title">Physical Description</h3>
                <p className="case-modal-description">{description}</p>
              </div>
            )}

            {/* Section: Resolution Details — shown when found/identified */}
            {isResolved && (
              <div className="case-modal-section case-modal-resolution-section"
                style={{ background: raw.status === 'FOUND' ? 'rgba(39,174,96,0.05)' : 'rgba(52,152,219,0.05)',
                  border: `1px solid ${raw.status === 'FOUND' ? 'rgba(39,174,96,0.2)' : 'rgba(52,152,219,0.2)'}`,
                  borderRadius: 10, padding: '0.85rem 1rem' }}>
                <h3 className="case-modal-section-title" style={{ color: raw.status === 'FOUND' ? '#1e8449' : '#2980b9' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  {raw.status === 'FOUND' ? 'Case Resolved — Person Found' : 'Case Resolved — Person Identified'}
                </h3>
                <div className="case-modal-fields">
                  {raw.status === 'IDENTIFIED' && raw.identified_name && (
                    <div className="case-modal-field" style={{ gridColumn: '1 / -1' }}>
                      <span className="case-modal-field-label">Identified As</span>
                      <span className="case-modal-field-value" style={{ fontWeight: 700, fontSize: '0.95rem' }}>{raw.identified_name}</span>
                    </div>
                  )}
                  {raw.resolved_at && (
                    <div className="case-modal-field">
                      <span className="case-modal-field-label">{raw.status === 'FOUND' ? 'Date Found' : 'Date Identified'}</span>
                      <span className="case-modal-field-value">{formatDate(raw.resolved_at)}</span>
                    </div>
                  )}
                  {raw.resolution_notes && (
                    <div className="case-modal-field" style={{ gridColumn: '1 / -1' }}>
                      <span className="case-modal-field-label">Resolution Notes</span>
                      <span className="case-modal-field-value">{raw.resolution_notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section: Contact Information */}
            <div className="case-modal-section case-modal-contact-section">
              <h3 className="case-modal-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Who to Contact
              </h3>
              <p className="case-modal-contact-note">
                {isResolved
                  ? 'This case has been resolved. Contact the reporter or our office if you have additional information.'
                  : 'If you have information about this case, please reach out to the reporter directly or contact our office.'}
              </p>

              {/* Reporter */}
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-light)', marginBottom: '0.4rem' }}>
                  Reporter
                </div>
                <div className="case-modal-fields">
                  <div className="case-modal-field">
                    <span className="case-modal-field-label">Reporter Name</span>
                    <span className="case-modal-field-value">{reporterName || '—'}</span>
                  </div>
                  <div className="case-modal-field">
                    <span className="case-modal-field-label">Contact Number</span>
                    <span className="case-modal-field-value">
                      {reporterContact
                        ? <a href={`tel:${reporterContact}`} className="case-modal-contact-link">{reporterContact}</a>
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Officials */}
              <div style={{
                background: 'rgba(112,21,21,0.04)',
                border: '1px solid rgba(112,21,21,0.1)',
                borderRadius: '8px',
                padding: '0.75rem 0.85rem',
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#701515', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  TUKLAS Office — Baguio City
                </div>
                <div className="case-modal-fields">
                  <div className="case-modal-field">
                    <span className="case-modal-field-label">Mobile / Hotline</span>
                    <span className="case-modal-field-value">
                      <a href="tel:+639XXXXXXXXX" className="case-modal-contact-link" style={{ color: '#701515' }}>
                        +63 9XX-XXX-XXXX
                      </a>
                    </span>
                  </div>
                  <div className="case-modal-field">
                    <span className="case-modal-field-label">Email</span>
                    <span className="case-modal-field-value">
                      <a href="mailto:tuklas@baguio.gov.ph" className="case-modal-contact-link" style={{ color: '#701515' }}>
                        tuklas@baguio.gov.ph
                      </a>
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', margin: '0.5rem 0 0', lineHeight: 1.5 }}>
                  Office hours: Mon–Fri, 8:00 AM – 5:00 PM
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="case-modal-footer">
          <button className="case-modal-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Page component ────────────────────────────────────────── */
export default function BrowsePage() {
  const { cases: rawCases, isLoading, isError } = useCases();

  /* Map API shape → CaseCard shape — keep raw case alongside for modal */
  const cases: (CaseData & { _raw: ApiCase })[] = rawCases.map(c => ({
    id:              c.id,
    name:            c.full_name ?? (c.type === 'UNIDENTIFIED' ? 'Unidentified Person' : 'Unknown'),
    barangay:        c.barangay_name ?? '',
    age:             c.age_approx ?? Math.round(((c.age_range_min ?? 0) + (c.age_range_max ?? 0)) / 2),
    gender:          (c.gender === 'MALE' ? 'Male' : c.gender === 'FEMALE' ? 'Female' : 'Female') as 'Male' | 'Female',
    lastSeen:        c.incident_date ?? c.created_at,
    imageUrl:        c.photo_url ?? undefined,
    status:          c.status === 'FOUND'       ? 'found'
                   : c.status === 'IDENTIFIED'  ? 'found'
                   : c.type   === 'UNIDENTIFIED' ? 'unidentified'
                   : 'missing' as CaseStatus,
    verification:    'verified' as const,
    location:        c.location_text ?? undefined,
    description:     c.description ?? undefined,
    heightFt:        c.height_ft ?? undefined,
    reporterName:    c.reporter_name ?? undefined,
    reporterContact: c.reporter_contact ?? undefined,
    caseType:        c.type,
    _raw:            c,
  }));

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeCase, setActiveCase] = useState<(CaseData & { _raw: ApiCase }) | null>(null);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  /* Derived filtered list — memoised for performance */
  const filtered = useMemo(() => {
    return cases.filter(c => {
      if (filters.toggle !== 'all' && c.status !== filters.toggle) return false;
      if (filters.search && !c.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.barangay && c.barangay !== filters.barangay) return false;
      if (filters.ageRange === 'children' && (c.age < 0  || c.age > 12)) return false;
      if (filters.ageRange === 'teens'    && (c.age < 13 || c.age > 19)) return false;
      if (filters.ageRange === 'adults'   && c.age < 20)                  return false;
      if (!filters.genderMale   && c.gender === 'Male')   return false;
      if (!filters.genderFemale && c.gender === 'Female') return false;
      return true;
    });
  }, [cases, filters]);

  const TOGGLES: { label: string; value: Filters['toggle'] }[] = [
    { label: 'All',          value: 'all'          },
    { label: 'Missing',      value: 'missing'      },
    { label: 'Unidentified', value: 'unidentified' },
    { label: 'Found',        value: 'found'        },
  ];

  return (
    <>
      <Navbar />

      {/* ── Case Detail Modal ── */}
      {activeCase && (
        <CaseDetailModal
          data={activeCase}
          onClose={() => setActiveCase(null)}
        />
      )}

      <main className="browse-page">

        {/* ── Header ── */}
        <header className="browse-header">
          <h1>Browse Cases</h1>
          <p>Search and filter missing and unidentified persons in Baguio City</p>

          {/* Toggle */}
          <div className="browse-toggle" role="group" aria-label="Filter by case type">
            {TOGGLES.map(t => (
              <button
                key={t.value}
                className={`browse-toggle-btn${filters.toggle === t.value ? ' active' : ''}`}
                onClick={() => set('toggle', t.value)}
                aria-pressed={filters.toggle === t.value}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Layout ── */}
        <div className="browse-layout">

          {/* ── Sidebar ── */}
          <aside className="browse-sidebar" aria-label="Filters">
            <h2 className="sidebar-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filters
            </h2>

            {/* Search */}
            <div className="filter-group">
              <span className="filter-label">Search Name</span>
              <div className="filter-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Enter name..."
                  value={filters.search}
                  onChange={e => set('search', e.target.value)}
                  aria-label="Search by name"
                />
              </div>
            </div>

            {/* Barangay */}
            <div className="filter-group">
              <span className="filter-label">Barangay</span>
              <select
                className="filter-select"
                value={filters.barangay}
                onChange={e => set('barangay', e.target.value)}
                aria-label="Filter by barangay"
              >
                <option value="">All Barangays</option>
                {BARANGAYS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Age range */}
            <div className="filter-group">
              <span className="filter-label">Age Range</span>
              <div className="filter-options" role="radiogroup" aria-label="Age range">
                {([
                  { value: 'all',      label: 'All Ages'        },
                  { value: 'children', label: 'Children (0–12)' },
                  { value: 'teens',    label: 'Teens (13–19)'   },
                  { value: 'adults',   label: 'Adults (20+)'    },
                ] as const).map(opt => (
                  <label key={opt.value} className="filter-option">
                    <input
                      type="radio"
                      name="ageRange"
                      value={opt.value}
                      checked={filters.ageRange === opt.value}
                      onChange={() => set('ageRange', opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Gender */}
            <div className="filter-group">
              <span className="filter-label">Gender</span>
              <div className="filter-options">
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.genderMale}
                    onChange={e => set('genderMale', e.target.checked)}
                  />
                  Male
                </label>
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.genderFemale}
                    onChange={e => set('genderFemale', e.target.checked)}
                  />
                  Female
                </label>
              </div>
            </div>

            {/* Clear */}
            <button className="filter-clear" onClick={resetFilters}>
              Clear All Filters
            </button>
          </aside>

          {/* ── Gallery ── */}
          <section className="browse-gallery" aria-label="Case results">

            {/* Loading state — shimmer skeletons */}
            {isLoading && <CaseGridSkeleton count={6} />}

            {/* Connection error */}
            {isError && !isLoading && (
              <ErrorBoundary>
                <></>
              </ErrorBoundary>
            )}

            {/* Results meta — only shown when not loading */}
            {!isLoading && !isError && (
              <div className="gallery-meta">
                <p className="gallery-count">
                  Showing <strong>{filtered.length}</strong> of <strong>{cases.length}</strong> cases
                </p>
              </div>
            )}

            {/* Case grid */}
            {!isLoading && !isError && filtered.length > 0 && (
              <div className="case-grid">
                {filtered.map(c => (
                  <CaseCard key={c.id} data={c} onClick={() => setActiveCase(c)} />
                ))}
              </div>
            )}

            {/* Empty state — no cases in DB yet */}
            {!isLoading && !isError && cases.length === 0 && (
              <div className="browse-empty" role="status" aria-live="polite">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
                <h3>No Cases Yet</h3>
                <p>There are currently no published cases in the system. Check back later or submit a report.</p>
              </div>
            )}

            {/* Empty state — filters returned nothing */}
            {!isLoading && !isError && cases.length > 0 && filtered.length === 0 && (
              <div className="browse-empty" role="status" aria-live="polite">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
                <h3>No Cases Found</h3>
                <p>No cases match your current filters. Try adjusting your search criteria.</p>
                <button className="browse-empty-reset" onClick={resetFilters}>
                  Reset Filters
                </button>
              </div>
            )}

          </section>

        </div>
      </main>
      <Footer />
    </>
  );
}
