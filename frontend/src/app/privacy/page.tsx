import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { PrivacyNotice } from '@/src/components/PrivacyNotice';
import '../../css/About.css';

export const metadata = {
  title: 'Data Privacy Policy — TUKLAS',
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="about-container">
        <section className="about-hero">
          <div className="about-hero-content">
            <h1>Data Privacy Policy</h1>
            <p className="about-hero-subtitle">
              How TUKLAS collects, protects, and responsibly handles information.
            </p>
          </div>
        </section>

        <section className="about-section">
          <PrivacyNotice />
        </section>

        <section className="about-section">
          <h2>Our Commitment</h2>
          <p>
            TUKLAS adheres to the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>
            {' '}and all applicable privacy laws of the Republic of the Philippines. We are committed to:
          </p>
          <ul className="about-list">
            <li>Protecting personal data from unauthorized access, use, or disclosure.</li>
            <li>Using submitted information solely for the purpose of locating and identifying missing or unidentified persons.</li>
            <li>Implementing reasonable organizational, physical, and technical security measures to safeguard data.</li>
            <li>Honoring legitimate requests for access, correction, or removal of personal information.</li>
            <li>Maintaining transparency in how information is collected, verified, and used.</li>
          </ul>
        </section>

        <section className="about-section">
          <h2>Information We Collect</h2>
          <ul className="about-list">
            <li><strong>Case details</strong> — names, descriptions, photographs, last-known or found locations, and incident dates.</li>
            <li><strong>Supporting proof</strong> — documents and source links submitted to verify a report.</li>
            <li><strong>Reporter contact</strong> — kept private and visible only to authorized administrators.</li>
          </ul>
        </section>

        <section className="about-section">
          <h2>Verification &amp; Restriction</h2>
          <p>
            Every report undergoes verification before it is published publicly. Reports
            without sufficient proof may be subject to further verification. Sensitive
            cases — particularly those involving minors, ongoing investigations, or explicit
            family privacy requests — may be anonymized, restricted, or withheld from public
            view at the discretion of authorized administrators and law enforcement personnel.
          </p>
        </section>

        <section className="about-section">
          <h2>Contact</h2>
          <p>
            For questions about this policy or to make a data privacy request, contact us at{' '}
            <a href="mailto:tuklas@ub.edu.ph">tuklas@ub.edu.ph</a>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
