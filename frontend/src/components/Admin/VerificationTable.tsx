'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { formatHeight } from '../CaseCard';
import { casesApi, type ProofDocument } from '../../lib/api';

/* ── Types ─────────────────────────────────────────────────── */
export type CaseType   = 'missing' | 'unidentified';
export type TrustLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PendingCase {
  id: string;
  reference: string;
  submittedAt: string;
  type: CaseType;
  name: string;
  approximateAge: string;
  heightFt: number | null;
  barangay: string;
  reporterName: string;
  reporterContact: string;
  location: string;
  description: string;
  photos: string[];
  gender: string;
  /* New fields */
  trustLevel: TrustLevel;
  sourceLink: string | null;
  proofDocuments: ProofDocument[];
  claimedBy: string | null;
  claimedAt: string | null;
  isMinor: boolean;
}

interface VerificationTableProps {
  cases: PendingCase[];
  currentAdminId: string;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  onClaim:   (id: string) => void;
  onRelease: (id: string) => void;
}

const PAGE_SIZE = 6;
/* SLA target: 24 hours in ms */
const SLA_MS = 24 * 60 * 60 * 1000;

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/* How long ago was it submitted? Returns "X hrs Y min" style string */
function elapsed(iso: string): { text: string; overSla: boolean } {
  const ms   = Date.now() - new Date(iso).getTime();
  const h    = Math.floor(ms / (1000 * 60 * 60));
  const m    = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const over = ms > SLA_MS;
  const text = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return { text, overSla: over };
}

/* ── Trust Level Badge ──────────────────────────────────────── */
function TrustBadge({ level }: { level: TrustLevel }) {
  const cfg = {
    HIGH:   { bg: 'rgba(39,174,96,0.1)',  color: '#1e8449', label: 'High Trust',   icon: '✓' },
    MEDIUM: { bg: 'rgba(243,156,18,0.12)', color: '#d35400', label: 'Medium Trust', icon: '~' },
    LOW:    { bg: 'rgba(231,76,60,0.1)',  color: '#c0392b', label: 'Low Trust',    icon: '!' },
  }[level];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.15rem 0.5rem',
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}33`,
      borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
      letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

/* ── SLA Timer ──────────────────────────────────────────────── */
function SlaTimer({ submittedAt }: { submittedAt: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { text, overSla } = elapsed(submittedAt);

  return (
    <span
      title={overSla ? `Over 24-hour SLA target (submitted ${fmt(submittedAt)} ${fmtTime(submittedAt)})` : `Submitted ${fmt(submittedAt)}`}
      style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        color: overSla ? '#c0392b' : 'var(--color-text-light)',
        display: 'flex', alignItems: 'center', gap: '0.25rem',
      }}
    >
      {overSla && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      )}
      {text}
    </span>
  );
}

/* ── Image Lightbox ─────────────────────────────────────────── */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', animation: 'fadeIn 150ms ease both',
      }}
      role="dialog" aria-modal="true" aria-label="Full size photo"
      onClick={onClose}
    >
      <button
        onClick={onClose} aria-label="Close photo"
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
        src={src} alt={alt}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      />
    </div>
  );
}

/* ── Proof Documents Viewer ─────────────────────────────────── */
function ProofViewer({ caseId, docs, sourceLink }: { caseId: string; docs: ProofDocument[]; sourceLink: string | null }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState('');

  async function openProof(doc: ProofDocument) {
    setLoading(doc.path);
    setError('');
    try {
      const { signedUrl } = await casesApi.getProofSignedUrl(caseId, doc.path);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setError(`Failed to open "${doc.filename}". Please try again.`);
    } finally {
      setLoading(null);
    }
  }

  if (docs.length === 0 && !sourceLink) {
    return (
      <div style={{ fontSize: '0.8rem', color: '#e74c3c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        No proof submitted
      </div>
    );
  }

  return (
    <div>
      {error && <div style={{ fontSize: '0.75rem', color: '#e74c3c', marginBottom: '0.4rem' }}>{error}</div>}
      {docs.map(doc => (
        <button
          key={doc.path}
          onClick={() => openProof(doc)}
          disabled={loading === doc.path}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: loading === doc.path ? '#f0f0f0' : 'rgba(112,21,21,0.06)',
            border: '1px solid rgba(112,21,21,0.2)',
            borderRadius: '6px', padding: '0.3rem 0.65rem',
            fontSize: '0.75rem', fontWeight: 600, color: '#701515',
            cursor: loading === doc.path ? 'wait' : 'pointer',
            marginBottom: '0.3rem', width: '100%', textAlign: 'left',
            fontFamily: 'var(--font-family)',
          }}
          aria-label={`Open proof document: ${doc.filename}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          {loading === doc.path ? 'Opening…' : doc.filename}
        </button>
      ))}
      {sourceLink && (
        <a
          href={sourceLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.25)',
            borderRadius: '6px', padding: '0.3rem 0.65rem',
            fontSize: '0.75rem', fontWeight: 600, color: '#2980b9',
            textDecoration: 'none', marginBottom: '0.3rem',
          }}
          aria-label="Open source link"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          View Source Link
        </a>
      )}
    </div>
  );
}

