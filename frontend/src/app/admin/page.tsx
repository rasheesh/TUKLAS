'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { StatCards, type AdminStats } from '../../components/Admin/StatCards';
import { VerificationTable, type PendingCase } from '../../components/Admin/VerificationTable';
import { UserManagement } from '../../components/Admin/UserManagement';
import { ActivityLogs } from '../../components/Admin/ActivityLogs';
import { ImportCasesModal } from '../../components/Admin/ImportCasesModal';
import { PersonIcon } from '../../components/PersonIcon';
import { formatHeight } from '../../components/CaseCard';
import { useAuth } from '../../context/AuthContext';
import { casesApi, profilesApi, authApi, matchesApi, type ApiCase, type AppRole } from '../../lib/api';
import '../../css/Admin.css';
import '../../css/AdminManagement.css';

/* ── Verified cases ─────────────────────────────────────────── */
type CaseStatus = 'active' | 'found' | 'identified';
type CaseType   = 'missing' | 'unidentified';

interface VerifiedCase {
  id: string;
  reference: string;
  name: string;
  type: CaseType;
  gender: string;
  age: string;
  heightFt: number | null;
  barangay: string;
  dateReported: string;
  lastSeen: string;
  status: CaseStatus;
  verifiedBy: string;
  verifiedAt: string;
  /* Extra fields for the detail modal */
  description?: string;
  location?: string;
  photoUrl?: string;
  reporterName?: string;
  reporterContact?: string;
  /* Publish / photo flags */
  published: boolean;
  photoHidden: boolean;
  resolution?: {
    date: string;
    location: string;
    identifiedName?: string;
    contactPerson: string;
    contactNumber: string;
    notes: string;
  };
}

/* ── Match record ───────────────────────────────────────────── */
interface MatchRecord {
  id: string;
  score: number;
  flagged: boolean;
  missingCaseId: string;
  unidentifiedCaseId: string;
  missing: {
    name: string; age: string; gender: string; barangay: string;
    date: string; location: string; description: string; photo: string;
    reporterContact: string;
  };
  unidentified: {
    name: string; age: string; gender: string; barangay: string;
    date: string; location: string; description: string; photo: string;
    reporterContact: string;
  };
  matchReasons: string[];
  distanceKm: number;
}

/* ── Role labels ────────────────────────────────────────────── */
const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN:  'Super Admin',
  SYSTEM_OWNER: 'System Owner',
  ADMIN:        'Admin',
  MODERATOR:    'Moderator',
};

/* ── Nav items ──────────────────────────────────────────────── */
type View = 'overview' | 'queue' | 'database' | 'matches' | 'analytics' | 'users' | 'logs' | 'settings';

