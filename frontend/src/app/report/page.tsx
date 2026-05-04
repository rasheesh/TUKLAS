'use client';

import { useState } from 'react';
import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { StepIdentity, IdentityData } from '../../components/ReportForm/StepIdentity';
import { StepIncident, IncidentData } from '../../components/ReportForm/StepIncident';
import { StepMedia, MediaData } from '../../components/ReportForm/StepMedia';
import { casesApi, ApiError } from '../../lib/api';
import '../../css/ReportForm.css';

// ── Types ──────────────────────────────────────────────────
type ReportType = 'missing' | 'unidentified';
type FormStep = 'selection' | 1 | 2 | 3 | 'processing' | 'success';

const EMPTY_IDENTITY: IdentityData = {
  firstName: '',
  lastName: '',
  nickname: '',
  ageMin: '',
  ageMax: '',
  gender: '',
  heightFt: '',
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
  reporterFirstName: '',
  reporterLastName: '',
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
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      if (!identityData.firstName.trim()) errs.firstName = 'First name is required.';
      if (!identityData.lastName.trim())  errs.lastName  = 'Last name is required.';
      if (!identityData.ageMin.trim())    errs.ageMin    = 'Age is required.';
      if (!identityData.gender)           errs.gender    = 'Gender is required.';
    } else {
      /* Unidentified — at least one age bound required */
      if (!identityData.ageMin.trim() && !identityData.ageMax.trim()) {
        errs.ageMin = 'Please enter at least one age estimate.';
      }
      if (
        identityData.ageMin.trim() &&
        identityData.ageMax.trim() &&
        Number(identityData.ageMin) > Number(identityData.ageMax)
      ) {
        errs.ageMax = '"To" age must be greater than or equal to "From" age.';
      }
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
    if (!incidentData.date)     errs.date     = 'Date is required.';
    if (!incidentData.location.trim()) errs.location = 'Specific location is required.';
    setIncidentErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Partial<Record<keyof MediaData, string>> = {};
    if (mediaData.photos.length === 0) errs.photos = 'At least one photo is required.';
    /* Reporter name + contact required for missing reports only */
    if (reportType === 'missing') {
      if (!mediaData.reporterFirstName.trim()) errs.reporterFirstName = 'First name is required.';
      if (!mediaData.reporterLastName.trim())  errs.reporterLastName  = 'Last name is required.';
      if (!mediaData.reporterContact.trim())   errs.reporterContact   = 'Contact information is required.';
    }
    setMediaErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Navigation ───────────────────────────────────────────
  const handleNext = () => {
    if (isSubmitting) return;
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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStep('processing');
    try {
      /* Build multipart form data */
      const fd = new FormData();

      /* Type */
      fd.append('type', reportType!);

      /* Identity */
      fd.append('first_name',  identityData.firstName);
      fd.append('last_name',   identityData.lastName);
      fd.append('nickname',    identityData.nickname);
      fd.append('gender',      identityData.gender); // already a DB enum value (MALE | FEMALE | UNKNOWN)
      if (identityData.ageMin) fd.append('age_range_min', identityData.ageMin);
      if (identityData.ageMax) fd.append('age_range_max', identityData.ageMax);
      if (reportType === 'missing' && identityData.ageMin) fd.append('age_approx', identityData.ageMin);
      if (identityData.heightFt) fd.append('height_ft', identityData.heightFt);
      fd.append('description', identityData.physicalDescription);

      /* Incident */
      fd.append('barangay_name', incidentData.barangay);
      fd.append('incident_date', incidentData.date);
      if (incidentData.time)     fd.append('incident_time', incidentData.time);
      fd.append('location_text', incidentData.location);

      /* Reporter */
      fd.append('reporter_first_name', mediaData.reporterFirstName);
      fd.append('reporter_last_name',  mediaData.reporterLastName);
      fd.append('reporter_contact',    mediaData.reporterContact);

      /* Photos */
      mediaData.photos.forEach(file => fd.append('photos', file));

      const { reference } = await casesApi.submitReport(fd);
      setCaseRef(reference);
      setStep('success');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Submission failed. Please try again.';
      setSubmitError(msg);
      setStep(3);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportAnother = () => {
    setReportType(null);
    setIdentityData(EMPTY_IDENTITY);
    setIncidentData(EMPTY_INCIDENT);
    setMediaData(EMPTY_MEDIA);
    setIdentityErrors({});
    setIncidentErrors({});
    setMediaErrors({});
    setSubmitError('');
    setCaseRef('');
    setIsSubmitting(false);
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

      <main className="report-content">        {/* ── Heading ── */}
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
                <div className="selection-card-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    <path d="M11 8v3m0 2h.01"/>
                  </svg>
                </div>
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
                <div className="selection-card-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
                    <path d="M6 10h2m-2 4h10"/>
                  </svg>
                </div>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="success-checkmark" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 className="success-title">Report Submitted!</h2>
            <p className="success-subtitle">
              Your case has been received and is now under review by our team.
              You may be contacted for additional information.
            </p>

            {/* Reference number — prominent display */}
            <div className="success-ref-block">
              <span className="success-ref-eyebrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" aria-hidden="true">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="12" y1="12" x2="12" y2="12.01"/>
                </svg>
                Your Case Reference Number
              </span>
              <div className="success-ref-number" aria-label={`Case reference number: ${caseRef}`}>
                {caseRef}
              </div>
              <button
                type="button"
                className="success-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(caseRef).catch(() => {});
                  const btn = document.querySelector('.success-copy-btn') as HTMLButtonElement;
                  if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Number'; }, 2000); }
                }}
                aria-label="Copy reference number to clipboard"
              >
                Copy Number
              </button>
            </div>

            {/* Save notice */}
            <div className="success-save-notice" role="note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <strong>Please save this number.</strong> It is the only way to track the status of your report or follow up with our team. We do not send confirmation emails — this number is your only record.
              </div>
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
                      {stepState(s.num) === 'completed' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="14" height="14" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : s.num}
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
                  reportType={reportType}
                />
              )}

              {/* Submit error */}
              {submitError && (
                <div className="login-error-msg" role="alert" style={{ marginTop: '1rem' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {submitError}
                </div>
              )}

              {/* Navigation */}
              <div className="form-nav">
                <button type="button" className="btn-back" onClick={handleBack}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
                <button type="button" className="btn-next" onClick={handleNext} disabled={isSubmitting}>
                  {step === 3 && isSubmitting ? (
                    <>Submitting…</>
                  ) : step === 3 ? 'Submit Report' : (
                    <>Next <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