/* ── Case Modal ─────────────────────────────────────────────── */
function CaseModal({
  c, currentAdminId, onClose, onApprove, onReject, onClaim, onRelease,
}: {
  c: PendingCase;
  currentAdminId: string;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onClaim: () => void;
  onRelease: () => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const isClaimed   = !!c.claimedBy;
  const claimedByMe = c.claimedBy === currentAdminId;
  const { overSla } = elapsed(c.submittedAt);

  return (
    <>
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt="Full size case photo" onClose={() => setLightboxSrc(null)} />
      )}

      <div
        className="admin-modal-overlay"
        role="dialog" aria-modal="true"
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
                  marginLeft: '0.6rem', fontSize: '0.72rem', fontWeight: 700,
                  letterSpacing: '0.08em', color: '#701515',
                  background: 'rgba(112,21,21,0.08)', border: '1px solid rgba(112,21,21,0.18)',
                  borderRadius: '4px', padding: '0.15rem 0.5rem', verticalAlign: 'middle',
                }}>{c.reference}</span>
              )}
            </h2>
            <button className="admin-modal-close" onClick={onClose} aria-label="Close modal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="admin-modal-body">

            {/* SLA + trust badges */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem', alignItems: 'center' }}>
              <TrustBadge level={c.trustLevel} />
              {c.isMinor && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.15rem 0.5rem', background: 'rgba(52,152,219,0.1)',
                  color: '#1a5276', border: '1px solid rgba(52,152,219,0.3)',
                  borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  Minor — Photo Restricted
                </span>
              )}
              {overSla && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.15rem 0.5rem', background: 'rgba(231,76,60,0.1)',
                  color: '#c0392b', border: '1px solid rgba(231,76,60,0.3)',
                  borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  ⚠ Over 24h SLA
                </span>
              )}
              {isClaimed && !claimedByMe && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.15rem 0.5rem', background: 'rgba(243,156,18,0.1)',
                  color: '#d35400', border: '1px solid rgba(243,156,18,0.3)',
                  borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  🔒 Claimed by another admin
                </span>
              )}
              {claimedByMe && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.15rem 0.5rem', background: 'rgba(39,174,96,0.1)',
                  color: '#1e8449', border: '1px solid rgba(39,174,96,0.3)',
                  borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  ✓ Claimed by you
                </span>
              )}
            </div>

            {/* Photos */}
            {c.photos.length > 0 && (
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-light)', marginBottom: '0.6rem' }}>
                  Submitted Photos
                  <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '0.4rem', color: '#aaa' }}>— click to enlarge</span>
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
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#701515'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                    >
                      <Image
                        src={src} alt={`Photo ${i + 1}`}
                        width={120} height={120}
                        className="admin-modal-photo"
                        style={{ objectFit: 'cover', borderRadius: 6, display: 'block' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Supporting Evidence */}
            <div style={{
              marginTop: '0.85rem',
              background: 'rgba(112,21,21,0.03)', border: '1px solid rgba(112,21,21,0.12)',
              borderRadius: '8px', padding: '0.65rem 0.85rem',
            }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>
                Supporting Evidence
              </p>
              <ProofViewer caseId={c.id} docs={c.proofDocuments} sourceLink={c.sourceLink} />
            </div>

            {/* Details grid */}
            <div className="admin-modal-details">
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Reference No.</span>
                <span className="admin-modal-field-value" style={{ fontWeight: 700, color: '#701515', letterSpacing: '0.06em' }}>{c.reference || '—'}</span>
              </div>
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Case Type</span>
                <span className="admin-modal-field-value" style={{ textTransform: 'capitalize' }}>{c.type}</span>
              </div>
              <div className="admin-modal-field">
                <span className="admin-modal-field-label">Submitted</span>
                <span className="admin-modal-field-value">{fmt(c.submittedAt)} {fmtTime(c.submittedAt)}</span>
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

              {/* Reporter info */}
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
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.reporterName || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)' }}>Contact</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
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
              {/* Claim / Release */}
              {!isClaimed && (
                <button
                  className="vtable-btn view"
                  onClick={onClaim}
                  title="Claim this case so others know you're reviewing it"
                >
                  Claim for Review
                </button>
              )}
              {claimedByMe && (
                <button className="vtable-btn view" onClick={onRelease}>
                  Release Claim
                </button>
              )}

              <button className="vtable-btn reject" onClick={() => { onReject(); onClose(); }}>
                Reject / Delete
              </button>
              <button
                className="vtable-btn approve"
                onClick={() => { onApprove(); onClose(); }}
                disabled={isClaimed && !claimedByMe}
                title={isClaimed && !claimedByMe ? 'Another admin has claimed this case' : 'Approve this report'}
              >
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
export function VerificationTable({ cases, currentAdminId, onApprove, onReject, onClaim, onRelease }: VerificationTableProps) {
  const [page, setPage]         = useState(1);
  const [filter, setFilter]     = useState<'all' | CaseType>('all');
  const [trustFilter, setTrust] = useState<'all' | TrustLevel>('all');
  const [viewCase, setViewCase] = useState<PendingCase | null>(null);

  const filtered = cases.filter(c => {
    if (filter !== 'all' && c.type !== filter) return false;
    if (trustFilter !== 'all' && c.trustLevel !== trustFilter) return false;
    return true;
  });

  /* Sort: over-SLA first, then HIGH trust, then by submission date ascending */
  const sorted = [...filtered].sort((a, b) => {
    const aOver = Date.now() - new Date(a.submittedAt).getTime() > SLA_MS;
    const bOver = Date.now() - new Date(b.submittedAt).getTime() > SLA_MS;
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    const trustOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    if (trustOrder[a.trustLevel] !== trustOrder[b.trustLevel]) {
      return trustOrder[a.trustLevel] - trustOrder[b.trustLevel];
    }
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const slice      = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className="vtable-wrap">
        {/* Toolbar */}
        <div className="vtable-toolbar">
          <div className="vtable-toolbar-left">
            <span className="vtable-title">Verification Queue</span>
            <span className="vtable-count-badge">{filtered.length} pending</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              className="vtable-filter-select"
              value={trustFilter}
              onChange={e => { setTrust(e.target.value as typeof trustFilter); setPage(1); }}
              aria-label="Filter by trust level"
            >
              <option value="all">All Trust Levels</option>
              <option value="HIGH">High Trust</option>
              <option value="MEDIUM">Medium Trust</option>
              <option value="LOW">Low Trust</option>
            </select>
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
        </div>

        {/* Table or empty */}
        {slice.length === 0 ? (
          <div className="vtable-empty" role="status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
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
                  <th>Name / Age (yrs)</th>
                  <th>Trust</th>
                  <th>Barangay</th>
                  <th>Reporter</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.map(c => {
                  const claimedByMe = c.claimedBy === currentAdminId;
                  const claimed     = !!c.claimedBy && !claimedByMe;
                  const { overSla } = elapsed(c.submittedAt);
                  return (
                    <tr key={c.id} style={{ opacity: claimed ? 0.6 : 1 }}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.78rem', color: '#701515', letterSpacing: '0.05em' }}>
                        {c.reference || '—'}
                      </td>
                      <td>
                        <SlaTimer submittedAt={c.submittedAt} />
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{fmt(c.submittedAt)}</div>
                      </td>
                      <td>
                        <span className={`vtable-type-pill ${c.type}`}>{c.type}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {c.name}
                          {c.isMinor && (
                            <span title="Minor — photo restricted" style={{ marginLeft: '0.3rem', fontSize: '0.65rem', color: '#1a5276', background: 'rgba(52,152,219,0.1)', borderRadius: '3px', padding: '1px 4px' }}>MINOR</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                          {c.approximateAge} · {c.gender}
                        </div>
                      </td>
                      <td><TrustBadge level={c.trustLevel} /></td>
                      <td>{c.barangay}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 600 }}>{c.reporterName || '—'}</div>
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
                          {!c.claimedBy && (
                            <button
                              className="vtable-btn view"
                              onClick={() => onClaim(c.id)}
                              aria-label={`Claim case ${c.name}`}
                              title="Claim so others know you're reviewing"
                              style={{ fontSize: '0.72rem' }}
                            >
                              Claim
                            </button>
                          )}
                          <button
                            className="vtable-btn approve"
                            onClick={() => onApprove(c.id)}
                            disabled={claimed}
                            title={claimed ? 'Claimed by another admin' : 'Approve'}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="vtable-pagination">
            <span className="vtable-page-info">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="vtable-page-btns" role="navigation" aria-label="Pagination">
              <button className="vtable-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} aria-label="Previous page">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  className={`vtable-page-btn${n === safePage ? ' active' : ''}`}
                  onClick={() => setPage(n)}
                  aria-label={`Page ${n}`}
                  aria-current={n === safePage ? 'page' : undefined}
                >{n}</button>
              ))}
              <button className="vtable-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} aria-label="Next page">›</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {viewCase && (
        <CaseModal
          c={viewCase}
          currentAdminId={currentAdminId}
          onClose={() => setViewCase(null)}
          onApprove={() => onApprove(viewCase.id)}
          onReject={() => onReject(viewCase.id)}
          onClaim={() => { onClaim(viewCase.id); setViewCase(c => c ? { ...c, claimedBy: currentAdminId, claimedAt: new Date().toISOString() } : null); }}
          onRelease={() => { onRelease(viewCase.id); setViewCase(c => c ? { ...c, claimedBy: null, claimedAt: null } : null); }}
        />
      )}
    </>
  );
}
