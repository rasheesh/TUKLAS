'use client';

import { useEffect, useState } from 'react';
import { casesApi, ApiCase } from '@/src/lib/api';
import { ScrollReveal } from './ScrollReveal';

interface StatItem {
  label: string;
  value: number;
  color: string;
}

function computeStats(cases: ApiCase[]): StatItem[] {
  const total = cases.length;
  const missing = cases.filter(c => c.type === 'MISSING').length;
  const unidentified = cases.filter(c => c.type === 'UNIDENTIFIED').length;
  const resolved = cases.filter(c => c.status === 'FOUND' || c.status === 'IDENTIFIED').length;

  return [
    { label: 'Total Cases', value: total, color: '#701515' },
    { label: 'Missing Persons', value: missing, color: '#92400e' },
    { label: 'Unidentified Persons', value: unidentified, color: '#374151' },
    { label: 'Resolved Cases', value: resolved, color: '#15803d' },
  ];
}

export function Stats() {
  const [stats, setStats] = useState<StatItem[] | null>(null);

  useEffect(() => {
    casesApi.getPublic()
      .then(({ cases }) => setStats(computeStats(cases)))
      .catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  return (
    <section style={{
      background: '#fff',
      padding: '3.5rem 1.5rem',
      borderTop: '1px solid #eaecef',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <ScrollReveal>
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <h2 style={{
              fontSize: '1.65rem', fontWeight: 900,
              color: '#111827', margin: '0 0 0.3rem',
              letterSpacing: '-0.01em',
            }}>
              At a Glance
            </h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
              A live overview of missing and unidentified persons records in the system.
            </p>
          </div>
        </ScrollReveal>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.25rem',
        }}>
          {stats.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 100}>
              <div style={{
                background: '#fff',
                border: '1px solid #eaecef',
                borderRadius: 14,
                padding: '1.75rem 1.25rem',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  fontSize: '2.5rem', fontWeight: 900,
                  color: s.color, lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}>
                  {s.value.toLocaleString('en-PH')}
                </div>
                <div style={{
                  marginTop: '0.6rem', fontSize: '0.85rem',
                  fontWeight: 600, color: '#6b7280',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {s.label}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
