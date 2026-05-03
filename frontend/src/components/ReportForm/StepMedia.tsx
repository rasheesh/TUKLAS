'use client';

import { useRef, useState } from 'react';

export interface MediaData {
  photos: File[];
  /* Reporter identity — split into first/last name, all optional */
  reporterFirstName: string;
  reporterLastName: string;
  reporterContact: string;
}

interface StepMediaProps {
  data: MediaData;
  onChange: (data: MediaData) => void;
  errors: Partial<Record<keyof MediaData, string>>;
  /* Pass the report type so we can adjust labels */
  reportType?: 'missing' | 'unidentified';
}

export function StepMedia({ data, onChange, errors, reportType }: StepMediaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof Omit<MediaData, 'photos'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...data, [field]: e.target.value });

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (accepted.length === 0) return;
    onChange({ ...data, photos: [...data.photos, ...accepted] });
  };

  const removePhoto = (index: number) => {
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
    </div>
  );
}
