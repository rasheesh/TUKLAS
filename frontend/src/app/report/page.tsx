'use client';

import { useState } from 'react';
import { Navbar } from '@/src/components/Navbar';
import { StepIdentity, IdentityData } from '../../components/ReportForm/StepIdentity';
import { StepIncident, IncidentData } from '../../components/ReportForm/StepIncident';
import { StepMedia, MediaData } from '../../components/ReportForm/StepMedia';
import '../../css/ReportForm.css';

// ── Types ──────────────────────────────────────────────────
type ReportType = 'missing' | 'unidentified';
type FormStep = 'selection' | 1 | 2 | 3 | 'processing' | 'success';

// ── Helpers ────────────────────────────────────────────────
function generateCaseRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `TKL-${year}-${rand}`;
}

const EMPTY_IDENTITY: IdentityData = {
  name: '',
  nickname: '',
  approximateAge: '',
  gender: '',
  physicalDescription: '',
};

const EMPTY_INCIDENT: IncidentData = {
  barangay: '',
  date: '',
  time: '',
  location: '',
};

const EMPTY_MEDIA: MediaData = {
  photos: [],
  reporterName: '',
  reporterContact: '',
};

// ── Step meta ──────────────────────────────────────────────
const STEPS: { num: 1 | 2 | 3; label: string }[] = [
  { num: 1, label: 'Identity' },
  { num: 2, label: 'Incident' },
  { num: 3, label: 'Media & Contact' },
];

