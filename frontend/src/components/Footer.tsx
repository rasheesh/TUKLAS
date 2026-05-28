import Link from 'next/link';
import Image from 'next/image';
import '../css/Footer.css';

export function Footer() {
  return (
    <footer className="footer" aria-label="Site footer">

      {/* ── Main grid ── */}
      <div className="footer-grid">

        {/* Col 1 — Brand & Mission */}
        <div className="footer-brand">
          <div className="footer-brand-logo">
            <Image
              src="/assets/icons/UBlogo.png"
              alt="University of Baguio seal"
              width={40}
              height={40}
            />
            <span className="footer-brand-name">TUKLAS</span>
          </div>
          <p className="footer-mission">
            Improving the visibility, reporting, and identification of missing and
            unidentified persons in Baguio City through centralized, searchable records.
          </p>
          <span className="footer-tagline">University of Baguio · 1948 · Philippines</span>
        </div>

        {/* Col 2 — Quick Links */}
        <div>
          <p className="footer-col-title">Quick Links</p>
          <nav className="footer-links" aria-label="Footer navigation">
            <Link href="/"        className="footer-link">Home</Link>
            <Link href="/cases"   className="footer-link">Browse Cases</Link>
            <Link href="/report"  className="footer-link">Report a Case</Link>
            <Link href="/map"     className="footer-link">Map</Link>
            <Link href="/about"   className="footer-link">About</Link>
          </nav>
        </div>

        {/* Col 3 — Security & Access */}
        <div>
          <p className="footer-col-title">Security &amp; Access</p>
          <div className="footer-links">
            <Link href="/privacy" className="footer-link">Data Privacy Policy</Link>
            <Link href="/terms"   className="footer-link">Terms of Use</Link>
            <Link href="/login"   className="footer-link-admin" aria-label="Admin portal login">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Admin Portal
            </Link>
          </div>
        </div>

        {/* Col 4 — Contact & Help */}
        <div>
          <p className="footer-col-title">Contact &amp; Help</p>
          <div className="footer-contact-items">
            <div className="footer-contact-item">
              <span className="footer-contact-label">Baguio City Police</span>
              <span className="footer-contact-value">
                <a href="tel:+63744424001">(074) 442-4001</a>
              </span>
            </div>
            <div className="footer-contact-item">
              <span className="footer-contact-label">DSWD Baguio</span>
              <span className="footer-contact-value">
                <a href="tel:+63744430366">(074) 443-0366</a>
              </span>
            </div>
            <div className="footer-contact-item">
              <span className="footer-contact-label">Emergency Hotline</span>
              <span className="footer-contact-value">
                <a href="tel:911">911</a>
              </span>
              <span className="footer-emergency-badge" aria-label="Emergency">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Emergency
              </span>
            </div>
            <div className="footer-contact-item">
              <span className="footer-contact-label">Email</span>
              <span className="footer-contact-value">
                <a href="mailto:tuklas@ub.edu.ph">tuklas@ub.edu.ph</a>
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── DPA Compliance Notice ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '1rem 0',
        fontSize: '0.75rem',
        lineHeight: 1.65,
        color: 'rgba(255,255,255,0.55)',
        textAlign: 'center',
        maxWidth: 780,
        margin: '0 auto',
        paddingLeft: '1rem',
        paddingRight: '1rem',
      }}>
        TUKLAS adheres to the provisions of the <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Data Privacy Act of 2012 (RA 10173)</strong> to
        ensure the protection and responsible handling of information. Sensitive information involving
        minors, ongoing investigations, or family privacy requests may be restricted, anonymized, or
        withheld from public access upon the discretion of authorized administrators and law enforcement
        personnel. All submitted reports shall undergo verification before publication.
      </div>

      {/* ── Bottom bar ── */}
      <div className="footer-bottom">
        <span className="footer-copyright">
          © 2026 TUKLAS — Baguio City Missing Persons Information System
        </span>
        <div className="footer-bottom-links">
          <Link href="/privacy" className="footer-bottom-link">Privacy</Link>
          <Link href="/terms"   className="footer-bottom-link">Terms</Link>
          <Link href="/about"   className="footer-bottom-link">About</Link>
        </div>
      </div>

    </footer>
  );
}
