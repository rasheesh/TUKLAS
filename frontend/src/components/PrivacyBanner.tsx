'use client';

import { useState } from 'react';
import Link from 'next/link';

interface PrivacyBannerProps {
  variant?: 'report' | 'site';
}

export function PrivacyBanner({ variant = 'site' }: PrivacyBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (variant === 'report') {
    return (
      <div
        role="note"
        style={{
          background: 'rgba(112,21,21,0.04)',
          border: '1px solid rgba(112,21,21,0.18)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
          lineHeight: 1.65,
          color: '#374151',
        }}
      >
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#701515" strokeWidth="2" width="16" height="16" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <div>
            <strong style={{ color: '#701515' }}>Privacy Notice (RA 10173 — Data Privacy Act of 2012):</strong>{' '}
            Sensitive information involving minors, ongoing investigations, or family privacy requests
            may be restricted, anonymized, or withheld from public access at the discretion of authorized
            administrators. All submitted reports undergo verification before publication.
            {' '}
            <Link href="/about#privacy" style={{ color: '#701515', fontWeight: 600, textDecoration: 'underline' }}>
              Learn more
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="note"
      aria-label="Privacy and data notice"
      style={{
        background: '#fffbf0',
        borderBottom: '1px solid rgba(243,156,18,0.3)',
        padding: '0.65rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', fontSize: '0.8rem', lineHeight: 1.55, color: '#374151',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#d35400" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>
          <strong>Data Privacy Act of 2012 (RA 10173):</strong>{' '}
          TUKLAS adheres to responsible handling of personal information.
          Sensitive data involving minors or ongoing investigations may be restricted from public view.
          {' '}
          <Link href="/about#privacy" style={{ color: '#d35400', fontWeight: 600, textDecoration: 'underline' }}>
            Privacy Statement
          </Link>
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss privacy notice"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9b7a4a', padding: '2px', flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
