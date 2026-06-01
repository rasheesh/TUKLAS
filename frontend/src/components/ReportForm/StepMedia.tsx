'use client';

import { useRef, useState } from 'react';

export interface ProofDocument {
  file: File;
  type: string;   // proof_document_type enum value
}

export interface SourceLink {
  url: string;
  type: string;   // source_link_type enum value
}

export interface MediaData {
  photos: File[];
  /* Supporting proof — at least one document OR source link is required */
  documents: ProofDocument[];
  sourceLinks: SourceLink[];
  /* Reporter identity — split into first/last name, all optional */
  reporterFirstName: string;
  reporterLastName: string;
  reporterContact: string;
  /* Legal consent — both required before the report can be submitted */
  privacyConsent: boolean;
  accuracyDeclaration: boolean;
}

interface StepMediaProps {
  data: MediaData;
  onChange: (data: MediaData) => void;
  errors: Partial<Record<keyof MediaData | 'proof', string>>;
  /* Pass the report type so we can adjust labels */
  reportType?: 'missing' | 'unidentified';
}

/* Accepted supporting-proof document types (mirror proof_document_type enum) */
const PROOF_DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: 'POLICE_REPORT',          label: 'Police Report / Blotter' },
  { value: 'BARANGAY_CERTIFICATION', label: 'Barangay Certification / Report' },
  { value: 'MISSING_PERSON_CERT',    label: 'Missing Person Certificate' },
  { value: 'NEWS_ARTICLE',           label: 'News Article / Media Coverage' },
  { value: 'FACEBOOK_POST',          label: 'Verified Facebook Post' },
  { value: 'IDENTIFICATION',         label: 'Identification Document' },
  { value: 'SUPPORTING_DOC',         label: 'Other Supporting Document' },
  { value: 'OTHER',                  label: 'Other' },
];

/* Accepted source-link types (mirror source_link_type enum) */
const SOURCE_LINK_TYPES: { value: string; label: string }[] = [
  { value: 'FACEBOOK',            label: 'Facebook Link' },
  { value: 'NEWS_ARTICLE',        label: 'News Article Link' },
  { value: 'POLICE_ANNOUNCEMENT', label: 'Official Police Announcement' },
  { value: 'OTHER',               label: 'Other Source' },
];

/* ── Unified proof picker ──────────────────────────────────────
   A single dropdown lists every kind of supporting proof. Each entry
   declares whether it needs a file upload ('file') or a URL ('link'),
   and which enum value it maps to. The form then shows the matching
   field based on the chosen type. */
type ProofMode = 'file' | 'link';
interface ProofOption {
  value:    string;     // unique dropdown key
  label:    string;
  mode:     ProofMode;
  docType?: string;     // proof_document_type (file mode)
  linkType?: string;    // source_link_type   (link mode)
}

const PROOF_OPTIONS: ProofOption[] = [
  /* Upload a document */
  { value: 'doc_police',   label: 'Police Report / Blotter',         mode: 'file', docType: 'POLICE_REPORT' },
  { value: 'doc_barangay', label: 'Barangay Certification / Report', mode: 'file', docType: 'BARANGAY_CERTIFICATION' },
  { value: 'doc_missing',  label: 'Missing Person Certificate',      mode: 'file', docType: 'MISSING_PERSON_CERT' },
  { value: 'doc_news',     label: 'News Article / Clipping',         mode: 'file', docType: 'NEWS_ARTICLE' },
  { value: 'doc_fb',       label: 'Facebook Post (screenshot)',      mode: 'file', docType: 'FACEBOOK_POST' },
  { value: 'doc_id',       label: 'Identification Document',         mode: 'file', docType: 'IDENTIFICATION' },
  { value: 'doc_other',    label: 'Other Supporting Document',       mode: 'file', docType: 'SUPPORTING_DOC' },
  /* Paste a link */
  { value: 'link_fb',      label: 'Facebook Post',                   mode: 'link', linkType: 'FACEBOOK' },
  { value: 'link_news',    label: 'News Article',                    mode: 'link', linkType: 'NEWS_ARTICLE' },
  { value: 'link_police',  label: 'Official Police Announcement',    mode: 'link', linkType: 'POLICE_ANNOUNCEMENT' },
  { value: 'link_other',   label: 'Other Source',                    mode: 'link', linkType: 'OTHER' },
];

