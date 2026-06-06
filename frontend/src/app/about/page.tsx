import Image from 'next/image';
import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { PrivacyNotice } from '@/src/components/PrivacyNotice';
import '../../css/About.css';

export const metadata = {
  title: 'About — TUKLAS',
};

const FEATURES = [
  {
    title: 'Report a Case',
    body: 'Submit missing-person or unidentified-person reports with photos, details, and supporting proof.',
  },
  {
    title: 'Proof Verification',
    body: 'Attach police reports, barangay certifications, news articles, or verified source links for validation.',
  },
  {
    title: 'Searchable Database',
    body: 'A public, filterable record of verified cases to maximize visibility and the chance of resolution.',
  },
  {
    title: 'Geo-Mapping',
    body: 'Visualize cases by location and incident date to surface patterns and connections.',
  },
  {
    title: 'Case Matching',
    body: 'Suggests potential matches between missing and unidentified persons to accelerate identification.',
  },
  {
    title: 'Admin & Audit Tools',
    body: 'Authorized staff verify reports and manage cases with a complete, immutable audit trail.',
  },
];

const OBJECTIVES = [
  'Provide a centralized database for missing persons and unidentified individuals in Baguio City.',
  'Accelerate case resolution through rapid, verified information sharing.',
  'Enable community participation while protecting data integrity and credibility.',
  'Support law enforcement investigations with organized, verifiable information.',
  'Increase public awareness and engagement in missing-persons cases.',
];

const TEAM_MEMBERS = [
  { name: 'Lorden Xavier Alvaro', photo: '/assets/icons/Lorden Xavier_Alvaro.png' },
  { name: 'Fiona Alcantara', photo: '/assets/icons/Fiona_Alcantara.png' },
  { name: 'Elysha Margaret Bianan', photo: '/assets/icons/Elysha Margaret_Bianan.png' },
  { name: 'Luane Hernandez', photo: '/assets/icons/Luane_Hernandez.png' },
  { name: 'Jomar Poclan', photo: '/assets/icons/Jomar_Poclan.png' },
  { name: 'John Paulo Tasane', photo: '/assets/icons/John Paulo_Tasane.png' },
  { name: 'Mary Joyce Villanueva', photo: '/assets/icons/Mary Joyce_Villanueva.png' },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="about-container">
        {/* Hero */}
        <section className="about-hero">
          <div className="about-hero-content">
            <h1>About TUKLAS</h1>
            <p className="about-hero-subtitle">
              A centralized missing and unidentified persons information system for Baguio City.
            </p>
          </div>
        </section>

        {/* Background */}
        <section className="about-section">
          <h2>Background</h2>
          <p>
            TUKLAS is a community-driven information system developed to address the
            challenge of missing and unidentified persons in Baguio City. By unifying
            public reports, police and barangay documentation, and community knowledge
            into a single verified platform, TUKLAS helps ensure that no case is
            overlooked and that every credible lead is properly documented.
          </p>
          <p>
            The system bridges the gap between public reporting and official
            investigations — making information searchable, mappable, and matchable so
            that families, communities, and authorities can act faster.
          </p>
        </section>

        {/* Objectives */}
        <section className="about-section">
          <h2>Objectives</h2>
          <ul className="about-list">
            {OBJECTIVES.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>

        {/* Features */}
        <section className="about-section">
          <h2>Features</h2>
          <div className="about-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="about-feature-card">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ethical considerations */}
        <section className="about-section">
          <h2>Ethical Considerations</h2>
          <div className="about-ethics">
            <div>
              <h3>Child Safety &amp; Privacy</h3>
              <p>
                Reports involving minors receive special protection. Photographs and
                identifying information may be restricted or anonymized at the
                discretion of administrators and law enforcement.
              </p>
            </div>
            <div>
              <h3>Ongoing Investigations</h3>
              <p>
                Cases tied to active investigations are reviewed by authorized personnel
                before publication to avoid compromising investigative integrity or safety.
              </p>
            </div>
            <div>
              <h3>Family Privacy</h3>
              <p>
                We honor requests from families to restrict information from public view.
                Privacy requests are reviewed and applied with appropriate discretion.
              </p>
            </div>
            <div>
              <h3>Responsible Sharing</h3>
              <p>
                Every report undergoes verification before publication. False or
                misleading submissions are rejected to protect the system&apos;s credibility.
              </p>
            </div>
          </div>
        </section>

        {/* Data privacy statement */}
        <section className="about-section">
          <h2>Data Privacy Statement</h2>
          <PrivacyNotice />
        </section>

        {/* Researchers / Developers */}
        <section className="about-section">
          <h2>Researchers &amp; Developers</h2>
          <p>
            TUKLAS was developed by a team of researchers and developers from the
            University of Baguio, committed to applying technology for social good in
            partnership with the community and local authorities.
          </p>
          {/* Team — members are listed alphabetically by surname */}
          <div className="about-team">
            {TEAM_MEMBERS.map((m) => (
              <article key={m.name} className="about-member-card">
                <div className="about-member-photo">
                  <Image
                    src={m.photo}
                    alt={m.name}
                    fill
                    sizes="(max-width: 900px) 45vw, 220px"
                  />
                </div>
                <div className="about-member-info">
                  <h3 className="about-member-name">{m.name}</h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
