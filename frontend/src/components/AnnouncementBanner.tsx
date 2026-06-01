'use client';

import { useEffect, useState } from 'react';
import '../css/AnnouncementBanner.css';

/* Bump this version to re-show the banner after editing the message. */
const DISMISS_KEY = 'tuklas_announcement_dismissed_v1';

/**
 * Mandated credibility notice shown on the Report page.
 * Static content (no admin CMS) per project decision.
 * Users can dismiss it; the choice is remembered in localStorage.
 */
export function AnnouncementBanner({ inReport = false }: { inReport?: boolean }) {
  /* Start hidden until we've checked localStorage to avoid a flash on reload. */
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== '1') setVisible(true);
    } catch {
      setVisible(true);   // localStorage blocked — show anyway
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch { /* ignore — dismissal just won't persist */ }
  };

  if (!visible) return null;

  return (
    <section className={`announcement-banner${inReport ? ' in-report' : ''}`} role="region" aria-label="Announcement">
      <div className="announcement-inner">
        <span className="announcement-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <path d="M3 11l18-5v12L3 14v-3z" />
            <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
          </svg>
        </span>
        <div className="announcement-text">
          <span className="announcement-tag">Announcement</span>
          <p>
            To maintain the reliability and credibility of the TUKLAS system, all
            submitted reports must include supporting attachments or verified sources
            for authentication and validation purposes. Reports without sufficient
            proof may undergo further verification before publication.
          </p>
        </div>
        <button
          type="button"
          className="announcement-close"
          onClick={dismiss}
          aria-label="Dismiss announcement"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </section>
  );
}
