import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { ScrollReveal } from '@/src/components/ScrollReveal';

/* ── Section header helper ── */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '1.35rem', fontWeight: 800,
      color: 'var(--color-primary, #701515)',
      marginBottom: '0.75rem', marginTop: 0,
      paddingBottom: '0.4rem',
      borderBottom: '2px solid rgba(112,21,21,0.12)',
    }}>
      {children}
    </h2>
  );
}

/* ── Feature card ── */
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', gap: '0.85rem', alignItems: 'flex-start',
      padding: '0.85rem 1rem',
      background: '#fff', border: '1px solid #eaecef',
      borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        flexShrink: 0, width: 38, height: 38,
        background: 'rgba(112,21,21,0.08)',
        borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#701515',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{title}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-light, #6b7280)', lineHeight: 1.55 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ── Team member card ── */
function TeamCard({ name, role }: { name: string; role: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '0.5rem', padding: '1rem',
      background: '#fff', border: '1px solid #eaecef',
      borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'rgba(112,21,21,0.1)', color: '#701515',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em',
      }}>
        {initials}
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{name}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light, #6b7280)' }}>{role}</div>
    </div>
  );
}

/* ── Page ── */
export default function AboutPage() {
  return (
    <>
      <Navbar />

      <main style={{ background: '#f8f9fa', minHeight: '100vh', fontFamily: 'var(--font-family)' }}>

        {/* ── Hero banner ── */}
        <section style={{
          background: 'linear-gradient(135deg, #701515 0%, #9b1c1c 100%)',
          color: '#fff', padding: '4rem 2rem 3rem',
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Image
                src="/assets/icons/UBlogo.png"
                alt="TUKLAS — University of Baguio"
                width={80}
                height={80}
              />
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.01em' }}>
              About TUKLAS
            </h1>
            <p style={{ fontSize: '1.1rem', opacity: 0.88, maxWidth: 560, margin: '0 auto', lineHeight: 1.65 }}>
              A centralized, community-driven platform for the reporting, identification, and
              resolution of missing and unidentified persons cases in Baguio City, Philippines.
            </p>
          </div>
        </section>

        {/* ── Content ── */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem' }}>

          {/* ── Background ── */}
          <ScrollReveal style={{ marginBottom: '3rem' }}>
            <SectionHeading>Background</SectionHeading>
            <div style={{ lineHeight: 1.8, fontSize: '0.92rem', color: '#374151' }}>
              <p>
                TUKLAS (a Filipino word meaning &ldquo;to discover&rdquo; or &ldquo;to find&rdquo;) was developed by
                researchers and students of the University of Baguio in response to the persistent
                challenge of missing and unidentified persons in the Cordillera region. Traditional
                methods of reporting and cross-referencing cases were fragmented across barangay
                offices, police stations, and social media &mdash; creating critical gaps that
                delayed families from being reunited.
              </p>
              <p style={{ marginTop: '1rem' }}>
                TUKLAS integrates modern web technologies with geo-mapping and algorithmic case
                matching to provide a single, searchable, and verified repository of missing and
                unidentified persons reports. The system is designed to support not only families
                and community members but also law enforcement, social workers, and media
                organizations involved in missing persons cases.
              </p>
            </div>
          </ScrollReveal>

          {/* ── Objectives ── */}
          <ScrollReveal style={{ marginBottom: '3rem' }}>
            <SectionHeading>Objectives</SectionHeading>
            <ol style={{ lineHeight: 1.9, fontSize: '0.92rem', color: '#374151', paddingLeft: '1.4rem' }}>
              <li>Provide a centralized, publicly accessible database of missing and unidentified persons in Baguio City.</li>
              <li>Enable faster information sharing between community members, barangay officials, and law enforcement agencies.</li>
              <li>Reduce the time required to match missing persons with unidentified individuals through algorithmic case matching.</li>
              <li>Ensure report credibility through an evidence-based verification system administered by authorized personnel.</li>
              <li>Protect the privacy and dignity of individuals — especially minors — in accordance with the Data Privacy Act of 2012.</li>
              <li>Support law enforcement and DSWD efforts by providing structured, filterable, and geographically tagged records.</li>
            </ol>
          </ScrollReveal>

          {/* ── Features ── */}
          <ScrollReveal style={{ marginBottom: '3rem' }}>
            <SectionHeading>Key Features</SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
              <FeatureCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                title="Searchable Case Database"
                desc="Filter missing and unidentified person reports by barangay, gender, case type, and status."
              />
              <FeatureCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 13-8 13S4 15.4 4 10a8 8 0 0 1 8-8z"/></svg>}
                title="Geo-Mapped Reports"
                desc="Interactive map showing case locations across Baguio City barangays for spatial context."
              />
              <FeatureCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>}
                title="Algorithmic Case Matching"
                desc="Automatically identifies potential matches between missing and unidentified persons using physical traits and location proximity."
              />
              <FeatureCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                title="Verification System"
                desc="All reports undergo admin review before publication. Proof documents and source links are required to prevent misinformation."
              />
              <FeatureCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>}
                title="Evidence-Based Reporting"
                desc="Reporters can attach official documents, certifications, or verified source links to support their submissions."
              />
              <FeatureCard
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                title="Privacy-First Design"
                desc="Sensitive information about minors and ongoing investigations is restricted or anonymized upon admin discretion."
              />
            </div>
          </ScrollReveal>

          {/* ── Ethical Considerations ── */}
          <ScrollReveal style={{ marginBottom: '3rem' }}>
            <SectionHeading>Ethical Considerations</SectionHeading>
            <div style={{
              background: '#fff', border: '1px solid #eaecef',
              borderRadius: '12px', padding: '1.5rem',
              lineHeight: 1.8, fontSize: '0.91rem', color: '#374151',
            }}>
              <p>
                TUKLAS operates under a strong ethical framework that guides every aspect of
                how information is collected, stored, and published. The following principles
                govern the platform:
              </p>
              <ul style={{ paddingLeft: '1.4rem', marginTop: '0.75rem' }}>
                <li style={{ marginBottom: '0.6rem' }}>
                  <strong>Dignity and Respect:</strong> All persons — living or deceased, identified or unidentified —
                  are treated with dignity. Dehumanizing descriptions are prohibited, and administrators
                  are trained to handle sensitive cases with discretion.
                </li>
                <li style={{ marginBottom: '0.6rem' }}>
                  <strong>Minimization:</strong> Only information necessary for identification and case resolution
                  is collected. Reporter contact details are never displayed publicly and are visible
                  only to authorized administrators.
                </li>
                <li style={{ marginBottom: '0.6rem' }}>
                  <strong>Minor Protection:</strong> Cases involving persons under 18 years of age have their
                  photos automatically restricted from public view. Disclosure requires explicit admin
                  approval and must be proportional to the urgency of the case.
                </li>
                <li style={{ marginBottom: '0.6rem' }}>
                  <strong>Verification Before Publication:</strong> No report is published without admin review.
                  This prevents the spread of false information that could harm families or
                  misdirect search efforts.
                </li>
                <li style={{ marginBottom: '0.6rem' }}>
                  <strong>Transparency:</strong> Reporters are informed of how their data will be used, stored,
                  and who can access it before they submit a report. Consent is explicitly captured.
                </li>
                <li>
                  <strong>Non-Discrimination:</strong> TUKLAS accepts reports regardless of the victim&apos;s
                  background, ethnicity, religion, or social status. All cases are treated with equal
                  urgency and care.
                </li>
              </ul>
            </div>
          </ScrollReveal>

          {/* ── Data Privacy ── */}
          <ScrollReveal style={{ marginBottom: '3rem' }}>
            <SectionHeading>Data Privacy Statement</SectionHeading>
            <div style={{
              background: 'rgba(112,21,21,0.04)', border: '1.5px solid rgba(112,21,21,0.15)',
              borderRadius: '12px', padding: '1.5rem',
              lineHeight: 1.8, fontSize: '0.91rem', color: '#374151',
            }}>
              <p style={{ fontWeight: 700, color: '#701515', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                TUKLAS adheres to the provisions of the Data Privacy Act of 2012 (Republic Act No. 10173)
                to ensure the protection and responsible handling of all submitted information.
              </p>
              <p>
                &ldquo;Sensitive information involving minors, ongoing investigations, or family privacy
                requests may be restricted, anonymized, or withheld from public access upon the
                discretion of authorized administrators and law enforcement personnel.
                All submitted reports shall undergo verification before publication. TUKLAS adheres
                to the provisions of the Data Privacy Act of 2012 to ensure the protection and
                responsible handling of information.&rdquo;
              </p>
              <ul style={{ paddingLeft: '1.4rem', marginTop: '0.75rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>Personal data is collected only with the explicit consent of the submitting party.</li>
                <li style={{ marginBottom: '0.5rem' }}>Data is used solely for the purpose of locating and identifying missing or unidentified persons.</li>
                <li style={{ marginBottom: '0.5rem' }}>Proof documents are stored in a private, access-controlled storage system and are accessible only to authorized administrators.</li>
                <li style={{ marginBottom: '0.5rem' }}>Every admin access to proof documents is logged in an audit trail for compliance purposes.</li>
                <li style={{ marginBottom: '0.5rem' }}>Resolved cases are archived after one year; proof documents are deleted from storage.</li>
                <li style={{ marginBottom: '0.5rem' }}>Data subjects may request correction or deletion of their submitted information by contacting the TUKLAS administrators.</li>
                <li>TUKLAS is registered as a Personal Information Controller with the National Privacy Commission (NPC).</li>
              </ul>
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(112,21,21,0.06)', borderRadius: '8px', fontSize: '0.83rem' }}>
                For data privacy inquiries or requests, contact:{' '}
                <a href="mailto:tuklas@ub.edu.ph" style={{ color: '#701515', fontWeight: 600 }}>tuklas@ub.edu.ph</a>
              </div>
            </div>
          </ScrollReveal>

          {/* ── Research Team ── */}
          <ScrollReveal style={{ marginBottom: '3rem' }}>
            <SectionHeading>Research &amp; Development Team</SectionHeading>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text-light)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              TUKLAS was developed as a thesis project by the following members of the
              University of Baguio, College of Information Technology.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <TeamCard name="Research Team" role="Project Lead" />
              <TeamCard name="University of Baguio" role="Institution" />
              <TeamCard name="IT Department" role="Technical Advisers" />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: 1.6 }}>
              This system was developed in coordination with the Baguio City Police Office and
              the Department of Social Welfare and Development (DSWD) — Cordillera Administrative Region.
            </p>
          </ScrollReveal>

          {/* ── CTA ── */}
          <ScrollReveal>
            <div style={{
              textAlign: 'center', padding: '2rem',
              background: '#fff', border: '1px solid #eaecef',
              borderRadius: '14px',
            }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                Help Bring Someone Home
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-light)', maxWidth: 480, margin: '0 auto 1.25rem', lineHeight: 1.65 }}>
                If you have information about a missing or unidentified person, please submit a report.
                Every verified report brings us closer to reuniting families.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link
                  href="/report"
                  style={{
                    padding: '0.6rem 1.5rem', background: '#701515', color: '#fff',
                    borderRadius: '8px', textDecoration: 'none',
                    fontWeight: 700, fontSize: '0.9rem',
                  }}
                >
                  Report a Case
                </Link>
                <Link
                  href="/cases"
                  style={{
                    padding: '0.6rem 1.5rem', background: '#f8f9fa',
                    color: '#374151', border: '1px solid #d1d5db',
                    borderRadius: '8px', textDecoration: 'none',
                    fontWeight: 700, fontSize: '0.9rem',
                  }}
                >
                  Search Cases
                </Link>
              </div>
            </div>
          </ScrollReveal>

        </div>
      </main>

      <Footer />
    </>
  );
}
