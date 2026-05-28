'use client';

import Image from 'next/image';

export type CaseStatus = 'missing' | 'unidentified' | 'found';
export type VerificationStatus = 'verified' | 'pending';

export interface CaseData {
  id: string;
  name: string;
  barangay: string;
  age: number;
  gender: 'Male' | 'Female';
  lastSeen: string;        // ISO date string
  imageUrl: string;
  status: CaseStatus;
  verification: VerificationStatus;
}

interface CaseCardProps {
  data: CaseData;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export function CaseCard({ data }: CaseCardProps) {
  const { name, barangay, age, gender, lastSeen, imageUrl, status, verification } = data;

  return (
    <article className="case-card" role="article" aria-label={`Case: ${name}`}>
      {/* Image */}
      <div className="case-card-image">
        <Image
          src={imageUrl}
          alt={`Photo of ${name}`}
          fill
          sizes="(max-width: 480px) 50vw, (max-width: 768px) 45vw, (max-width: 1024px) 30vw, 22vw"
          style={{ objectFit: 'cover' }}
          loading="lazy"
        />
        <span className={`case-badge ${verification}`} aria-label={verification}>
          {verification === 'verified' ? '✓ Verified' : '⏳ Pending'}
        </span>
      </div>

      {/* Body */}
      <div className="case-card-body">
        <h4 className="case-card-name" title={name}>{name}</h4>

        <div className="case-card-meta">
          {/* Location */}
          <div className="case-card-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>{barangay}</span>
          </div>

          {/* Date */}
          <div className="case-card-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Last Seen: {formatDate(lastSeen)}</span>
          </div>

          {/* Age & Gender */}
          <div className="case-card-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>{age} yrs · {gender}</span>
          </div>
        </div>

        {/* Type tag */}
        <div className="case-card-tag">
          <span className={`case-tag ${status}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>
    </article>
  );
}
