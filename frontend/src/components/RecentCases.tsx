'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { casesApi, ApiCase } from '@/src/lib/api';
import { ScrollReveal } from './ScrollReveal';

function formatAge(c: ApiCase): string {
  if (c.age_approx) return `~${c.age_approx} yrs`;
  if (c.age_range_min != null && c.age_range_max != null) return `${c.age_range_min}–${c.age_range_max} yrs`;
  if (c.age_range_min != null) return `${c.age_range_min}+ yrs`;
  if (c.age_range_max != null) return `under ${c.age_range_max} yrs`;
  return 'Age unknown';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function CaseCard({ c }: { c: ApiCase }) {
  const isMissing = c.type === 'MISSING';
  const displayName = c.full_name?.trim() || 'Unidentified Person';

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #eaecef',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 180ms ease, box-shadow 180ms ease',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
      }}
    >
      {/* Photo area */}
      <div style={{ position: 'relative', height: 180, background: '#f3f4f6', overflow: 'hidden' }}>
        {c.photo_url && !c.photo_hidden ? (
          <Image
            src={c.photo_url}
            alt={displayName}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 768px) 90vw, 33vw"
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#d1d5db',
          }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="56" height="56" aria-hidden="true">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          </div>
        )}
        {/* Type badge */}
        <span style={{
          position: 'absolute', top: 10, left: 10,
          background: isMissing ? '#701515' : '#374151',
          color: '#fff', fontSize: '0.7rem', fontWeight: 700,
          padding: '3px 9px', borderRadius: 20, letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {isMissing ? 'Missing' : 'Unidentified'}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '1rem 1.1rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111827', lineHeight: 1.3 }}>
          {displayName}
        </div>

        <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>{formatAge(c)}</span>
          {c.gender !== 'UNKNOWN' && (
            <span style={{ color: '#9ca3af' }}>·</span>
          )}
          {c.gender !== 'UNKNOWN' && (
            <span style={{ textTransform: 'capitalize', color: '#6b7280' }}>
              {c.gender.charAt(0) + c.gender.slice(1).toLowerCase()}
            </span>
          )}
        </div>

        {c.barangay_name && (
          <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              width="13" height="13" style={{ flexShrink: 0 }} aria-hidden="true">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 13-8 13S4 15.4 4 10a8 8 0 0 1 8-8z"/>
            </svg>
            {c.barangay_name}
          </div>
        )}

        {c.incident_date && (
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>
            {formatDate(c.incident_date)}
          </div>
        )}
      </div>
    </div>
  );
}

export function RecentCases() {
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    casesApi.getPublic()
      .then(({ cases }) => {
        const sorted = [...cases]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3);
        setCases(sorted);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (error) return null;

  return (
    <section style={{
      background: '#f8f9fa',
      padding: '4rem 1.5rem',
      borderTop: '1px solid #eaecef',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Section header */}
        <ScrollReveal>
          <div style={{
            display: 'flex', alignItems: 'flex-end',
            justifyContent: 'space-between', flexWrap: 'wrap',
            gap: '0.75rem', marginBottom: '2rem',
          }}>
            <div>
              <h2 style={{
                fontSize: '1.65rem', fontWeight: 900,
                color: '#111827', margin: '0 0 0.3rem',
                letterSpacing: '-0.01em',
              }}>
                Recent Cases
              </h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                The latest verified missing and unidentified persons reports in Baguio City.
              </p>
            </div>
            <Link href="/cases" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              color: '#701515', fontWeight: 700, fontSize: '0.88rem',
              textDecoration: 'none',
            }}>
              View All Cases
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                width="14" height="14" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          </div>
        </ScrollReveal>

        {/* Cards */}
        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                background: '#e5e7eb', borderRadius: 14, height: 290,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem',
            color: '#9ca3af', fontSize: '0.9rem',
          }}>
            No cases to display yet.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}>
            {cases.map((c, i) => (
              <ScrollReveal key={c.id} delay={i * 100}>
                <CaseCard c={c} />
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </section>
  );
}