/* Legacy .doc (application/msword) is excluded for security — it uses the same
   CFB/OLE2 container as .msi installers. Use .docx instead. */
const DOC_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
]);
/* Per-file caps — must match the Supabase Storage bucket limits. */
const MAX_DOC_SIZE   = 10 * 1024 * 1024;   // 10 MB — case-proofs bucket
const MAX_PHOTO_SIZE = 20 * 1024 * 1024;   // 20 MB — case-photos bucket

export function StepMedia({ data, onChange, errors, reportType }: StepMediaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileTypeError, setFileTypeError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Supporting-proof local UI state ── */
  /* A single dropdown selection drives whether we show a file or URL field. */
  const [selectedProof, setSelectedProof] = useState(PROOF_OPTIONS[0].value);
  const [docError, setDocError] = useState('');
  const docInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  const activeOption = PROOF_OPTIONS.find((o) => o.value === selectedProof) ?? PROOF_OPTIONS[0];

  const addDocument = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!DOC_MIME_TYPES.has(file.type)) {
      setDocError('Unsupported file. Accepted: PDF, Word (.docx), JPG, PNG, WebP, GIF.');
      return;
    }
    if (file.size > MAX_DOC_SIZE) {
      setDocError('File exceeds the 10 MB size limit.');
      return;
    }
    setDocError('');
    onChange({
      ...data,
      documents: [...data.documents, { file, type: activeOption.docType ?? 'OTHER' }],
    });
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const removeDocument = (index: number) => {
    onChange({ ...data, documents: data.documents.filter((_, i) => i !== index) });
  };

  const addLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) { setLinkError('Please enter a URL.'); return; }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setLinkError('Invalid URL. Include http:// or https://');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      setLinkError('URL must start with http:// or https://');
      return;
    }
    if (data.sourceLinks.some((l) => l.url === trimmed)) {
      setLinkError('This link has already been added.');
      return;
    }
    setLinkError('');
    onChange({
      ...data,
      sourceLinks: [...data.sourceLinks, { url: trimmed, type: activeOption.linkType ?? 'OTHER' }],
    });
    setLinkUrl('');
  };

  const removeLink = (index: number) => {
    onChange({ ...data, sourceLinks: data.sourceLinks.filter((_, i) => i !== index) });
  };

  const docTypeLabel = (val: string) =>
    PROOF_DOCUMENT_TYPES.find((t) => t.value === val)?.label ?? val;
  const linkTypeLabel = (val: string) =>
    SOURCE_LINK_TYPES.find((t) => t.value === val)?.label ?? val;

  const set = (field: keyof Omit<MediaData, 'photos'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...data, [field]: e.target.value });

  const toggle = (field: 'privacyConsent' | 'accuracyDeclaration') =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...data, [field]: e.target.checked });

  const SUPPORTED_MIME_TYPES = new Set([
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  ]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const all = Array.from(files);

    /* Detect unsupported types (e.g. HEIC/HEIF from iPhone/Mac) */
    const unsupported = all.filter(
      (f) => f.type && !SUPPORTED_MIME_TYPES.has(f.type)
    );
    if (unsupported.length > 0) {
      const names = unsupported.map((f) => f.name).join(', ');
      /* Surface the error through the photos error field via a synthetic event.
         We call onChange with an intentionally invalid sentinel so the parent
         can show the validation error on the next render cycle. Instead, we
         store the error in local state and show it inline. */
      setFileTypeError(
        `Unsupported file type: ${names}. Please use JPG, PNG, or WebP. ` +
        `If you're on a Mac or iPhone, convert HEIC photos to JPG first.`
      );
      return;
    }

    /* Reject photos larger than the case-photos bucket allows (20 MB). */
    const tooBig = all.filter((f) => f.size > MAX_PHOTO_SIZE);
    if (tooBig.length > 0) {
      const names = tooBig.map((f) => f.name).join(', ');
      setFileTypeError(`Photo too large: ${names}. Each photo must be 20 MB or less.`);
      return;
    }

    setFileTypeError('');
    const accepted = all.filter((f) => f.type.startsWith('image/'));
    if (accepted.length === 0) return;
    onChange({ ...data, photos: [...data.photos, ...accepted] });
  };

  const removePhoto = (index: number) => {
    setFileTypeError('');
    onChange({ ...data, photos: data.photos.filter((_, i) => i !== index) });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  };
  const handleZoneClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  /* Label copy changes based on who is filling the form */
  const isUnidentified = reportType === 'unidentified';
  const sectionTitle = isUnidentified
    ? 'Photos & Finder Details'
    : 'Photos & Reporter Details';
  const sectionSubtitle = isUnidentified
    ? 'Upload at least one photo. Finder contact details are optional but help with follow-up.'
    : 'Upload at least one photo and provide your contact details for follow-up.';
  const nameLabel = isUnidentified ? 'Finder\'s Name' : 'Your Name';
  const contactLabel = isUnidentified ? 'Finder\'s Contact' : 'Contact Number or Email';

  const lockIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );

  return (
    <div>
      <h2 className="form-card-title">{sectionTitle}</h2>
      <p className="form-card-subtitle">{sectionSubtitle}</p>

      {/* ── Drop zone ── */}
      <div className="form-group">
        <label className="form-label">
          Photos <span className="required-star">*</span>
        </label>
        <div
          className={`dropzone${isDragOver ? ' dragover' : ''}${errors.photos ? ' error' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleZoneClick}
          role="button"
          tabIndex={0}
          aria-label="Upload photos — click or drag and drop"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleZoneClick(); }}
        >
          <span className="dropzone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </span>
          <p className="dropzone-text">Drag &amp; drop photos here</p>
          <p className="dropzone-subtext">or click to browse — JPG, PNG, WEBP accepted</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="dropzone-input"
            onChange={handleFileChange}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
        {errors.photos && <span className="form-error">{errors.photos}</span>}
        {fileTypeError && <span className="form-error">{fileTypeError}</span>}
      </div>

      {/* ── Photo previews ── */}
      {data.photos.length > 0 && (
        <div className="photo-previews" role="list" aria-label="Uploaded photos">
          {data.photos.map((file, i) => {
            const url = URL.createObjectURL(file);
            return (
              <div key={`${file.name}-${i}`} className="photo-thumb" role="listitem">
                <img src={url} alt={`Preview ${i + 1}`} />
                <button
                  type="button"
                  className="photo-thumb-remove"
                  onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Supporting proof & sources ── */}
      <div className="proof-section" style={{ marginTop: '1.75rem' }}>
        <h3 className="proof-section-title">Supporting Proof &amp; Sources</h3>
        <p className="form-card-subtitle" style={{ marginBottom: '0.75rem' }}>
          To keep TUKLAS credible, every report must include at least one supporting
          document <strong>or</strong> a verifiable source link.
        </p>

        {/* Accepted-proof reference list */}
        <div className="proof-accepted">
          <span className="proof-accepted-label">Accepted proof includes:</span>
          <ul className="proof-accepted-list">
            <li>Police Blotter / Police Report</li>
            <li>Barangay Certification or Report</li>
            <li>Missing Person Certificate</li>
            <li>Verified Facebook Post from official authorities</li>
            <li>News Article or media coverage</li>
            <li>Recent photograph or other identification documents</li>
          </ul>
        </div>

        {/* Unified proof picker — type chooses file-upload vs URL field */}
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label" htmlFor="proof-type-select">
            Type of Supporting Proof
          </label>
          <div className="proof-add-row">
            <select
              id="proof-type-select"
              className="form-select"
              value={selectedProof}
              onChange={(e) => {
                setSelectedProof(e.target.value);
                setDocError('');
                setLinkError('');
              }}
              aria-label="Type of supporting proof"
            >
              <optgroup label="Upload a document">
                {PROOF_OPTIONS.filter((o) => o.mode === 'file').map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
              <optgroup label="Paste a link">
                {PROOF_OPTIONS.filter((o) => o.mode === 'link').map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            </select>

            {/* The matching field appears based on the chosen type */}
            {activeOption.mode === 'file' ? (
              <input
                id="proof-doc-input"
                ref={docInputRef}
                type="file"
                className="form-input"
                accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.gif"
                onChange={(e) => addDocument(e.target.files)}
                aria-label="Choose a document to upload"
              />
            ) : (
              <>
                <input
                  id="proof-link-input"
                  type="url"
                  className="form-input"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                  placeholder="https://facebook.com/... or news article URL"
                  autoComplete="off"
                  aria-label="Source link URL"
                />
                <button type="button" className="proof-add-btn" onClick={addLink}>
                  Add
                </button>
              </>
            )}
          </div>
          <span className="form-hint">
            {activeOption.mode === 'file'
              ? 'PDF, Word, or image. Max 10 MB per file.'
              : 'Paste a Facebook post, news article, or official police announcement URL.'}
          </span>
          {activeOption.mode === 'file' && docError && <span className="form-error">{docError}</span>}
          {activeOption.mode === 'link' && linkError && <span className="form-error">{linkError}</span>}
        </div>

        {/* Combined list of everything attached so far */}
        {(data.documents.length > 0 || data.sourceLinks.length > 0) && (
          <ul className="proof-list" aria-label="Attached proof">
            {data.documents.map((doc, i) => (
              <li key={`doc-${doc.file.name}-${i}`} className="proof-list-item">
                <span className="proof-list-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </span>
                <span className="proof-list-text">
                  <strong>{doc.file.name}</strong>
                  <span className="proof-list-meta">{docTypeLabel(doc.type)}</span>
                </span>
                <button
                  type="button"
                  className="proof-list-remove"
                  onClick={() => removeDocument(i)}
                  aria-label={`Remove ${doc.file.name}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </li>
            ))}
            {data.sourceLinks.map((link, i) => (
              <li key={`link-${link.url}-${i}`} className="proof-list-item">
                <span className="proof-list-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </span>
                <span className="proof-list-text">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="proof-list-url">{link.url}</a>
                  <span className="proof-list-meta">{linkTypeLabel(link.type)}</span>
                </span>
                <button
                  type="button"
                  className="proof-list-remove"
                  onClick={() => removeLink(i)}
                  aria-label="Remove link"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {errors.proof && <span className="form-error">{errors.proof}</span>}

        {/* Reminders */}
        <div className="proof-reminder" role="note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>
            Reports without sufficient proof may undergo further verification before publication.
            False or misleading information may result in rejection. Sensitive cases involving
            minors or ongoing investigations may be restricted from public view.
          </span>
        </div>
      </div>

      {/* ── Reporter / Finder name — split first + last ── */}
      <div style={{ marginTop: '1.5rem' }}>
        <span className="form-label">
          {nameLabel}
          {/* Required for missing reports, optional for unidentified */}
          {!isUnidentified && <span className="required-star"> *</span>}
          {isUnidentified && <span className="form-label-optional"> (Optional)</span>}
        </span>
        <div className="form-row" style={{ marginTop: '0.4rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label form-label-sub" htmlFor="reporter-firstname">
              First Name
            </label>
            <input
              id="reporter-firstname"
              type="text"
              className={`form-input${errors.reporterFirstName ? ' error' : ''}`}
              value={data.reporterFirstName}
              onChange={set('reporterFirstName')}
              placeholder="e.g. Maria"
              autoComplete="given-name"
            />
            {errors.reporterFirstName && (
              <span className="form-error">{errors.reporterFirstName}</span>
            )}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label form-label-sub" htmlFor="reporter-lastname">
              Last Name
            </label>
            <input
              id="reporter-lastname"
              type="text"
              className={`form-input${errors.reporterLastName ? ' error' : ''}`}
              value={data.reporterLastName}
              onChange={set('reporterLastName')}
              placeholder="e.g. Santos"
              autoComplete="family-name"
            />
            {errors.reporterLastName && (
              <span className="form-error">{errors.reporterLastName}</span>
            )}
          </div>
        </div>
        <span className="private-note">
          {lockIcon} Private — visible to admins only
        </span>
      </div>

      {/* ── Reporter / Finder contact ── */}
      <div className="form-group" style={{ marginTop: '1rem' }}>
        <label className="form-label" htmlFor="reporter-contact">
          {contactLabel}
          {!isUnidentified && <span className="required-star"> *</span>}
          {isUnidentified && <span className="form-label-optional"> (Optional)</span>}
        </label>
        <input
          id="reporter-contact"
          type="text"
          className={`form-input${errors.reporterContact ? ' error' : ''}`}
          value={data.reporterContact}
          onChange={set('reporterContact')}
          placeholder="e.g. 09XX-XXX-XXXX or email@example.com"
          autoComplete="tel"
        />
        <span className="private-note">
          {lockIcon} Private — visible to admins only
        </span>
        {errors.reporterContact && (
          <span className="form-error">{errors.reporterContact}</span>
        )}
      </div>

      {/* ── Data privacy & legal consent ── */}
      <div className="consent-section">
        <h3 className="proof-section-title">Data Privacy &amp; Declaration</h3>

        {/* Privacy notice summary */}
        <div className="consent-notice" role="note">
          <div className="consent-notice-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Data Privacy Notice</span>
          </div>
          <p>
            The information you provide — including details about the person in
            this report and your contact details — is collected and processed by
            TUKLAS solely to help locate and identify missing or unidentified
            persons, verify this report, and coordinate with authorized law
            enforcement when necessary. Verified reports may be published publicly;
            your contact details stay private and visible only to authorized
            administrators. You may request access to, correction of, or deletion
            of your personal data at any time. TUKLAS handles all data in
            accordance with the <strong>Data Privacy Act of 2012 (Republic Act
            No. 10173)</strong>. Read our{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          </p>
        </div>

        {/* Consent checkboxes */}
        <label className={`consent-checkbox${errors.privacyConsent ? ' error' : ''}`}>
          <input
            type="checkbox"
            checked={data.privacyConsent}
            onChange={toggle('privacyConsent')}
            aria-describedby="consent-privacy-text"
          />
          <span id="consent-privacy-text">
            I have read and understood the Data Privacy Notice and Privacy Policy,
            and I freely give my consent to the collection and processing of the
            information in this report in accordance with the Data Privacy Act of
            2012 (RA 10173). <span className="required-star">*</span>
          </span>
        </label>
        {errors.privacyConsent && <span className="form-error">{errors.privacyConsent}</span>}

        <label className={`consent-checkbox${errors.accuracyDeclaration ? ' error' : ''}`}>
          <input
            type="checkbox"
            checked={data.accuracyDeclaration}
            onChange={toggle('accuracyDeclaration')}
            aria-describedby="consent-accuracy-text"
          />
          <span id="consent-accuracy-text">
            I declare that the information provided is true and accurate to the
            best of my knowledge and is submitted in good faith. I understand that
            knowingly submitting false or malicious information may result in
            rejection and possible liability under applicable Philippine laws.
            {' '}<span className="required-star">*</span>
          </span>
        </label>
        {errors.accuracyDeclaration && <span className="form-error">{errors.accuracyDeclaration}</span>}

        <p className="consent-footnote">
          Filing this report does not replace an official report to the Philippine
          National Police (PNP). In an emergency, contact your local authorities
          immediately.
        </p>
      </div>
    </div>
  );
}
