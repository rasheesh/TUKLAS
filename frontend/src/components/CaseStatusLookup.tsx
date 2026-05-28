'use client';

import { useState, FormEvent } from 'react';
import { casesApi, CaseLookupResult, ApiError } from '@/src/lib/api';

const STATUS_META: Record<CaseLookupResult['status'], {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  description: string;
}> = {
  PENDING: {
    label:       'Under Review',
    color:       '#92400e',
    bg:          '#fffbeb',
    border:      'rgba(217,119,6,0.3)',
    dot:         '#d97706',
    description: 'Your report has been received and is being reviewed by our team. This usually takes 1–3 business days.',
  },
  VERIFIED: {
    label:       'Verified & Published',
    color:       '#065f46',
    bg:          '#f0fdf4',
    border:      'rgba(16,185,129,0.3)',
    dot:         '#10b981',
    description: 'Your report has been verified and is now publicly visible in the TUKLAS database.',
  },
  FOUND: {
    label:       'Resolved — Person Found',
    color:       '#1e3a5f',
    bg:          '#eff6ff',
    border:      'rgba(59,130,246,0.3)',
    dot:         '#3b82f6',
    description: 'This case has been resolved. The missing person has been found.',
  },
  IDENTIFIED: {
    label:       'Resolved — Person Identified',
    color:       '#1e3a5f',
    bg:          '#eff6ff',
    border:      'rgba(59,130,246,0.3)',
    dot:         '#3b82f6',
    description: 'This case has been resolved. The unidentified person has been identified.',
  },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function CaseStatusLookup() {
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaseLookupResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = ref.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);
    setError('');

    try {
      const { case: found } = await casesApi.lookupByRef(trimmed);
      setResult(found);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const meta = result ? STATUS_META[result.status] : null;

  return (
    <section style={{
      background: '#fff',
      borderTop: '1px solid #eaecef',
      padding: '4rem 1.5rem',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48,
            background: 'rgba(112,21,21,0.08)',
            borderRadius: '50%', marginBottom: '1rem',
            color: '#701515',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              width="22" height="22" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </div>
          <h2 style={{
            fontSize: '1.5rem', fontWeight: 900,
            color: '#111827', margin: '0 0 0.4rem',
            letterSpacing: '-0.01em',
          }}>
            Track Your Report
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.6 }}>
            Enter the reference number you received when you submitted your report.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <input
            type="text"
            value={ref}
            onChange={e => setRef(e.target.value)}
            placeholder="e.g. TKL-2024-00001"
            aria-label="Case reference number"
            style={{
              flex: 1, height: 46,
              padding: '0 1rem',
              border: '1.5px solid #d1d5db',
              borderRadius: 10,
              fontSize: '0.92rem',
              fontFamily: 'inherit',
              color: '#111827',
              background: '#fff',
              outline: 'none',
              transition: 'border-color 150ms',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
            onFocus={e => (e.target.style.borderColor = '#701515')}
            onBlur={e => (e.target.style.borderColor = '#d1d5db')}
          />
          <button
            type="submit"
            disabled={loading || !ref.trim()}
            style={{
              height: 46, padding: '0 1.4rem',
              background: '#701515', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: '0.9rem', fontWeight: 700,
              cursor: loading || !ref.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !ref.trim() ? 0.65 : 1,
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              whiteSpace: 'nowrap',
              transition: 'opacity 150ms',
            }}
          >
            {loading ? (
              <>
                <span style={{
                  display: 'inline-block', width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,0.35)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Searching…
              </>
            ) : 'Check Status'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div role="alert" style={{
            display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
            padding: '0.85rem 1rem',
            background: '#fef2f2', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, fontSize: '0.87rem', color: '#991b1b',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Result card */}
        {result && meta && (
          <div role="status" style={{
            padding: '1.25rem 1.4rem',
            background: meta.bg,
            border: `1.5px solid ${meta.border}`,
            borderRadius: 12,
          }}>
            {/* Status badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              marginBottom: '0.85rem',
            }}>
              <span style={{
                display: 'inline-block', width: 9, height: 9,
                borderRadius: '50%', background: meta.dot, flexShrink: 0,
              }} />
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: meta.color }}>
                {meta.label}
              </span>
            </div>

            {/* Details */}
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                <dt style={{ color: '#6b7280', minWidth: 90, flexShrink: 0 }}>Reference</dt>
                <dd style={{ margin: 0, fontWeight: 700, color: '#111827', letterSpacing: '0.03em' }}>
                  {result.reference}
                </dd>
              </div>
              {result.name && (
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <dt style={{ color: '#6b7280', minWidth: 90, flexShrink: 0 }}>Name</dt>
                  <dd style={{ margin: 0, color: '#374151' }}>{result.name}</dd>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                <dt style={{ color: '#6b7280', minWidth: 90, flexShrink: 0 }}>Type</dt>
                <dd style={{ margin: 0, color: '#374151' }}>
                  {result.type === 'MISSING' ? 'Missing Person' : 'Unidentified Person'}
                </dd>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                <dt style={{ color: '#6b7280', minWidth: 90, flexShrink: 0 }}>Submitted</dt>
                <dd style={{ margin: 0, color: '#374151' }}>{formatDate(result.submitted_at)}</dd>
              </div>
            </dl>

            <p style={{
              margin: '0.9rem 0 0',
              paddingTop: '0.75rem',
              borderTop: `1px solid ${meta.border}`,
              fontSize: '0.82rem', color: meta.color, lineHeight: 1.6,
            }}>
              {meta.description}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}
