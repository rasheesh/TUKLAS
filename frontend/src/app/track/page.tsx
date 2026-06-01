'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { casesApi, ApiError, type TrackedReport } from '../../lib/api';
import '../../css/Track.css';

// ── Status presentation ────────────────────────────────────
const STATUS_META: Record<
  TrackedReport['status'],
  { label: string; tone: 'pending' | 'verified' | 'resolved' | 'rejected'; blurb: string }
> = {
  PENDING: {
    label: 'Pending Review',
    tone: 'pending',
    blurb: 'Your report has been received and is waiting to be reviewed by our team.',
  },
  VERIFIED: {
    label: 'Verified & Published',
    tone: 'verified',
    blurb: 'Your report has been verified and is now published publicly.',
  },
  FOUND: {
    label: 'Resolved — Person Found',
    tone: 'resolved',
    blurb: 'This case has been resolved. The missing person has been found.',
  },
  IDENTIFIED: {
    label: 'Resolved — Person Identified',
    tone: 'resolved',
    blurb: 'This case has been resolved. The individual has been identified.',
  },
  REJECTED: {
    label: 'Not Approved',
    tone: 'rejected',
    blurb: 'After review, this report was not approved for publication. See the reason below.',
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Timeline derivation ────────────────────────────────────
interface TimelineStep {
  label: string;
  date: string | null;
  state: 'done' | 'current' | 'upcoming';
}

function buildTimeline(r: TrackedReport): TimelineStep[] {
  /* Rejected reports follow a separate, shorter path that ends at review. */
  if (r.status === 'REJECTED') {
    return [
      { label: 'Report Submitted', date: r.created_at, state: 'done' },
      { label: 'Under Review', date: null, state: 'done' },
      { label: 'Not Approved', date: r.rejected_at, state: 'current' },
    ];
  }

  /* How far the case has progressed; the rest show as greyed-out upcoming. */
  const currentIndex =
    r.status === 'PENDING' ? 1 : r.status === 'VERIFIED' ? 2 : 3;

  const raw = [
    { label: 'Report Submitted', date: r.created_at },
    { label: 'Under Review', date: null },
    { label: 'Verified & Published', date: r.verified_at },
    {
      label: r.type === 'MISSING' ? 'Person Found' : 'Person Identified',
      date: r.resolved_at,
    },
  ];

  return raw.map((s, i): TimelineStep => ({
    label: s.label,
    date: s.date,
    state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming',
  }));
}

// ── Tracker form + result ──────────────────────────────────
function TrackContent() {
  const params = useSearchParams();
  const [reference, setReference] = useState('');
  const [report, setReport] = useState<TrackedReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runLookup = async (ref: string) => {
    const trimmed = ref.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter your reference number.');
      return;
    }
    setLoading(true);
    setError('');
    setReport(null);
    setSearched(true);
    try {
      const { report } = await casesApi.trackByReference(trimmed);
      setReport(report);
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* Allow deep-linking from the success screen: /track?ref=TKL-2026-00001 */
  useEffect(() => {
    const ref = params.get('ref');
    if (ref) {
      setReference(ref);
      runLookup(ref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runLookup(reference);
  };

  const meta = report ? STATUS_META[report.status] : null;
  const timeline = report ? buildTimeline(report) : [];

  return (
    <main className="track-content">
      <div className="track-heading">
        <h1>Track Your Report</h1>
        <p>
          Enter the reference number from your confirmation screen to see the
          current status of your report — including reports still pending review.
        </p>
      </div>

      <form className="track-form" onSubmit={handleSubmit}>
        <div className="track-input-wrap">
          <span className="track-input-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-4 0v2" /><line x1="12" y1="12" x2="12" y2="16" />
            </svg>
          </span>
          <input
            type="text"
            className="track-input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. TKL-2026-00001"
            aria-label="Reference number"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button type="submit" className="track-submit" disabled={loading}>
          {loading ? 'Checking…' : 'Track Report'}
        </button>
      </form>

      {error && (
        <div className="track-error" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {report && meta && (
        <div className="track-result" role="region" aria-label="Report status">
          {/* Status header */}
          <div className="track-result-head">
            <div>
              <span className="track-result-ref-label">Reference Number</span>
              <span className="track-result-ref">{report.reference}</span>
            </div>
            <span className={`track-status-badge ${meta.tone}`}>{meta.label}</span>
          </div>

          <p className="track-status-blurb">{meta.blurb}</p>

          {/* Rejection reason — only when the report was not approved */}
          {report.status === 'REJECTED' && (
            <div className="track-rejection" role="note">
              <span className="track-rejection-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Reason for rejection
              </span>
              <p className="track-rejection-text">
                {report.rejection_reason || 'No reason was provided. Please contact our team with your reference number for more details.'}
              </p>
            </div>
          )}

          {/* Timeline */}
          <ol className="track-timeline">
            {timeline.map((step, i) => (
              <li key={i} className={`track-step ${step.state}`}>
                <span className="track-step-dot" aria-hidden="true">
                  {step.state === 'done' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="12" height="12">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <div className="track-step-body">
                  <span className="track-step-label">{step.label}</span>
                  {step.date && <span className="track-step-date">{formatDate(step.date)}</span>}
                  {step.state === 'current' && (
                    <span className="track-step-current-tag">Current stage</span>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Case summary */}
          <div className="track-summary">
            <h2 className="track-summary-title">Report Details</h2>
            <dl className="track-summary-grid">
              <div>
                <dt>Type</dt>
                <dd>{report.type === 'MISSING' ? 'Missing Person' : 'Unidentified Person'}</dd>
              </div>
              {report.full_name && (
                <div>
                  <dt>Name</dt>
                  <dd>{report.full_name}{report.nickname ? ` (${report.nickname})` : ''}</dd>
                </div>
              )}
              {report.barangay_name && (
                <div>
                  <dt>Barangay</dt>
                  <dd>{report.barangay_name}</dd>
                </div>
              )}
              {report.location_text && (
                <div>
                  <dt>Location</dt>
                  <dd>{report.location_text}</dd>
                </div>
              )}
              {report.incident_date && (
                <div>
                  <dt>{report.type === 'MISSING' ? 'Date Last Seen' : 'Date Found'}</dt>
                  <dd>{formatDate(report.incident_date)}</dd>
                </div>
              )}
              {report.created_at && (
                <div>
                  <dt>Submitted</dt>
                  <dd>{formatDate(report.created_at)}</dd>
                </div>
              )}
              {report.identified_name && (
                <div>
                  <dt>Identified As</dt>
                  <dd>{report.identified_name}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      {searched && !report && !error && !loading && (
        <p className="track-empty">No results.</p>
      )}

      <p className="track-help">
        Lost your reference number? It was shown once on the confirmation screen
        after submitting. We do not send confirmation emails, so we may not be
        able to recover a report without it.
      </p>
    </main>
  );
}

export default function TrackPage() {
  return (
    <div className="track-page">
      <Navbar />
      <Suspense fallback={<main className="track-content" />}>
        <TrackContent />
      </Suspense>
      <Footer />
    </div>
  );
}
