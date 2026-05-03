'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatHeight } from '../CaseCard';

/* ── Types ─────────────────────────────────────────────────── */
export type CaseType = 'missing' | 'unidentified';

export interface PendingCase {
  id: string;
  reference: string;         // TKL-YYYY-NNNNN
  submittedAt: string;       // ISO
  type: CaseType;
  name: string;              // "Unknown" for unidentified
  approximateAge: string;
  heightFt: number | null;
  barangay: string;
  reporterName: string;      // visible to all admin roles
  reporterContact: string;   // visible to all admin roles
  location: string;
  description: string;
  photos: string[];          // image URLs
  gender: string;
}

interface VerificationTableProps {
  cases: PendingCase[];
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
}

const PAGE_SIZE = 6;

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/* ── Image Lightbox ─────────────────────────────────────────── */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 150ms ease both',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Full size photo"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close photo"
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '8px', color: '#fff', width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '1.1rem',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '85vh',
          objectFit: 'contain',
          borderRadius: '10px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  );
}

/* ── Modal ─────────────────────────────────────────────────── */
function CaseModal({
  c,
  onClose,
  onApprove,
  onReject,
}: {
  c: PendingCase;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="Full size case photo"
          onClose={() => setLightboxSrc(null)}
        />
      )}

      <div
        className="admin-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={`Case details: ${c.name}`}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="admin-modal">
          {/* Header */}
          <div className="admin-modal-header">
            <h2 className="admin-modal-title">
              Case Submission — {c.name}
              {c.reference && (
                <span style={{
                  marginLeft: '0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#701515',
                  background: 'rgba(112,21,21,0.08)',
                  border: '1px solid rgba(112,21,21,0.18)',
                  borderRadius: '4px',
                  padding: '0.15rem 0.5rem',
                  verticalAlign: 'middle',
                }}>
                  {c.reference}
                </span>
              )}
            </h2>
            <button className="admin-modal-close" onClick={onClose} aria-label="Close modal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="admin-modal-body">
            {/* Photos — clickable for fullscreen */}
            {c.photos.length > 0 && (
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-light)', marginBottom: '0.6rem' }}>
                  Submitted Photos
                  <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '0.4rem', color: '#aaa' }}>
                    — click to enlarge
                  </span>
                </p>
                <div className="admin-modal-photos">
                  {c.photos.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxSrc(src)}
                      aria-label={`View photo ${i + 1} full size`}
                      style={{
                        padding: 0, border: '2px solid transparent', borderRadius: 8,
                        cursor: 'zoom-in', background: 'none',
                        transition: 'border-color 150ms ease, transform 150ms ease',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#701515';
                        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.03)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                      }}
                    >
                      <Image
                        src={src}
                        alt={`Photo ${i + 1}`}
                        width={120}
                        height={120}
                        className="admin-modal-photo"
                        style={{ objectFit: 'cover', borderRadius: 6, display: 'block' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Details grid */}
            <div className="admin-modal-details">
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Reference No.</span>
                <span className="admin-modal-field-value" style={{ fontWeight: 700, color: '#701515', letterSpacing: '0.06em' }}>
                  {c.reference || '—'}
                </span>
              </div>
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Case Type</span>
                <span className="admin-modal-field-value" style={{ textTransform: 'capitalize' }}>{c.type}</span>
              </div>
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Submitted</span>
                <span className="admin-modal-field-value">{fmt(c.submittedAt)}</span>
              </div>
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Name</span>
                <span className="admin-modal-field-value">{c.name}</span>
              </div>
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Age / Gender</span>
                <span className="admin-modal-field-value">{c.approximateAge} · {c.gender}</span>
              </div>
              {c.heightFt != null && (
                <div className="admin-modal-field">
                  <span className="admin-modal-field-label">Height</span>
                  <span className="admin-modal-field-value">{formatHeight(c.heightFt)}</span>
                </div>
              )}
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Barangay</span>
                <span className="admin-modal-field-value">{c.barangay}</span>
              </div>
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Specific Location</span>
                <span className="admin-modal-field-value">{c.location}</span>
              </div>
              <div className="admin-modal-field full">
                <span className="admin-modal-field-label">Physical Description</span>
                <span className="admin-modal-field-value">{c.description || '—'}</span>
              </div>

              {/* Reporter info — visible to all admin roles */}
              <div className="admin-modal-field full" style={{ background: 'rgba(112,21,21,0.04)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
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
            </div>

            {/* Actions */}
            <div className="admin-modal-actions">
              <button className="vtable-btn reject" onClick={() => { onReject(); onClose(); }}>
                Reject / Delete
              </button>
              <button className="vtable-btn approve" onClick={() => { onApprove(); onClose(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Approve
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Table ─────────────────────────────────────────────────── */
export function VerificationTable({ cases, onApprove, onReject }: VerificationTableProps) {
  const [page, setPage]           = useState(1);
  const [filter, setFilter]       = useState<'all' | CaseType>('all');
  const [viewCase, setViewCase]   = useState<PendingCase | null>(null);

  const filtered = filter === 'all' ? cases : cases.filter(c => c.type === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className="vtable-wrap">
        {/* Toolbar */}
        <div className="vtable-toolbar">
          <div className="vtable-toolbar-left">
            <span className="vtable-title">Verification Queue</span>
            <span className="vtable-count-badge">{filtered.length} pending</span>
          </div>
          <select
            className="vtable-filter-select"
            value={filter}
            onChange={e => { setFilter(e.target.value as typeof filter); setPage(1); }}
            aria-label="Filter by case type"
          >
            <option value="all">All Types</option>
            <option value="missing">Missing</option>
            <option value="unidentified">Unidentified</option>
          </select>
        </div>

        {/* Table or empty */}
        {slice.length === 0 ? (
          <div className="vtable-empty" role="status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="12" y2="16"/>
            </svg>
            <p className="vtable-empty-title">Queue is clear</p>
            <p className="vtable-empty-sub">No pending submissions to review.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="vtable" aria-label="Pending verification cases">
              <thead>
                <tr>
                  <th>Ref No.</th>
                  <th>Submitted</th>
                  <th>Type</th>
                  <th>Name / Age</th>
                  <th>Barangay</th>
                  <th>Reporter</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.map(c => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.78rem', color: '#701515', letterSpacing: '0.05em' }}>
                      {c.reference || '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-light)', fontSize: '0.8rem' }}>
                      {fmt(c.submittedAt)}
                    </td>
                    <td>
                      <span className={`vtable-type-pill ${c.type}`}>
                        {c.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                        {c.approximateAge} · {c.gender}
                      </div>
                    </td>
                    <td>{c.barangay}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-dark)' }}>{c.reporterName || '—'}</div>
                      <div style={{ color: 'var(--color-text-light)', fontSize: '0.75rem' }}>{c.reporterContact || '—'}</div>
                    </td>
                    <td>
                      <div className="vtable-actions">
                        <button
                          className="vtable-btn view"
                          onClick={() => setViewCase(c)}
                          aria-label={`View case ${c.name}`}
                        >
                          View
                        </button>
                        <button
                          className="vtable-btn approve"
                          onClick={() => onApprove(c.id)}
                          aria-label={`Approve case ${c.name}`}
                        >
                          Approve
                        </button>
                        <button
                          className="vtable-btn reject"
                          onClick={() => onReject(c.id)}
                          aria-label={`Reject case ${c.name}`}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="vtable-pagination">
            <span className="vtable-page-info">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="vtable-page-btns" role="navigation" aria-label="Pagination">
              <button
                className="vtable-page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                aria-label="Previous page"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  className={`vtable-page-btn${n === safePage ? ' active' : ''}`}
                  onClick={() => setPage(n)}
                  aria-label={`Page ${n}`}
                  aria-current={n === safePage ? 'page' : undefined}
                >{n}</button>
              ))}
              <button
                className="vtable-page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                aria-label="Next page"
              >›</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {viewCase && (
        <CaseModal
          c={viewCase}
          onClose={() => setViewCase(null)}
          onApprove={() => onApprove(viewCase.id)}
          onReject={() => onReject(viewCase.id)}
        />
      )}
    </>
  );
}