// ── Component ──────────────────────────────────────────────
export default function ReportPage() {
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [step, setStep] = useState<FormStep>('selection');
  const [slideOut, setSlideOut] = useState(false);
  const [caseRef, setCaseRef] = useState('');

  const [identityData, setIdentityData] = useState<IdentityData>(EMPTY_IDENTITY);
  const [incidentData, setIncidentData] = useState<IncidentData>(EMPTY_INCIDENT);
  const [mediaData, setMediaData] = useState<MediaData>(EMPTY_MEDIA);

  const [identityErrors, setIdentityErrors] = useState<Partial<Record<keyof IdentityData, string>>>({});
  const [incidentErrors, setIncidentErrors] = useState<Partial<Record<keyof IncidentData, string>>>({});
  const [mediaErrors, setMediaErrors] = useState<Partial<Record<keyof MediaData, string>>>({});

  // ── Selection ────────────────────────────────────────────
  const handleSelectType = (type: ReportType) => {
    setReportType(type);
    setSlideOut(true);
    setTimeout(() => {
      setStep(1);
      setSlideOut(false);
    }, 300);
  };

  // ── Progress bar width ───────────────────────────────────
  const progressWidth = (): string => {
    if (step === 'selection') return '0%';
    if (step === 1) return '33%';
    if (step === 2) return '66%';
    if (step === 3 || step === 'processing' || step === 'success') return '100%';
    return '0%';
  };

  // ── Validation ───────────────────────────────────────────
  const validateStep1 = (): boolean => {
    const errs: Partial<Record<keyof IdentityData, string>> = {};
    if (reportType === 'missing') {
      if (!identityData.name.trim()) errs.name = 'Full name is required.';
      if (!identityData.approximateAge.trim()) errs.approximateAge = 'Age is required.';
      if (!identityData.gender) errs.gender = 'Gender is required.';
    } else {
      if (!identityData.approximateAge.trim()) errs.approximateAge = 'Approximate age is required.';
      if (!identityData.gender) errs.gender = 'Gender is required.';
      if (!identityData.physicalDescription.trim())
        errs.physicalDescription = 'Physical description is required.';
    }
    setIdentityErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Partial<Record<keyof IncidentData, string>> = {};
    if (!incidentData.barangay) errs.barangay = 'Please select a barangay.';
    if (!incidentData.date) errs.date = 'Date is required.';
    if (!incidentData.location.trim()) errs.location = 'Specific location is required.';
    setIncidentErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Partial<Record<keyof MediaData, string>> = {};
    if (mediaData.photos.length === 0) errs.photos = 'At least one photo is required.';
    if (!mediaData.reporterName.trim()) errs.reporterName = 'Your name is required.';
    if (!mediaData.reporterContact.trim()) errs.reporterContact = 'Contact information is required.';
    setMediaErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Navigation ───────────────────────────────────────────
  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) handleSubmit();
  };

  const handleBack = () => {
    if (step === 1) {
      setStep('selection');
      setReportType(null);
    } else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleSubmit = () => {
    setStep('processing');
    const ref = generateCaseRef();
    setTimeout(() => {
      setCaseRef(ref);
      setStep('success');
    }, 2500);
  };

  const handleReportAnother = () => {
    setReportType(null);
    setIdentityData(EMPTY_IDENTITY);
    setIncidentData(EMPTY_INCIDENT);
    setMediaData(EMPTY_MEDIA);
    setIdentityErrors({});
    setIncidentErrors({});
    setMediaErrors({});
    setCaseRef('');
    setStep('selection');
  };

  // ── Step circle state ────────────────────────────────────
  const stepState = (num: 1 | 2 | 3): 'active' | 'completed' | 'inactive' => {
    const current = typeof step === 'number' ? step : step === 'processing' || step === 'success' ? 4 : 0;
    if (current === num) return 'active';
    if (current > num) return 'completed';
    return 'inactive';
  };

  const connectorCompleted = (afterStep: 1 | 2): boolean => {
    const current = typeof step === 'number' ? step : step === 'processing' || step === 'success' ? 4 : 0;
    return current > afterStep;
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="report-page">
      <Navbar />

      <main className="report-content">
        {/* ── Heading ── */}
        <div className="report-heading">
          <h1>Report a Case</h1>
          <p>Help us find missing persons and identify unidentified individuals in Baguio City.</p>
        </div>

        {/* ══════════════════════════════════════════════════
            SELECTION SCREEN
        ══════════════════════════════════════════════════ */}
        {step === 'selection' && (
          <div className={`selection-screen${slideOut ? ' slide-out' : ''}`}>
            <div className="selection-cards">
              {/* Missing person card */}
              <button
                type="button"
                className="selection-card"
                onClick={() => handleSelectType('missing')}
                aria-label="Report a missing person"
              >
                <div className="selection-card-icon" aria-hidden="true">🔍</div>
                <h2>Missing Person</h2>
                <p>
                  Report someone who has gone missing. Provide their identity,
                  last known location, and contact details.
                </p>
                <span className="selection-card-badge missing">Missing</span>
              </button>

              {/* Unidentified person card */}
              <button
                type="button"
                className="selection-card"
                onClick={() => handleSelectType('unidentified')}
                aria-label="Report an unidentified person"
              >
                <div className="selection-card-icon" aria-hidden="true">🪪</div>
                <h2>Unidentified Person</h2>
                <p>
                  Report an unidentified individual who has been found. Describe
                  their physical appearance and where they were located.
                </p>
                <span className="selection-card-badge unidentified">Unidentified</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            PROCESSING SCREEN
        ══════════════════════════════════════════════════ */}
        {step === 'processing' && (
          <div className="processing-screen" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <p className="processing-title">Submitting your report…</p>
            <p className="processing-subtitle">Checking for duplicates and saving your case.</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            SUCCESS SCREEN
        ══════════════════════════════════════════════════ */}
        {step === 'success' && (
          <div className="success-screen" role="status" aria-live="polite">
            <div className="success-icon-wrap" aria-hidden="true">
              <span className="success-checkmark">✓</span>
            </div>
            <h2 className="success-title">Report Submitted!</h2>
            <p className="success-subtitle">
              Your case has been received and will be reviewed by our team. You
              may be contacted for additional information.
            </p>
            <div className="success-ref">
              <span className="success-ref-label">Case Reference Number</span>
              {caseRef}
            </div>
            <button
              type="button"
              className="btn-report-another"
              onClick={handleReportAnother}
            >
              Report Another Case
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            MULTI-STEP FORM
        ══════════════════════════════════════════════════ */}
        {(step === 1 || step === 2 || step === 3) && reportType && (
          <div className="report-form-shell">
            {/* Progress bar */}
            <div className="progress-bar-track" role="progressbar" aria-valuenow={typeof step === 'number' ? step : 3} aria-valuemin={1} aria-valuemax={3}>
              <div className="progress-bar-fill" style={{ width: progressWidth() }} />
            </div>

            {/* Step indicator */}
            <nav className="step-indicator" aria-label="Form progress">
              {STEPS.map((s, idx) => (
                <div key={s.num} style={{ display: 'contents' }}>
                  <div className={`step-item ${stepState(s.num)}`}>
                    <div className={`step-circle ${stepState(s.num)}`} aria-current={stepState(s.num) === 'active' ? 'step' : undefined}>
                      {stepState(s.num) === 'completed' ? '✓' : s.num}
                    </div>
                    <span className="step-label">{s.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`step-connector${connectorCompleted(s.num as 1 | 2) ? ' completed' : ''}`} aria-hidden="true" />
                  )}
                </div>
              ))}
            </nav>

            {/* Form card */}
            <div className="form-card">
              {step === 1 && (
                <StepIdentity
                  type={reportType}
                  data={identityData}
                  onChange={setIdentityData}
                  errors={identityErrors}
                />
              )}
              {step === 2 && (
                <StepIncident
                  type={reportType}
                  data={incidentData}
                  onChange={setIncidentData}
                  errors={incidentErrors}
                />
              )}
              {step === 3 && (
                <StepMedia
                  data={mediaData}
                  onChange={setMediaData}
                  errors={mediaErrors}
                />
              )}

              {/* Navigation */}
              <div className="form-nav">
                <button type="button" className="btn-back" onClick={handleBack}>
                  ← Back
                </button>
                <button type="button" className="btn-next" onClick={handleNext}>
                  {step === 3 ? 'Submit Report' : 'Next →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
