import '../css/PrivacyNotice.css';

/**
 * Privacy & Ethical Notice — the exact mandated statement.
 * Rendered on the About page, the /privacy page, and (optionally)
 * near the report submission flow.
 */
export function PrivacyNotice() {
  return (
    <div className="privacy-notice" role="note" aria-label="Privacy and ethical notice">
      <div className="privacy-notice-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Privacy &amp; Ethical Notice</span>
      </div>
      <p>
        Sensitive information involving minors, ongoing investigations, or family
        privacy requests may be restricted, anonymized, or withheld from public
        access upon the discretion of authorized administrators and law enforcement
        personnel.
      </p>
      <p>
        All submitted reports shall undergo verification before publication. TUKLAS
        adheres to the provisions of the Data Privacy Act of 2012 to ensure the
        protection and responsible handling of information.
      </p>
    </div>
  );
}
