'use client';

export interface AdminStats {
  pending: number;
  missing: number;
  unidentified: number;
  found: number;
}

interface StatCardsProps {
  stats: AdminStats;
}

interface CardDef {
  key: keyof AdminStats;
  label: string;
  color: 'yellow' | 'red' | 'orange' | 'green';
  icon: React.ReactNode;
}

export function StatCards({ stats }: StatCardsProps) {
  const cards: CardDef[] = [
    {
      key: 'pending',
      label: 'Pending Verification',
      color: 'yellow',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      key: 'missing',
      label: 'Active Missing Cases',
      color: 'red',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
          <line x1="18" y1="8" x2="23" y2="13"/>
          <line x1="23" y1="8" x2="18" y2="13"/>
        </svg>
      ),
    },
    {
      key: 'unidentified',
      label: 'Unidentified Records',
      color: 'orange',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
    },
    {
      key: 'found',
      label: 'Found / Resolved',
      color: 'green',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="stat-cards-grid" role="list" aria-label="Dashboard statistics">
      {cards.map(c => (
        <div key={c.key} className="stat-card" role="listitem">
          <div className="stat-card-header">
            <span className="stat-card-label">{c.label}</span>
            <div className={`stat-card-icon ${c.color}`}>{c.icon}</div>
          </div>
          <div className="stat-card-value">{stats[c.key]}</div>
        </div>
      ))}
    </div>
  );
}