const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode; minRole?: 'ADMIN' | 'SUPER_ADMIN' }[] = [
  { id: 'overview',  label: 'Overview',          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { id: 'queue',     label: 'Pending Approval',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { id: 'database',  label: 'Verified Database', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> },
  { id: 'matches',   label: 'Case Matching',     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg> },
  { id: 'analytics', label: 'Analytics & Export', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { id: 'users',     label: 'User Management',   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, minRole: 'ADMIN' as const },
  { id: 'logs',      label: 'Audit Logs',        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, minRole: 'ADMIN' as const },
  { id: 'settings',  label: 'Settings',          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

/* ── Verified Case Detail Modal ─────────────────────────────── */
function VerifiedCaseModal({
  c,
  onClose,
}: {
  c: VerifiedCase;
  onClose: () => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const statusColor = c.status === 'found' ? '#1e8449' : c.status === 'identified' ? '#2980b9' : '#701515';
  const statusLabel = c.status === 'found' ? 'Found' : c.status === 'identified' ? 'Identified' : 'Active';

  return (
    <>
      {lightboxSrc && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Full size photo"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            aria-label="Close photo"
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px', color: '#fff', width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Full size case photo"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}

      <div
        className="mgmt-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={`Case details: ${c.name}`}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="mgmt-modal" style={{ maxWidth: 640 }}>
          <div className="mgmt-modal-header">
            <h2 className="mgmt-modal-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Case Details — {c.name}
            </h2>
            <button className="mgmt-modal-close" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="mgmt-modal-body">
            {/* Photo + status */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              {c.photoUrl ? (
                <div style={{ flexShrink: 0, position: 'relative' }}>
                  <button
                    onClick={() => setLightboxSrc(c.photoUrl!)}
                    aria-label="View photo full size"
                    style={{
                      padding: 0, border: '2px solid transparent', borderRadius: 8,
                      cursor: 'zoom-in', background: 'none', display: 'block',
                      transition: 'border-color 150ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#701515')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.photoUrl}
                      alt={`Photo of ${c.name}`}
                      style={{ width: 100, height: 120, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                    />
                  </button>
                  {c.photoHidden && (
                    <div style={{
                      position: 'absolute', bottom: 4, left: 0, right: 0,
                      background: 'rgba(211,84,0,0.85)', color: '#fff',
                      fontSize: '0.6rem', fontWeight: 700, textAlign: 'center',
                      padding: '2px 4px', borderRadius: '0 0 6px 6px',
                    }}>
                      HIDDEN
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ width: 100, height: 120, borderRadius: 8, border: '1px dashed #d0d0d0', background: '#f8f8f8',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" width="28" height="28" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span style={{ fontSize: '0.65rem', color: '#bbb' }}>No photo</span>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                  <span className={`vtable-type-pill ${c.type}`}>{c.type}</span>
                  <span className="vtable-type-pill" style={{ background: `${statusColor}18`, color: statusColor }}>
                    {statusLabel}
                  </span>
                  {!c.published && (
                    <span className="vtable-type-pill" style={{ background: 'rgba(243,156,18,0.12)', color: '#d35400' }}>
                      Unpublished
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-dark)', marginBottom: '0.2rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                  {c.age} · {c.gender}{c.heightFt != null ? ` · ${formatHeight(c.heightFt)}` : ''} · {c.barangay}
                </div>
              </div>
            </div>

            {/* Case info grid */}
            <div className="admin-modal-details" style={{ marginTop: '0.75rem' }}>
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Date Reported</span>
                <span className="admin-modal-field-value">{c.dateReported}</span>
              </div>
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Last Seen / Incident Date</span>
                <span className="admin-modal-field-value">{c.lastSeen}</span>
              </div>
              {c.location && (
                <div className="admin-modal-field">
                  <span className="admin-modal-field-label">Specific Location</span>
                  <span className="admin-modal-field-value">{c.location}</span>
                </div>
              )}
              {c.heightFt != null && (
                <div className="admin-modal-field">
                  <span className="admin-modal-field-label">Height</span>
                  <span className="admin-modal-field-value">{formatHeight(c.heightFt)}</span>
                </div>
              )}
              {c.description && (
                <div className="admin-modal-field full">
                  <span className="admin-modal-field-label">Physical Description</span>
                  <span className="admin-modal-field-value">{c.description}</span>
                </div>
              )}
            </div>

            {/* Reporter contact — visible to all admin roles */}
            <div className="admin-modal-field full" style={{ background: 'rgba(112,21,21,0.04)', borderRadius: 8, padding: '0.6rem 0.75rem', marginTop: '0.5rem' }}>
              <span className="admin-modal-field-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Reporter Information
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', marginTop: '0.35rem' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)' }}>Name</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-dark)' }}>{c.reporterName || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)' }}>Contact</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-dark)' }}>
                    {c.reporterContact
                      ? <a href={`tel:${c.reporterContact}`} style={{ color: '#701515', textDecoration: 'none' }}>{c.reporterContact}</a>
                      : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Resolution details — shown when found or identified */}
            {c.resolution && c.status !== 'active' && (
              <div style={{ marginTop: '0.75rem', background: c.status === 'found' ? 'rgba(39,174,96,0.06)' : 'rgba(52,152,219,0.06)',
                border: `1px solid ${c.status === 'found' ? 'rgba(39,174,96,0.2)' : 'rgba(52,152,219,0.2)'}`,
                borderRadius: 10, padding: '0.85rem 1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: statusColor, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  {c.status === 'found' ? 'Found — Resolution Details' : 'Identified — Resolution Details'}
                </div>
                <div className="admin-modal-details">
                  {c.status === 'identified' && c.resolution.identifiedName && (
                    <div className="admin-modal-field full">
                      <span className="admin-modal-field-label">Identified Name</span>
                      <span className="admin-modal-field-value" style={{ fontWeight: 700 }}>{c.resolution.identifiedName}</span>
                    </div>
                  )}
                  {c.resolution.date && (
                    <div className="admin-modal-field">
                      <span className="admin-modal-field-label">{c.status === 'found' ? 'Date Found' : 'Date Identified'}</span>
                      <span className="admin-modal-field-value">{c.resolution.date}</span>
                    </div>
                  )}
                  {c.resolution.location && (
                    <div className="admin-modal-field">
                      <span className="admin-modal-field-label">{c.status === 'found' ? 'Where Found' : 'Where Identified'}</span>
                      <span className="admin-modal-field-value">{c.resolution.location}</span>
                    </div>
                  )}
                  {c.resolution.contactPerson && (
                    <div className="admin-modal-field">
                      <span className="admin-modal-field-label">Contact Person</span>
                      <span className="admin-modal-field-value">{c.resolution.contactPerson}</span>
                    </div>
                  )}
                  {c.resolution.contactNumber && (
                    <div className="admin-modal-field">
                      <span className="admin-modal-field-label">Contact Number</span>
                      <span className="admin-modal-field-value">{c.resolution.contactNumber}</span>
                    </div>
                  )}
                  {c.resolution.notes && (
                    <div className="admin-modal-field full">
                      <span className="admin-modal-field-label">Notes</span>
                      <span className="admin-modal-field-value">{c.resolution.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mgmt-modal-footer">
            <button type="button" className="mgmt-btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Resolution Modal ───────────────────────────────────────── */
interface ResolutionForm {
  date: string;
  location: string;
  identifiedName: string;
  contactPerson: string;
  contactNumber: string;
  notes: string;
}

function ResolutionModal({
  caseData,
  onClose,
  onConfirm,
}: {
  caseData: VerifiedCase;
  onClose: () => void;
  onConfirm: (form: ResolutionForm) => void;
}) {
  const isMissing = caseData.type === 'missing';
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<ResolutionForm>({
    date: today,
    location: '',
    identifiedName: '',
    contactPerson: '',
    contactNumber: '',
    notes: '',
  });

  function set(k: keyof ResolutionForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(form);
    onClose();
  }

  return (
    <div
      className="mgmt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Resolution details for ${caseData.name}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mgmt-modal">
        <div className="mgmt-modal-header">
          <h2 className="mgmt-modal-title">
            {isMissing ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Mark as Found
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M6 10h2m-2 4h10"/></svg>
                Mark as Identified
              </>
            )}
          </h2>
          <button className="mgmt-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mgmt-modal-body">

            {/* Case context — read-only */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e8eaed', marginBottom: '0.25rem' }}>
              <span className={`vtable-type-pill ${caseData.type}`}>{caseData.type}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{caseData.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{caseData.barangay} · {caseData.age} · {caseData.gender}</div>
              </div>
            </div>

            {/* Identified name — only for unidentified cases */}
            {!isMissing && (
              <div className="mgmt-form-group full">
                <label className="mgmt-form-label" htmlFor="res-id-name">
                  Identified Name <span style={{ color: '#701515' }}>*</span>
                </label>
                <input
                  id="res-id-name"
                  className="mgmt-form-input"
                  type="text"
                  value={form.identifiedName}
                  onChange={set('identifiedName')}
                  placeholder="Full name of the identified person"
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Date + Location */}
            <div className="mgmt-form-row">
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="res-date">
                  {isMissing ? 'Date Found' : 'Date Identified'} <span style={{ color: '#701515' }}>*</span>
                </label>
                <input
                  id="res-date"
                  className="mgmt-form-input"
                  type="date"
                  value={form.date}
                  onChange={set('date')}
                  max={today}
                  required
                  autoFocus={isMissing}
                />
              </div>
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="res-location">
                  {isMissing ? 'Where Found' : 'Where Identified'} <span style={{ color: '#701515' }}>*</span>
                </label>
                <input
                  id="res-location"
                  className="mgmt-form-input"
                  type="text"
                  value={form.location}
                  onChange={set('location')}
                  placeholder="e.g. Burnham Park, Session Road"
                  required
                />
              </div>
            </div>

            {/* Contact person + number */}
            <div className="mgmt-form-row">
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="res-contact-name">
                  Contact Person <span style={{ color: '#701515' }}>*</span>
                </label>
                <input
                  id="res-contact-name"
                  className="mgmt-form-input"
                  type="text"
                  value={form.contactPerson}
                  onChange={set('contactPerson')}
                  placeholder="Name of person who reported"
                  required
                />
              </div>
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="res-contact-num">
                  Contact Number <span style={{ color: '#701515' }}>*</span>
                </label>
                <input
                  id="res-contact-num"
                  className="mgmt-form-input"
                  type="text"
                  value={form.contactNumber}
                  onChange={set('contactNumber')}
                  placeholder="09XX-XXX-XXXX"
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mgmt-form-group full">
              <label className="mgmt-form-label" htmlFor="res-notes">Additional Notes</label>
              <textarea
                id="res-notes"
                className="mgmt-form-input"
                value={form.notes}
                onChange={set('notes')}
                placeholder="Any additional details about how the case was resolved…"
                rows={3}
                style={{ resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

          </div>

          <div className="mgmt-modal-footer">
            <button type="button" className="mgmt-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="mgmt-btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {isMissing ? 'Confirm Found' : 'Confirm Identified'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Match Confirm Modal ────────────────────────────────────── */
function MatchConfirmModal({
  match,
  today,
  onClose,
  onConfirm,
}: {
  match: MatchRecord;
  today: string;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(notes);
    onClose();
  }

  return (
    <div
      className="mgmt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm case match"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mgmt-modal" style={{ maxWidth: 560 }}>
        <div className="mgmt-modal-header">
          <h2 className="mgmt-modal-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Confirm Match &amp; Resolve Cases
          </h2>
          <button className="mgmt-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mgmt-modal-body">

            {/* Case pair summary */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.65rem 0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e8eaed', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#701515', marginBottom: '0.2rem' }}>Missing Person</div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{match.missing.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{match.missing.barangay} · {match.missing.age} · {match.missing.gender}</div>
              </div>
              <div style={{ color: '#27ae60', fontWeight: 700, fontSize: '1.2rem' }}>↔</div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#d35400', marginBottom: '0.2rem' }}>Unidentified Person</div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{match.unidentified.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{match.unidentified.barangay} · {match.unidentified.age} · {match.unidentified.gender}</div>
              </div>
            </div>

            {/* What will happen */}
            <div style={{ background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.2)', borderRadius: 8, padding: '0.65rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.8rem', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: '#1e8449', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                What will happen:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-text-dark)' }}>
                <li><strong>{match.missing.name}</strong> will be marked as <strong>Found</strong></li>
                <li><strong>{match.unidentified.name}</strong> will be marked as <strong>Identified</strong> (as {match.missing.name})</li>
                <li>Both cases will be resolved and removed from the active queue</li>
              </ul>
              <div style={{ marginTop: '0.5rem', color: '#c0392b', fontWeight: 600, fontSize: '0.75rem' }}>
                ⚠ This action cannot be undone.
              </div>
            </div>

            {/* Resolution notes */}
            <div className="mgmt-form-group full">
              <label className="mgmt-form-label" htmlFor="match-confirm-notes">
                Resolution Notes <span style={{ color: 'var(--color-text-light)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="match-confirm-notes"
                className="mgmt-form-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Family confirmed identity via photo, DNA match confirmed, etc."
                rows={3}
                style={{ resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

          </div>

          <div className="mgmt-modal-footer">
            <button type="button" className="mgmt-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="mgmt-btn-primary" style={{ background: '#27ae60' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Confirm &amp; Resolve Both Cases
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Settings Panel — personal account only ────────────────── */
function SettingsPanel({ session }: { session: { id: string; name: string; email: string; role: AppRole } | null }) {
  const nameParts = (session?.name ?? 'Admin User').split(' ');
  const firstName  = nameParts[0] ?? 'Admin';
  const lastName   = nameParts.slice(1).join(' ') || 'User';
  const email      = session?.email ?? '—';
  const employeeId = session?.id ? session.id.slice(0, 8).toUpperCase() : '—';
  const roleLabel  = ROLE_LABELS[session?.role ?? 'MODERATOR'];

  const [pw, setPw]               = useState({ current: '', next: '', confirm: '' });
  const [pwSaved, setPwSaved]     = useState(false);
  const [pwError, setPwError]     = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  async function handlePwSave(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (!pw.current)             { setPwError('Enter your current password.'); return; }
    if (pw.next.length < 8)      { setPwError('New password must be at least 8 characters.'); return; }
    if (pw.next !== pw.confirm)  { setPwError('New passwords do not match.'); return; }

    setPwLoading(true);
    try {
      await authApi.changePassword(pw.current.trim(), pw.next.trim());
      setPw({ current: '', next: '', confirm: '' });
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401) {
        setPwError('Current password is incorrect.');
      } else {
        setPwError('Failed to update password. Please try again.');
      }
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="settings-grid">

      {/* ── Profile card — read-only ── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <h3 className="settings-card-title">Personal Information</h3>
            <p className="settings-card-sub">Your profile information is managed by your administrator.</p>
          </div>
        </div>
        <div className="settings-form">
          <div className="mgmt-form-row">
            <div className="mgmt-form-group">
              <span className="mgmt-form-label">First Name</span>
              <div className="settings-readonly-field">{firstName}</div>
            </div>
            <div className="mgmt-form-group">
              <span className="mgmt-form-label">Last Name</span>
              <div className="settings-readonly-field">{lastName}</div>
            </div>
          </div>
          <div className="mgmt-form-group full">
            <span className="mgmt-form-label">Email Address</span>
            <div className="settings-readonly-field">{email}</div>
          </div>
          <div className="mgmt-form-row">
            <div className="mgmt-form-group">
              <span className="mgmt-form-label">Employee ID</span>
              <div className="settings-readonly-field">{employeeId}</div>
            </div>
            <div className="mgmt-form-group">
              <span className="mgmt-form-label">Role</span>
              <div className="settings-readonly-field">{roleLabel}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Password card ── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <h3 className="settings-card-title">Change Password</h3>
            <p className="settings-card-sub">Only you can change your own password.</p>
          </div>
        </div>
        <form onSubmit={handlePwSave} className="settings-form">
          <div className="mgmt-form-group full">
            <label className="mgmt-form-label" htmlFor="s-pw-cur">Current Password</label>
            <input id="s-pw-cur" className="mgmt-form-input" type="password" value={pw.current}
              onChange={e => { setPw(p => ({ ...p, current: e.target.value })); setPwError(''); }}
              placeholder="Enter current password" autoComplete="current-password" />
          </div>
          <div className="mgmt-form-row">
            <div className="mgmt-form-group">
              <label className="mgmt-form-label" htmlFor="s-pw-new">New Password</label>
              <input id="s-pw-new" className={`mgmt-form-input${pwError ? ' mgmt-input-error' : ''}`} type="password"
                value={pw.next} onChange={e => { setPw(p => ({ ...p, next: e.target.value })); setPwError(''); }}
                placeholder="Min. 8 characters" autoComplete="new-password" />
            </div>
            <div className="mgmt-form-group">
              <label className="mgmt-form-label" htmlFor="s-pw-confirm">Confirm New Password</label>
              <input id="s-pw-confirm" className={`mgmt-form-input${pwError ? ' mgmt-input-error' : ''}`} type="password"
                value={pw.confirm} onChange={e => { setPw(p => ({ ...p, confirm: e.target.value })); setPwError(''); }}
                placeholder="Re-enter new password" autoComplete="new-password" />
            </div>
          </div>
          {pwError && <p style={{ fontSize: '0.75rem', color: '#e74c3c', fontWeight: 600, margin: '0' }} role="alert">{pwError}</p>}
          <div className="settings-form-footer">
            {pwSaved && (
              <span className="settings-saved-msg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                Password successfully updated
              </span>
            )}
            <button type="submit" className="mgmt-btn-primary" disabled={pwLoading}>
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Account info (read-only) ── */}
      <div className="settings-card settings-card-readonly">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <h3 className="settings-card-title">Account Information</h3>
            <p className="settings-card-sub">Read-only. Contact a Super Admin to change your access level.</p>
          </div>
        </div>
        <div className="settings-info-rows">
          {[
            { label: 'Access Level',   value: ROLE_LABELS[session?.role ?? 'MODERATOR'] },
            { label: 'Account Status', value: 'Active' },
            { label: 'Member Since',   value: 'January 15, 2023' },
            { label: 'Last Login',     value: 'May 10, 2024 at 08:00' },
          ].map(r => (
            <div key={r.label} className="settings-info-row">
              <span className="settings-info-label">{r.label}</span>
              <span className="settings-info-value">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export default function AdminPage() {
  /* ── Session / auth — from real AuthContext ─────────────── */
  const { user: session, loading: authLoading, logout, hasRole } = useAuth();
  const authChecked = !authLoading;

  /* Derive role — falls back to most restrictive */
  const currentRole: AppRole = session?.role ?? 'MODERATOR';

  /* ── UI state ───────────────────────────────────────────── */
  const [view, setView]             = useState<View>('overview');
  const [queue, setQueue]           = useState<PendingCase[]>([]);
  const [verifiedCases, setVerifiedCases] = useState<VerifiedCase[]>([]);
  const [searchQuery, setSearch]    = useState('');
  const [hasAlerts]                 = useState(true);
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'info'; undoId?: string } | null>(null);
  const [resolutionTarget, setResolutionTarget] = useState<VerifiedCase | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [matches, setMatches]             = useState<MatchRecord[]>([]);
  const [flagged, setFlagged]             = useState<Set<string>>(new Set());
  const [confirmMatchId, setConfirmMatchId] = useState<string | null>(null);
  const [matchConfirmTarget, setMatchConfirmTarget] = useState<MatchRecord | null>(null);
  /* Database filters */
  const [dbSearch,  setDbSearch]  = useState('');
  const [dbType,    setDbType]    = useState<'all' | 'missing' | 'unidentified'>('all');
  const [dbStatus,  setDbStatus]  = useState<'all' | 'active' | 'found' | 'identified'>('all');
  const [dbGender,  setDbGender]  = useState<'all' | 'Male' | 'Female'>('all');
  const [dbViewCase, setDbViewCase] = useState<VerifiedCase | null>(null);
  const [showImport, setShowImport] = useState(false);

  /* ── Fetch pending queue on mount and when view changes ─── */
  useEffect(() => {
    if (!authChecked || !session) return;
    casesApi.getPending()
      .then(r => {
        const mapped: PendingCase[] = r.cases.map(c => ({
          id:              c.id,
          reference:       c.case_reference ?? '',
          submittedAt:     c.created_at,
          type:            c.type.toLowerCase() as 'missing' | 'unidentified',
          name:            c.full_name ?? 'Unknown',
          approximateAge:  c.age_approx?.toString()
                           ?? (c.age_range_min && c.age_range_max
                               ? `${c.age_range_min}–${c.age_range_max}`
                               : '—'),
          heightFt:        c.height_ft ?? null,
          gender:          c.gender === 'MALE' ? 'Male' : c.gender === 'FEMALE' ? 'Female' : 'Unknown',
          barangay:        c.barangay_name ?? '',
          location:        c.location_text ?? '',
          description:     c.description ?? '',
          reporterName:    c.reporter_name ?? '—',
          reporterContact: c.reporter_contact ?? '—',
          photos:          c.photo_url ? [c.photo_url] : [],
          /* New proof/verification fields */
          trustLevel:      (c.trust_level as 'HIGH' | 'MEDIUM' | 'LOW') ?? 'LOW',
          sourceLink:      c.source_link ?? null,
          proofDocuments:  c.proof_documents ?? [],
          claimedBy:       c.claimed_by ?? null,
          claimedAt:       c.claimed_at ?? null,
          isMinor:         c.is_minor ?? false,
        }));
        setQueue(mapped);
      })
      .catch(err => console.error('[Admin] Failed to load queue:', err.message));
  }, [authChecked, session]);

  /* ── Fetch verified cases on mount ─────────────────────── */
  useEffect(() => {
    if (!authChecked || !session) return;
    casesApi.getVerified()
      .then(r => {
        const mapped: VerifiedCase[] = r.cases.map(c => ({
          id:              c.id,
          reference:       c.case_reference ?? '',
          name:            c.full_name ?? 'Unknown',
          type:            c.type.toLowerCase() as 'missing' | 'unidentified',
          gender:          c.gender === 'MALE' ? 'Male' : c.gender === 'FEMALE' ? 'Female' : 'Unknown',
          age:             c.age_approx?.toString()
                           ?? (c.age_range_min && c.age_range_max
                               ? `${c.age_range_min}–${c.age_range_max}`
                               : '—'),
          heightFt:        c.height_ft ?? null,
          barangay:        c.barangay_name ?? '',
          dateReported:    c.created_at.slice(0, 10),
          lastSeen:        c.incident_date ?? c.created_at.slice(0, 10),
          status:          c.status === 'FOUND'       ? 'found'
                         : c.status === 'IDENTIFIED'  ? 'identified'
                         : 'active',
          verifiedBy:      '',
          verifiedAt:      '',
          description:     c.description ?? undefined,
          location:        c.location_text ?? undefined,
          photoUrl:        c.photo_url ?? undefined,
          reporterName:    c.reporter_name ?? undefined,
          reporterContact: c.reporter_contact ?? undefined,
          published:       c.published ?? false,
          photoHidden:     c.photo_hidden ?? false,
          /* Populate resolution from API fields when case is resolved */
          resolution:      (c.status === 'FOUND' || c.status === 'IDENTIFIED') && c.resolved_at
            ? {
                date:            c.resolved_at.slice(0, 10),
                location:        '',   // not stored separately — shown via notes
                identifiedName:  c.identified_name ?? undefined,
                contactPerson:   '',
                contactNumber:   '',
                notes:           c.resolution_notes ?? '',
              }
            : undefined,
        }));
        setVerifiedCases(mapped);
      })
      .catch(err => console.error('[Admin] Failed to load verified cases:', err.message));
  }, [authChecked, session]);

  /* ── Fetch match suggestions on mount ───────────────────── */
  useEffect(() => {
    if (!authChecked || !session) return;
    matchesApi.getMatches()
      .then(r => {
        const mapped: MatchRecord[] = r.matches.map(m => ({
          id:                 m.id,
          score:              m.score,
          distanceKm:         m.distanceKm ?? 0,
          matchReasons:       m.matchReasons,
          flagged:            m.flagged ?? false,
          missingCaseId:      m.missingCaseId,
          unidentifiedCaseId: m.unidentifiedCaseId,
          missing:            m.missing,
          unidentified:       m.unidentified,
        }));
        setMatches(mapped);
      })
      .catch(err => console.error('[Admin] Failed to load matches:', err.message));
  }, [authChecked, session]);

  /* Derived stats — computed from live state */
  const stats: AdminStats = useMemo(() => ({
    pending:      queue.length,
    missing:      verifiedCases.filter(c => c.type === 'missing' && c.status === 'active').length,
    unidentified: verifiedCases.filter(c => c.type === 'unidentified' && c.status === 'active').length,
    found:        verifiedCases.filter(c => c.status === 'found' || c.status === 'identified').length,
  }), [queue, verifiedCases]);

  /* Approve — call API then move from queue to verified list */
  function handleApprove(id: string) {
    casesApi.updateStatus(id, 'VERIFIED')
      .then(({ case: updatedCase }) => {
        // Remove from pending queue
        setQueue(q => q.filter(c => c.id !== id));
        // Add to verified cases list immediately
        const newVerified: VerifiedCase = {
          id:              updatedCase.id,
          reference:       updatedCase.case_reference ?? '',
          name:            updatedCase.full_name ?? 'Unknown',
          type:            updatedCase.type.toLowerCase() as 'missing' | 'unidentified',
          gender:          updatedCase.gender === 'MALE' ? 'Male' : updatedCase.gender === 'FEMALE' ? 'Female' : 'Unknown',
          age:             updatedCase.age_approx?.toString()
                           ?? (updatedCase.age_range_min && updatedCase.age_range_max
                               ? `${updatedCase.age_range_min}–${updatedCase.age_range_max}`
                               : '—'),
          heightFt:        updatedCase.height_ft ?? null,
          barangay:        updatedCase.barangay_name ?? '',
          dateReported:    updatedCase.created_at.slice(0, 10),
          lastSeen:        updatedCase.incident_date ?? updatedCase.created_at.slice(0, 10),
          status:          'active',
          verifiedBy:      '',
          verifiedAt:      new Date().toISOString(),
          description:     updatedCase.description ?? undefined,
          location:        updatedCase.location_text ?? undefined,
          photoUrl:        updatedCase.photo_url ?? undefined,
          reporterName:    updatedCase.reporter_name ?? undefined,
          reporterContact: updatedCase.reporter_contact ?? undefined,
          published:       updatedCase.published ?? false,
          photoHidden:     updatedCase.photo_hidden ?? false,
        };
        setVerifiedCases(cs => [newVerified, ...cs]);
        showToast(`Case approved and published.`, 'success');
      })
      .catch(err => showToast(`Approval failed: ${err.message}`, 'info'));
  }

  /* Reject — call API then remove from local queue */
  function handleReject(id: string) {
    casesApi.updateStatus(id, 'REJECTED')
      .then(() => setQueue(q => q.filter(c => c.id !== id)))
      .catch(err => showToast(`Rejection failed: ${err.message}`, 'info'));
  }

  /* Claim — lock the case for review by this admin */
  function handleClaim(id: string) {
    casesApi.claimCase(id)
      .then(({ adminId }) => {
        setQueue(q => q.map(c =>
          c.id === id ? { ...c, claimedBy: adminId, claimedAt: new Date().toISOString() } : c
        ));
        showToast('Case claimed — others will see it is under review.', 'info');
      })
      .catch(err => showToast(`Claim failed: ${err.message}`, 'info'));
  }

  /* Release — free the claim so others can review */
  function handleRelease(id: string) {
    casesApi.releaseCase(id)
      .then(() => {
        setQueue(q => q.map(c =>
          c.id === id ? { ...c, claimedBy: null, claimedAt: null } : c
        ));
        showToast('Claim released.', 'info');
      })
      .catch(err => showToast(`Release failed: ${err.message}`, 'info'));
  }

  /* Publish — make case visible in public view */
  function handlePublish(id: string) {
    casesApi.publish(id)
      .then(({ case: updated }) => {
        setVerifiedCases(cs => cs.map(c =>
          c.id === id ? { ...c, published: updated.published ?? true } : c
        ));
        showToast('Case published to public view.', 'success');
      })
      .catch(err => showToast(`Publish failed: ${err.message}`, 'info'));
  }

  /* Toggle photo visibility */
  function handleTogglePhoto(id: string, currentlyHidden: boolean) {
    casesApi.togglePhoto(id, currentlyHidden)
      .then(({ case: updated }) => {
        /*
         * Use the explicit photo_hidden value from the server response.
         * The server always returns the confirmed new state — either from
         * the DB update result or from the client-supplied fallback.
         * Only fall back to local inversion if the server somehow omits it.
         */
        const newHidden = updated.photo_hidden !== undefined
          ? updated.photo_hidden
          : !currentlyHidden;

        setVerifiedCases(cs => cs.map(c =>
          c.id === id ? { ...c, photoHidden: newHidden } : c
        ));
        showToast(
          newHidden ? 'Photo hidden from public view.' : 'Photo is now visible.',
          'info'
        );
      })
      .catch(err => showToast(`Failed: ${err.message}`, 'info'));
  }

  /* Shared toast helper */
  function showToast(msg: string, type: 'success' | 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  /* ── Match actions ── */

  /* Not a Match — dismiss the pair */
  function dismissMatch(id: string) {
    matchesApi.dismiss(id).catch(err => console.error('[Admin] Dismiss failed:', err.message));
    setMatches(ms => ms.filter(m => m.id !== id));
    if (expandedMatch === id) setExpandedMatch(null);
    showToast('Match dismissed — pair removed from queue.', 'info');
  }

  /* Flag for Review — toggle yellow badge + persist */
  function flagMatch(id: string) {
    const m = matches.find(x => x.id === id);
    if (!m) return;
    const nowFlagged = !m.flagged;
    /* Optimistic update */
    setMatches(ms => ms.map(x => x.id === id ? { ...x, flagged: nowFlagged } : x));
    /* Persist */
    (nowFlagged ? matchesApi.flag(id) : matchesApi.unflag(id))
      .catch(err => {
        /* Revert on failure */
        setMatches(ms => ms.map(x => x.id === id ? { ...x, flagged: !nowFlagged } : x));
        showToast(`Flag failed: ${err.message}`, 'info');
      });
    showToast(nowFlagged ? 'Match flagged for second opinion.' : 'Flag removed.', 'info');
  }

  /* Confirm Match — open resolution form instead of immediately confirming */
  function openConfirmMatch(id: string) {
    const m = matches.find(x => x.id === id);
    if (!m) return;
    setMatchConfirmTarget(m);
    setConfirmMatchId(null); // close the simple confirm modal if open
  }

  /* Called when the match resolution form is submitted */
  function submitMatchConfirm(resolution: { notes: string }) {
    const m = matchConfirmTarget;
    if (!m) return;
    setMatchConfirmTarget(null);

    const today = new Date().toISOString().slice(0, 10);

    matchesApi.confirm(m.id, { notes: resolution.notes })
      .then(() => {
        /* Remove from matches list */
        setMatches(ms => ms.filter(x => x.id !== m.id));
        setFlagged(prev => { const n = new Set(prev); n.delete(m.id); return n; });
        if (expandedMatch === m.id) setExpandedMatch(null);

        /* Update both cases in the verified list with resolution details */
        setVerifiedCases(cs => cs.map(c => {
          if (c.id === m.missingCaseId) {
            return {
              ...c,
              status: 'found' as CaseStatus,
              resolution: {
                date:          today,
                location:      m.unidentified.barangay,
                identifiedName: undefined,
                contactPerson: '',
                contactNumber: '',
                notes:         [
                  `Person found and identified. Matched with unidentified person found in ${m.unidentified.barangay}.`,
                  resolution.notes,
                ].filter(Boolean).join(' '),
              },
            };
          }
          if (c.id === m.unidentifiedCaseId) {
            return {
              ...c,
              status: 'identified' as CaseStatus,
              resolution: {
                date:          today,
                location:      m.missing.barangay,
                identifiedName: m.missing.name,
                contactPerson: '',
                contactNumber: '',
                notes:         [
                  `Identified as ${m.missing.name}. Missing person was last seen in ${m.missing.barangay}.`,
                  resolution.notes,
                ].filter(Boolean).join(' '),
              },
            };
          }
          return c;
        }));

        showToast(
          `Match confirmed — ${m.missing.name} marked Found, ${m.unidentified.name} marked Identified.`,
          'success'
        );
      })
      .catch(err => showToast(`Confirm failed: ${err.message}`, 'info'));
  }

  /* Open resolution modal */
  function openResolution(c: VerifiedCase) {
    setResolutionTarget(c);
  }

  /* Called when the resolution form is submitted */
  function confirmResolution(id: string, status: CaseStatus, form: ResolutionForm) {
    const name = verifiedCases.find(c => c.id === id)?.name ?? 'Case';
    const apiStatus = status === 'found' ? 'FOUND' : 'IDENTIFIED';

    /* Optimistic update */
    setVerifiedCases(cs => cs.map(c =>
      c.id === id ? { ...c, status, resolution: { ...form } } : c
    ));

    /* Persist to API */
    casesApi.updateStatus(id, apiStatus, {
      notes:           form.notes,
      identifiedName:  form.identifiedName,
    }).catch(err => {
      /* Revert on failure */
      setVerifiedCases(cs => cs.map(c =>
        c.id === id ? { ...c, status: 'active', resolution: undefined } : c
      ));
      showToast(`Update failed: ${err.message}`, 'info');
    });

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setToast({ msg: `${name} marked as ${status === 'found' ? 'Found' : 'Identified'}.`, type: 'success', undoId: id });
    undoTimerRef.current = setTimeout(() => setToast(null), 5000);
  }

  /* Undo — revert back to active (local only — API doesn't support undo) */
  function undoResolution(id: string) {
    setVerifiedCases(cs => cs.map(c =>
      c.id === id ? { ...c, status: 'active', resolution: undefined } : c
    ));
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setToast(null);
  }

  /* Status search filter */
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return queue.filter(c =>
      c.name.toLowerCase().includes(q) || c.barangay.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [searchQuery, queue]);

  /* Nav badge counts */
  const navWithBadges = NAV_ITEMS.map(n =>
    n.id === 'queue' ? { ...n, badge: queue.length } : { ...n, badge: undefined }
  );

  /* Nav item click — also closes mobile drawer */
  function handleNavClick(id: View) {
    setView(id);
    setMobileOpen(false);
  }

  /* ── Auth guard — all hooks are above this line ─────────── */
  if (!authChecked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f8f9fa',
        fontFamily: 'var(--font-family)', color: 'var(--color-text-light)',
        flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid rgba(117,21,24,0.15)',
          borderTopColor: '#701515',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Verifying session…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="admin-shell">

      {/* Mobile overlay — tap to close drawer */}
      <div
        className={`admin-sidebar-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Toast notification with Undo */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.7rem 1rem 0.7rem 1.1rem',
            background: toast.type === 'success' ? '#27ae60' : '#3498db',
            color: '#fff', borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            fontSize: '0.85rem', fontWeight: 600,
            animation: 'fadeIn 200ms ease both',
          }}
        >
          <span>
            {toast.type === 'success' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.3rem' }} aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.3rem' }} aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            )}
            {toast.msg}
          </span>
          {toast.undoId && (
            <button
              onClick={() => undoResolution(toast.undoId!)}
              style={{
                background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.5)',
                color: '#fff', borderRadius: '6px', padding: '0.2rem 0.6rem',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-family)',
              }}
              aria-label="Undo status change"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Verified case detail modal */}
      {dbViewCase && (
        <VerifiedCaseModal
          c={dbViewCase}
          onClose={() => setDbViewCase(null)}
        />
      )}

      {/* Import cases modal */}
      {showImport && (
        <ImportCasesModal
          onClose={() => setShowImport(false)}
          onImported={(count) => {
            showToast(`${count} case${count !== 1 ? 's' : ''} imported successfully. They will appear in the Pending Approval queue.`, 'success');
            /* Refresh the pending queue */
            casesApi.getPending()
              .then(r => {
                const mapped = r.cases.map(c => ({
                  id:              c.id,
                  reference:       c.case_reference ?? '',
                  submittedAt:     c.created_at,
                  type:            c.type.toLowerCase() as 'missing' | 'unidentified',
                  name:            c.full_name ?? 'Unknown',
                  approximateAge:  c.age_approx?.toString() ?? (c.age_range_min && c.age_range_max ? `${c.age_range_min}–${c.age_range_max}` : '—'),
                  heightFt:        c.height_ft ?? null,
                  gender:          c.gender === 'MALE' ? 'Male' : c.gender === 'FEMALE' ? 'Female' : 'Unknown',
                  barangay:        c.barangay_name ?? '',
                  location:        c.location_text ?? '',
                  description:     c.description ?? '',
                  reporterName:    c.reporter_name ?? '—',
                  reporterContact: c.reporter_contact ?? '—',
                  photos:          c.photo_url ? [c.photo_url] : [],
                }));
                setQueue(mapped);
              })
              .catch(() => {});
          }}
        />
      )}

      {/* Resolution modal */}
      {resolutionTarget && (
        <ResolutionModal
          caseData={resolutionTarget}
          onClose={() => setResolutionTarget(null)}
          onConfirm={(form) => {
            const status: CaseStatus = resolutionTarget.type === 'missing' ? 'found' : 'identified';
            confirmResolution(resolutionTarget.id, status, form);
            setResolutionTarget(null);
          }}
        />
      )}

      {/* Match confirmation resolution modal */}
      {matchConfirmTarget && (() => {
        const m = matchConfirmTarget;
        const today = new Date().toISOString().split('T')[0];
        return (
          <MatchConfirmModal
            match={m}
            today={today}
            onClose={() => setMatchConfirmTarget(null)}
            onConfirm={(notes) => submitMatchConfirm({ notes })}
          />
        );
      })()}

      {/* ── Sidebar ── */}
      <aside
        className={`admin-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
        aria-label="Admin navigation"
      >
        {/* Brand + collapse toggle */}
        <div className="admin-sidebar-brand">
          <img src="/assets/icons/UBlogo.png" alt="TUKLAS logo" />
          <div className="admin-sidebar-brand-text">
            <span className="admin-sidebar-brand-name">TUKLAS</span>
            <span className="admin-sidebar-brand-sub">Admin Portal</span>
          </div>
          {/* Desktop collapse button */}
          <button
            className="admin-sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {/* Chevron left */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="admin-nav" aria-label="Dashboard sections">
          {(() => {
            function canAccess(minRole?: 'ADMIN' | 'SUPER_ADMIN'): boolean {
              if (!minRole) return true;
              if (minRole === 'ADMIN') return ['ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'].includes(currentRole);
              return currentRole === 'SUPER_ADMIN';
            }

            const hasAdminItems = navWithBadges.some(item => item.minRole && canAccess(item.minRole));
            let adminLabelShown = false;

            return navWithBadges
              .filter(item => canAccess(item.minRole))
              .map(item => {
                const showLabel = !adminLabelShown && !!item.minRole && hasAdminItems;
                if (showLabel) adminLabelShown = true;
                return (
                  <div key={item.id}>
                    {showLabel && <span className="admin-nav-section">Admin</span>}
                    <button
                      className={`admin-nav-item${view === item.id ? ' active' : ''}`}
                      onClick={() => handleNavClick(item.id)}
                      aria-current={view === item.id ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="admin-nav-badge" aria-label={`${item.badge} pending`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </div>
                );
              });
          })()}
        </nav>

        {/* User */}
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar" aria-hidden="true">
              {session?.name?.charAt(0).toUpperCase() ?? 'A'}
            </div>
            <div className="admin-sidebar-user-info">
              <div className="admin-sidebar-user-name">{session?.name ?? 'Admin'}</div>
              <div className="admin-sidebar-user-role">{ROLE_LABELS[currentRole]}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-main">

        {/* Top bar */}
        <header className="admin-topbar">
          {/* Hamburger — mobile only */}
          <button
            className="admin-hamburger"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {mobileOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
          <div className="admin-topbar-title">
            {NAV_ITEMS.find(n => n.id === view)?.label}
            <span>/ TUKLAS Admin</span>
          </div>
          <div className="admin-topbar-actions">
            {/* Notification bell */}
            <button className="admin-topbar-btn" aria-label="Live alerts">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {hasAlerts && <span className="admin-notif-dot" aria-label="New alerts" />}
            </button>

            {/* Logout */}
            <button
              className="admin-logout-btn"
              aria-label="Log out"
              onClick={() => { logout(); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="admin-content">

          {/* ── OVERVIEW ── */}
          {view === 'overview' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2 className="admin-section-title">Dashboard Overview</h2>
                  <p className="admin-section-sub">Real-time summary of all cases in the TUKLAS system.</p>
                </div>
              </div>
              <StatCards stats={stats} />

              {/* Quick queue preview */}
              <div className="admin-section-head" style={{ marginTop: '0.5rem' }}>
                <div>
                  <h2 className="admin-section-title">Recent Submissions</h2>
                  <p className="admin-section-sub">Latest {Math.min(3, queue.length)} pending reports.</p>
                </div>
                <button className="vtable-btn view" onClick={() => setView('queue')}>
                  View All
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
              <VerificationTable
                cases={queue.slice(0, 3)}
                currentAdminId={session?.id ?? ''}
                onApprove={handleApprove}
                onReject={handleReject}
                onClaim={handleClaim}
                onRelease={handleRelease}
              />
            </>
          )}

          {/* ── QUEUE ── */}
          {view === 'queue' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2 className="admin-section-title">Pending Approval</h2>
                  <p className="admin-section-sub">Review and verify public submissions before publishing.</p>
                </div>
              </div>
              <VerificationTable
                cases={queue}
                currentAdminId={session?.id ?? ''}
                onApprove={handleApprove}
                onReject={handleReject}
                onClaim={handleClaim}
                onRelease={handleRelease}
              />
            </>
          )}

          {/* ── DATABASE ── */}
          {view === 'database' && (() => {
            /* Apply all filters */
            const q = dbSearch.toLowerCase().trim();
            const filtered = verifiedCases.filter(c => {
              if (q && !c.name.toLowerCase().includes(q) && !c.barangay.toLowerCase().includes(q)) return false;
              if (dbType   !== 'all' && c.type   !== dbType)   return false;
              if (dbStatus !== 'all' && c.status !== dbStatus) return false;
              if (dbGender !== 'all' && c.gender !== dbGender) return false;
              return true;
            });

            const activeCount     = verifiedCases.filter(c => c.status === 'active').length;
            const resolvedCount   = verifiedCases.filter(c => c.status !== 'active').length;
            const hasActiveFilter = dbSearch || dbType !== 'all' || dbStatus !== 'all' || dbGender !== 'all';

            return (
              <>
                <div className="admin-section-head">
                  <div>
                    <h2 className="admin-section-title">Verified Database</h2>
                    <p className="admin-section-sub">
                      {verifiedCases.length} total · {activeCount} active · {resolvedCount} resolved
                    </p>
                  </div>
                  {hasActiveFilter && (
                    <button
                      className="vtable-btn view"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => { setDbSearch(''); setDbType('all'); setDbStatus('all'); setDbGender('all'); }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Filter toolbar */}
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Search */}
                  <div className="admin-search-bar" style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      className="admin-search-input"
                      type="text"
                      placeholder="Search name or barangay…"
                      value={dbSearch}
                      onChange={e => setDbSearch(e.target.value)}
                      aria-label="Search verified cases"
                    />
                    {dbSearch && (
                      <button onClick={() => setDbSearch('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '1rem', padding: '0 0.25rem', display: 'flex', alignItems: 'center' }}
                        aria-label="Clear search">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>

                  {/* Type filter */}
                  <select
                    className="vtable-filter-select"
                    value={dbType}
                    onChange={e => setDbType(e.target.value as typeof dbType)}
                    aria-label="Filter by case type"
                  >
                    <option value="all">All Types</option>
                    <option value="missing">Missing</option>
                    <option value="unidentified">Unidentified</option>
                  </select>

                  {/* Status filter */}
                  <select
                    className="vtable-filter-select"
                    value={dbStatus}
                    onChange={e => setDbStatus(e.target.value as typeof dbStatus)}
                    aria-label="Filter by status"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="found">Found</option>
                    <option value="identified">Identified</option>
                  </select>

                  {/* Gender filter */}
                  <select
                    className="vtable-filter-select"
                    value={dbGender}
                    onChange={e => setDbGender(e.target.value as typeof dbGender)}
                    aria-label="Filter by gender"
                  >
                    <option value="all">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                {/* Table */}
                {filtered.length === 0 ? (
                  <div className="vtable-wrap">
                    <div className="vtable-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        <line x1="8" y1="11" x2="14" y2="11"/>
                      </svg>
                      <p className="vtable-empty-title">No cases match your filters</p>
                      <p className="vtable-empty-sub">Try adjusting the search or filter criteria.</p>
                    </div>
                  </div>
                ) : (
                  <div className="vtable-wrap">
                    <div style={{ overflowX: 'auto' }}>
                      <table className="vtable" aria-label="Verified cases">
                        <thead>
                          <tr>
                            <th>Ref No.</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Age · Gender</th>
                            <th>Barangay</th>
                            <th>Date Reported</th>
                            <th>Last Seen</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(c => (
                            <tr key={c.id}>
                              <td style={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.78rem', color: '#701515', letterSpacing: '0.05em' }}>
                                {c.reference || '—'}
                              </td>
                              <td style={{ fontWeight: 600 }}>{c.name}</td>
                              <td><span className={`vtable-type-pill ${c.type}`}>{c.type}</span></td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>{c.age} · {c.gender}</td>
                              <td style={{ fontSize: '0.82rem' }}>{c.barangay}</td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>{c.dateReported}</td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>{c.lastSeen}</td>
                              <td>
                                <span className={`vtable-type-pill${
                                  c.status === 'found'      ? ' found' :
                                  c.status === 'identified' ? ' found' : ' missing'
                                }`} style={c.status === 'identified' ? { background: 'rgba(52,152,219,0.1)', color: '#2980b9' } : undefined}>
                                  {c.status === 'active' ? 'Active' : c.status === 'found' ? 'Found' : 'Identified'}
                                </span>
                              </td>
                              <td>
                                <div className="vtable-actions">
                                  <button
                                    className="vtable-btn view"
                                    style={{ fontSize: '0.68rem' }}
                                    onClick={() => setDbViewCase(c)}
                                    aria-label={`View details for ${c.name}`}
                                  >
                                    View
                                  </button>
                                  <button
                                    className="vtable-btn"
                                    style={{
                                      fontSize: '0.68rem',
                                      background: c.photoHidden ? 'rgba(243,156,18,0.1)' : 'rgba(52,152,219,0.08)',
                                      color: c.photoHidden ? '#d35400' : '#2980b9',
                                      border: `1px solid ${c.photoHidden ? '#d35400' : '#2980b9'}`,
                                    }}
                                    onClick={() => handleTogglePhoto(c.id, c.photoHidden)}
                                    aria-label={c.photoHidden ? 'Show photo' : 'Hide photo'}
                                    title={c.photoHidden ? 'Photo is hidden — click to show' : 'Click to hide photo from public'}
                                  >
                                    {c.photoHidden ? (
                                      <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Show Photo</>
                                    ) : (
                                      <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Hide Photo</>
                                    )}
                                  </button>
                                  {!c.published ? (
                                    <button
                                      className="vtable-btn approve"
                                      style={{ fontSize: '0.68rem' }}
                                      onClick={() => handlePublish(c.id)}
                                      aria-label={`Publish ${c.name} to public`}
                                    >
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
                                      Publish
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '0.68rem', color: '#27ae60', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                      Published
                                    </span>
                                  )}
                                  {c.status === 'active' && c.type === 'missing' && (
                                    <button className="vtable-btn approve" style={{ fontSize: '0.68rem' }} onClick={() => openResolution(c)}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                      Mark Found
                                    </button>
                                  )}
                                  {c.status === 'active' && c.type === 'unidentified' && (
                                    <button className="vtable-btn view" style={{ fontSize: '0.68rem', background: 'rgba(52,152,219,0.08)', color: '#2980b9', borderColor: '#2980b9' }} onClick={() => openResolution(c)}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg>
                                      Identified
                                    </button>
                                  )}
                                  {c.status !== 'active' && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>Resolved</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="vtable-pagination" style={{ borderTop: '1px solid #e8eaed', padding: '0.6rem 1rem' }}>
                      <span className="vtable-page-info">
                        Showing <strong>{filtered.length}</strong> of <strong>{verifiedCases.length}</strong> verified cases
                        {resolvedCount > 0 && (
                          <> · <span style={{ color: '#27ae60', fontWeight: 700 }}>{resolvedCount} resolved</span></>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* ── MATCHES ── */}
          {view === 'matches' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2 className="admin-section-title">Case Matching Tool</h2>
                  <p className="admin-section-sub">Potential matches based on proximity and physical traits. Click "View Details" to compare side by side.</p>
                </div>
                <button
                  className="vtable-btn approve"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
                  onClick={() => {
                    matchesApi.runEngine()
                      .then(r => {
                        showToast(r.message, 'success');
                        return matchesApi.getMatches();
                      })
                      .then(r => {
                        setMatches(r.matches.map(m => ({
                          id:                 m.id,
                          score:              m.score,
                          distanceKm:         m.distanceKm ?? 0,
                          matchReasons:       m.matchReasons,
                          flagged:            m.flagged ?? false,
                          missingCaseId:      m.missingCaseId,
                          unidentifiedCaseId: m.unidentifiedCaseId,
                          missing:            m.missing,
                          unidentified:       m.unidentified,
                        })));
                      })
                      .catch(err => showToast(`Matching failed: ${err.message}`, 'info'));
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true">
                    <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
                    <path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>
                  </svg>
                  Run Matching
                </button>
              </div>

              <div className="matches-list">
                {matches.length === 0 && (
                  <div className="vtable-wrap">
                    <div className="vtable-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
                        <path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>
                      </svg>
                      <p className="vtable-empty-title">No pending matches</p>
                      <p className="vtable-empty-sub">All suggested matches have been reviewed.</p>
                    </div>
                  </div>
                )}
                {matches.map(m => {
                  const isExpanded = expandedMatch === m.id;
                  const isFlagged  = m.flagged;   // persisted from DB
                  const scoreColor = m.score >= 80 ? '#1e8449' : m.score >= 65 ? '#d35400' : '#c0392b';
                  return (
                    <div key={m.id} className={`match-card-full${isExpanded ? ' expanded' : ''}`}>

                      {/* ── Summary row ── */}
                      <div className="match-card-summary">
                        <div className="match-card-summary-left">
                          <div className="match-pair-photos">
                            {m.missing.photo ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={m.missing.photo} alt={m.missing.name}
                                style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: '8px', flexShrink: 0, background: '#f0f0f0' }} />
                            ) : (
                              <PersonIcon gender={m.missing.gender} status="missing" size={48} style={{ borderRadius: '8px' }} />
                            )}
                            <div className="match-pair-arrow" aria-hidden="true">↔</div>
                            {m.unidentified.photo ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={m.unidentified.photo} alt={m.unidentified.name}
                                style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: '8px', flexShrink: 0, background: '#f0f0f0' }} />
                            ) : (
                              <PersonIcon gender={m.unidentified.gender} status="unidentified" size={48} style={{ borderRadius: '8px' }} />
                            )}
                          </div>
                          <div className="match-card-summary-info">
                            <p className="match-card-name">
                              {m.missing.name} <span style={{ color: 'var(--color-text-light)', fontWeight: 400 }}>vs</span> {m.unidentified.name}
                            </p>
                            <p className="match-card-meta">
                              {m.missing.barangay} · {m.missing.gender} · {m.distanceKm} km apart
                            </p>
                            <div className="match-reasons-row">
                              {m.matchReasons.slice(0, 2).map(r => (
                                <span key={r} className="match-reason-tag">{r}</span>
                              ))}
                              {m.matchReasons.length > 2 && (
                                <span className="match-reason-tag muted">+{m.matchReasons.length - 2} more</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="match-card-summary-right">
                          <div className="match-score-big" style={{ color: scoreColor }}>
                            {m.score}%
                            <span>match</span>
                          </div>
                          {isFlagged && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem',
                              borderRadius: '50px', background: 'rgba(243,156,18,0.12)',
                              color: '#d68910', border: '1px solid rgba(243,156,18,0.3)',
                              marginBottom: '0.4rem',
                            }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                              Under Review
                            </span>
                          )}
                          <button
                            className={`vtable-btn view match-expand-btn`}
                            onClick={() => setExpandedMatch(isExpanded ? null : m.id)}
                            aria-expanded={isExpanded}
                            aria-controls={`match-detail-${m.id}`}
                          >
                            {isExpanded ? (
                              <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg> Collapse</>
                            ) : (
                              <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg> View Details</>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* ── Expanded detail panel ── */}
                      {isExpanded && (
                        <div id={`match-detail-${m.id}`} className="match-detail-panel" role="region" aria-label="Match details">

                          {/* Side-by-side comparison */}
                          <div className="match-compare-grid">
                            {/* Missing person column */}
                            <div className="match-compare-col missing-col">
                              <div className="match-compare-col-header">
                                <span className="vtable-type-pill missing">Missing Person</span>
                              </div>
                              {m.missing.photo ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={m.missing.photo} alt={m.missing.name}
                                  style={{ borderRadius: '10px', width: '100%', aspectRatio: '1/1', height: 'auto', objectFit: 'contain', display: 'block', background: '#f5f5f5' }} />
                              ) : (
                                <PersonIcon gender={m.missing.gender} status="missing"
                                  style={{ borderRadius: '10px', width: '100%', aspectRatio: '1/1', height: 'auto' }} />
                              )}
                              <div className="match-compare-fields">
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Name</span>
                                  <span className="match-compare-value">{m.missing.name}</span>
                                </div>
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Age / Gender</span>
                                  <span className="match-compare-value">{m.missing.age} · {m.missing.gender}</span>
                                </div>
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Barangay</span>
                                  <span className="match-compare-value">{m.missing.barangay}</span>
                                </div>
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Last Seen</span>
                                  <span className="match-compare-value">{m.missing.date}</span>
                                </div>
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Location</span>
                                  <span className="match-compare-value">{m.missing.location}</span>
                                </div>
                                <div className="match-compare-field full">
                                  <span className="match-compare-label">Description</span>
                                  <span className="match-compare-value">{m.missing.description}</span>
                                </div>
                                <div className="match-compare-field full private">
                                  <span className="match-compare-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    Reporter Contact
                                  </span>
                                  <span className="match-compare-value">{m.missing.reporterContact}</span>
                                </div>
                              </div>
                            </div>

                            {/* Divider */}
                            <div className="match-compare-divider" aria-hidden="true">
                              <div className="match-compare-score-badge" style={{ background: scoreColor }}>
                                {m.score}%
                              </div>
                            </div>

                            {/* Unidentified person column */}
                            <div className="match-compare-col unidentified-col">
                              <div className="match-compare-col-header">
                                <span className="vtable-type-pill unidentified">Unidentified Person</span>
                              </div>
                              {m.unidentified.photo ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={m.unidentified.photo} alt={m.unidentified.name}
                                  style={{ borderRadius: '10px', width: '100%', aspectRatio: '1/1', height: 'auto', objectFit: 'contain', display: 'block', background: '#f5f5f5' }} />
                              ) : (
                                <PersonIcon gender={m.unidentified.gender} status="unidentified"
                                  style={{ borderRadius: '10px', width: '100%', aspectRatio: '1/1', height: 'auto' }} />
                              )}
                              <div className="match-compare-fields">
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Name</span>
                                  <span className="match-compare-value">{m.unidentified.name}</span>
                                </div>
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Age / Gender</span>
                                  <span className="match-compare-value">{m.unidentified.age} · {m.unidentified.gender}</span>
                                </div>
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Barangay</span>
                                  <span className="match-compare-value">{m.unidentified.barangay}</span>
                                </div>
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Date Found</span>
                                  <span className="match-compare-value">{m.unidentified.date}</span>
                                </div>
                                <div className="match-compare-field">
                                  <span className="match-compare-label">Location</span>
                                  <span className="match-compare-value">{m.unidentified.location}</span>
                                </div>
                                <div className="match-compare-field full">
                                  <span className="match-compare-label">Description</span>
                                  <span className="match-compare-value">{m.unidentified.description}</span>
                                </div>
                                <div className="match-compare-field full private">
                                  <span className="match-compare-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    Reporter Contact
                                  </span>
                                  <span className="match-compare-value">{m.unidentified.reporterContact}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Match reasons */}
                          <div className="match-reasons-section">
                            <p className="match-reasons-title">Why these cases were matched</p>
                            <div className="match-reasons-list">
                              {m.matchReasons.map(r => (
                                <div key={r} className="match-reason-item">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" className="match-reason-check" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                  {r}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="match-detail-actions">
                            <button
                              className="vtable-btn reject"
                              onClick={() => dismissMatch(m.id)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              Not a Match
                            </button>
                            <button
                              className="vtable-btn view"
                              onClick={() => flagMatch(m.id)}
                              style={isFlagged ? { background: 'rgba(243,156,18,0.15)', borderColor: 'rgba(243,156,18,0.4)', color: '#d68910' } : undefined}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                              {isFlagged ? 'Flagged' : 'Flag for Review'}
                            </button>
                            <button
                              className="vtable-btn approve"
                              onClick={() => openConfirmMatch(m.id)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                              Confirm Match &amp; Notify
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── ANALYTICS ── */}
          {view === 'analytics' && (() => {
            /* ── Compute last-6-months buckets from live state ── */
            const now = new Date();
            const months = Array.from({ length: 6 }, (_, i) => {
              const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
              return {
                label: d.toLocaleString('en-US', { month: 'short' }),
                year:  d.getFullYear(),
                month: d.getMonth(),
                missing: 0, unidentified: 0, resolved: 0,
              };
            });

            const allCases = [...verifiedCases];
            allCases.forEach(c => {
              const d = new Date(c.dateReported);
              const b = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
              if (!b) return;
              if (c.status === 'found' || c.status === 'identified') b.resolved++;
              else if (c.type === 'missing')      b.missing++;
              else                                b.unidentified++;
            });
            queue.forEach(c => {
              const d = new Date(c.submittedAt);
              const b = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
              if (!b) return;
              if (c.type === 'missing') b.missing++; else b.unidentified++;
            });

            const maxMonthly = Math.max(...months.map(m => m.missing + m.unidentified + m.resolved), 1);
            const resRates   = months.map(m => {
              const t = m.missing + m.unidentified + m.resolved;
              return t === 0 ? 0 : Math.round((m.resolved / t) * 100);
            });

            /* ── Top 5 barangays ── */
            const bCounts: Record<string, number> = {};
            allCases.forEach(c => { if (c.barangay) bCounts[c.barangay] = (bCounts[c.barangay] ?? 0) + 1; });
            const topB    = Object.entries(bCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const maxB    = Math.max(...topB.map(([, n]) => n), 1);

            /* ── Gender breakdown ── */
            const gM = allCases.filter(c => c.gender === 'Male').length;
            const gF = allCases.filter(c => c.gender === 'Female').length;
            const gU = allCases.length - gM - gF;
            const gT = allCases.length || 1;

            /* ── CSV export ── */
            function exportCSV() {
              const headers = ['ID','Type','Status','Name','Age','Gender','Barangay','Location','Date Reported','Last Seen / Found'];
              const rows = allCases.map(c => [
                c.id, c.type, c.status,
                `"${c.name.replace(/"/g,'""')}"`,
                c.age, c.gender,
                `"${c.barangay.replace(/"/g,'""')}"`,
                `"${(c.location ?? '').replace(/"/g,'""')}"`,
                c.dateReported, c.lastSeen,
              ]);
              const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url  = URL.createObjectURL(blob);
              const a    = Object.assign(document.createElement('a'), { href: url, download: `tuklas-cases-${new Date().toISOString().slice(0,10)}.csv` });
              a.click();
              URL.revokeObjectURL(url);
            }

            /* ── PDF / Print export ── */
            function exportPDF() {
              const pw = window.open('', '_blank');
              if (!pw) return;
              const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
              const trs = allCases.map(c => `<tr>
                <td>${c.name}</td>
                <td>${c.type === 'missing' ? 'Missing Person' : 'Unidentified Person'}</td>
                <td>${c.status === 'active' ? 'Active' : c.status === 'found' ? 'Found' : 'Identified'}</td>
                <td>${c.gender}</td><td>${c.age}</td>
                <td>${c.barangay}</td><td>${c.dateReported}</td>
              </tr>`).join('');
              pw.document.write(`<!DOCTYPE html><html><head>
                <title>TUKLAS Case Report — ${today}</title>
                <style>
                  body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:2cm}
                  h1{font-size:16px;color:#701515;margin-bottom:4px}
                  p{font-size:10px;color:#666;margin:0 0 16px}
                  table{width:100%;border-collapse:collapse}
                  th{background:#701515;color:#fff;padding:6px 8px;text-align:left;font-size:10px}
                  td{padding:5px 8px;border-bottom:1px solid #eee;font-size:10px}
                  tr:nth-child(even) td{background:#f9f9f9}
                  .s{display:flex;gap:20px;margin-bottom:16px}
                  .sv{font-size:20px;font-weight:700;color:#701515}
                  .sl{font-size:9px;color:#666}
                  .sc{background:#f5f5f5;border-radius:6px;padding:8px 14px}
                </style>
              </head><body>
                <h1>TUKLAS — Case Report</h1>
                <p>Generated ${today} · Baguio City Missing Persons Information System</p>
                <div class="s">
                  <div class="sc"><div class="sv">${allCases.length}</div><div class="sl">Total Verified</div></div>
                  <div class="sc"><div class="sv">${stats.missing}</div><div class="sl">Active Missing</div></div>
                  <div class="sc"><div class="sv">${stats.unidentified}</div><div class="sl">Unidentified</div></div>
                  <div class="sc"><div class="sv">${stats.found}</div><div class="sl">Resolved</div></div>
                  <div class="sc"><div class="sv">${queue.length}</div><div class="sl">Pending</div></div>
                </div>
                <table>
                  <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Gender</th><th>Age</th><th>Barangay</th><th>Date Reported</th></tr></thead>
                  <tbody>${trs}</tbody>
                </table>
              </body></html>`);
              pw.document.close();
              pw.focus();
              setTimeout(() => { pw.print(); pw.close(); }, 400);
            }

            return (
              <>
                <div className="admin-section-head">
                  <div>
                    <h2 className="admin-section-title">Analytics &amp; Export</h2>
                    <p className="admin-section-sub">Live case trends, resolution rates, and data export tools.</p>
                  </div>
                </div>

                <div className="analytics-grid">

                  {/* Monthly cases bar chart — live */}
                  <div className="analytics-card">
                    <div className="analytics-card-title">Cases Reported — Last 6 Months</div>
                    <svg className="bar-chart" viewBox="0 0 300 130" aria-label="Bar chart of cases reported per month">
                      {months.map((d, i) => {
                        const x  = 20 + i * 46;
                        const mH = (d.missing      / maxMonthly) * 70;
                        const uH = (d.unidentified / maxMonthly) * 70;
                        const rH = (d.resolved     / maxMonthly) * 70;
                        return (
                          <g key={d.label}>
                            <rect x={x}      y={100-mH} width={12} height={Math.max(mH,0)} fill="#701515" rx="2" className="bar-chart-bar" />
                            <rect x={x+13}   y={100-uH} width={12} height={Math.max(uH,0)} fill="#f39c12" rx="2" className="bar-chart-bar" />
                            <rect x={x+26}   y={100-rH} width={12} height={Math.max(rH,0)} fill="#27ae60" rx="2" className="bar-chart-bar" />
                            <text x={x+19}   y={112} textAnchor="middle" className="bar-chart-label">{d.label}</text>
                            {d.missing>0      && <text x={x+6}  y={100-mH-3} textAnchor="middle" className="bar-chart-value">{d.missing}</text>}
                            {d.unidentified>0 && <text x={x+19} y={100-uH-3} textAnchor="middle" className="bar-chart-value">{d.unidentified}</text>}
                            {d.resolved>0     && <text x={x+32} y={100-rH-3} textAnchor="middle" className="bar-chart-value">{d.resolved}</text>}
                          </g>
                        );
                      })}
                      <rect x="20"  y="120" width="10" height="6" fill="#701515" rx="1"/><text x="33"  y="126" className="bar-chart-label">Missing</text>
                      <rect x="90"  y="120" width="10" height="6" fill="#f39c12" rx="1"/><text x="103" y="126" className="bar-chart-label">Unidentified</text>
                      <rect x="175" y="120" width="10" height="6" fill="#27ae60" rx="1"/><text x="188" y="126" className="bar-chart-label">Resolved</text>
                    </svg>
                  </div>

                  {/* Resolution rate chart — live */}
                  <div className="analytics-card">
                    <div className="analytics-card-title">Resolution Rate — Last 6 Months</div>
                    <svg className="bar-chart" viewBox="0 0 300 130" aria-label="Bar chart of resolution rates">
                      {months.map((d, i) => {
                        const rate  = resRates[i];
                        const x     = 20 + i * 46;
                        const h     = (rate / 100) * 70;
                        const color = rate >= 60 ? '#27ae60' : rate >= 30 ? '#f39c12' : rate > 0 ? '#e74c3c' : '#e0e0e0';
                        return (
                          <g key={d.label}>
                            <rect x={x} y={100-h} width={28} height={Math.max(h,2)} fill={color} rx="2" className="bar-chart-bar" />
                            <text x={x+14} y={112} textAnchor="middle" className="bar-chart-label">{d.label}</text>
                            <text x={x+14} y={100-h-3} textAnchor="middle" className="bar-chart-value">{rate > 0 ? `${rate}%` : '—'}</text>
                          </g>
                        );
                      })}
                      <text x="20"  y="126" className="bar-chart-label" style={{fill:'#27ae60'}}>■ ≥60%</text>
                      <text x="75"  y="126" className="bar-chart-label" style={{fill:'#f39c12'}}>■ 30–59%</text>
                      <text x="145" y="126" className="bar-chart-label" style={{fill:'#e74c3c'}}>■ &lt;30%</text>
                    </svg>
                  </div>

                  {/* Live summary */}
                  <div className="analytics-card">
                    <div className="analytics-card-title">Current Status Summary</div>
                    <div className="analytics-summary">
                      {([
                        { label: 'Pending in Queue',       value: queue.length,       dir: queue.length > 5 ? 'negative' : '' },
                        { label: 'Active Missing Persons', value: stats.missing,       dir: '' },
                        { label: 'Active Unidentified',    value: stats.unidentified,  dir: '' },
                        { label: 'Found / Resolved',       value: stats.found,         dir: 'positive' },
                        { label: 'Resolution Rate',        value: allCases.length > 0 ? `${Math.round((stats.found / allCases.length) * 100)}%` : '—', dir: 'positive' },
                      ] as const).map(r => (
                        <div key={r.label} className="analytics-summary-row">
                          <span className="analytics-summary-label">{r.label}</span>
                          <span className={`analytics-summary-value ${r.dir}`}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* All-time totals */}
                  <div className="analytics-card">
                    <div className="analytics-card-title">All-Time Totals</div>
                    <div className="analytics-summary">
                      {([
                        { label: 'Total Cases in System',  value: verifiedCases.length + queue.length, dir: '' },
                        { label: 'Missing Person Reports', value: verifiedCases.filter(c=>c.type==='missing').length + queue.filter(c=>c.type==='missing').length, dir: '' },
                        { label: 'Unidentified Reports',   value: verifiedCases.filter(c=>c.type==='unidentified').length + queue.filter(c=>c.type==='unidentified').length, dir: '' },
                        { label: 'Found / Resolved',       value: stats.found, dir: 'positive' },
                        { label: 'Pending Verification',   value: queue.length, dir: '' },
                      ] as const).map(r => (
                        <div key={r.label} className="analytics-summary-row">
                          <span className="analytics-summary-label">{r.label}</span>
                          <span className={`analytics-summary-value ${r.dir}`}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top barangays */}
                  <div className="analytics-card">
                    <div className="analytics-card-title">Top Barangays by Case Count</div>
                    {topB.length === 0 ? (
                      <p style={{fontSize:'0.8rem',color:'var(--color-text-light)',margin:0}}>No data yet.</p>
                    ) : (
                      <div style={{display:'flex',flexDirection:'column',gap:'0.55rem',marginTop:'0.25rem'}}>
                        {topB.map(([name, count]) => (
                          <div key={name}>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem',marginBottom:'0.2rem'}}>
                              <span style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'75%'}}>{name}</span>
                              <span style={{color:'var(--color-text-light)',flexShrink:0}}>{count} case{count!==1?'s':''}</span>
                            </div>
                            <div style={{height:6,background:'#f0f0f0',borderRadius:3,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${Math.round((count/maxB)*100)}%`,background:'#701515',borderRadius:3,transition:'width 400ms ease'}} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gender breakdown */}
                  <div className="analytics-card">
                    <div className="analytics-card-title">Gender Breakdown</div>
                    <div style={{display:'flex',flexDirection:'column',gap:'0.55rem',marginTop:'0.25rem'}}>
                      {([
                        {label:'Male',    count:gM, color:'#2980b9'},
                        {label:'Female',  count:gF, color:'#8e44ad'},
                        {label:'Unknown', count:gU, color:'#95a5a6'},
                      ] as const).map(g => (
                        <div key={g.label}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem',marginBottom:'0.2rem'}}>
                            <span style={{fontWeight:600}}>{g.label}</span>
                            <span style={{color:'var(--color-text-light)'}}>{g.count} ({Math.round((g.count/gT)*100)}%)</span>
                          </div>
                          <div style={{height:6,background:'#f0f0f0',borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${Math.round((g.count/gT)*100)}%`,background:g.color,borderRadius:3,transition:'width 400ms ease'}} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Export */}
                  <div className="export-card">
                    <div className="analytics-card-title">Export &amp; Import</div>
                    <p style={{fontSize:'0.8rem',color:'var(--color-text-light)',margin:'0 0 0.75rem'}}>
                      Download case data for official records, or import cases in bulk from a spreadsheet.
                    </p>
                    <div className="export-buttons">
                      <button className="export-btn primary-export" onClick={exportPDF}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                        </svg>
                        Print / Save as PDF
                      </button>
                      <button className="export-btn" onClick={exportCSV}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
                          <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
                        </svg>
                        Export All Cases (CSV)
                      </button>
                      <button className="export-btn" onClick={() => setShowImport(true)}
                        style={{ borderColor: '#27ae60', color: '#1e8449' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                        </svg>
                        Import from CSV / Excel
                      </button>
                    </div>
                    <p style={{fontSize:'0.72rem',color:'var(--color-text-light)',marginTop:'0.6rem'}}>
                      CSV export includes: ID, type, status, name, age, gender, barangay, location, dates.
                      Import accepts .csv, .xlsx, .xls — imported cases go to the Pending Approval queue.
                    </p>
                  </div>

                </div>
              </>
            );
          })()}

          {/* ── USER MANAGEMENT (Super Admin only) ── */}
          {view === 'users' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2 className="admin-section-title">User Management</h2>
                  <p className="admin-section-sub">Manage staff accounts, roles, and access control.</p>
                </div>
              </div>
              <div className="mgmt-section-divider">
                <span className="mgmt-section-divider-label">Internal User Management</span>
                <div className="mgmt-section-divider-line" />
              </div>
              <UserManagement currentRole={
                currentRole === 'SUPER_ADMIN' ? 'superadmin'
                : currentRole === 'ADMIN' || currentRole === 'SYSTEM_OWNER' ? 'admin'
                : 'moderator'
              } />
            </>
          )}

          {/* ── AUDIT LOGS (Super Admin only) ── */}
          {view === 'logs' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2 className="admin-section-title">Audit Logs</h2>
                  <p className="admin-section-sub">Complete read-only activity trail for all admin actions.</p>
                </div>
              </div>
              <div className="mgmt-section-divider">
                <span className="mgmt-section-divider-label">Internal Audit Trail</span>
                <div className="mgmt-section-divider-line" />
              </div>
              <ActivityLogs isSuperAdmin={currentRole === 'ADMIN' || currentRole === 'SYSTEM_OWNER' || currentRole === 'SUPER_ADMIN'} />
            </>
          )}

          {/* ── SETTINGS ── */}
          {view === 'settings' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2 className="admin-section-title">Settings</h2>
                  <p className="admin-section-sub">Manage your personal account details and password.</p>
                </div>
              </div>

              <SettingsPanel session={session} />
            </>
          )}

        </main>
      </div>
    </div>
  );
}
