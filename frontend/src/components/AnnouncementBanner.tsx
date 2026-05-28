'use client';

import { useState } from 'react';

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <section
      aria-label="System announcement"
      style={{
        background: '#fff8e1',
        borderBottom: '2px solid rgba(243,156,18,0.35)',
        padding: '0.9rem 1.5rem',
      }}
    >
      <div style={{
        maxWidth: 900, margin: '0 auto',
        display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
        fontSize: '0.85rem', lineHeight: 1.65, color: '#374151',
      }}>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"
          width="18" height="18"
          style={{ flexShrink: 0, marginTop: '2px' }}
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p style={{ margin: 0, flex: 1 }}>
          <strong style={{ color: '#92400e' }}>Important Notice:</strong>{' '}
          To maintain the reliability and credibility of the TUKLAS system, all submitted reports
          must include supporting attachments or verified sources for authentication and validation
          purposes. Reports without sufficient proof may undergo further verification before
          publication.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notice"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#92400e', padding: '2px', flexShrink: 0,
            opacity: 0.65, lineHeight: 1, display: 'flex', alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            width="16" height="16" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </section>
  );
}
