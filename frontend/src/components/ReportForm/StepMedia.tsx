'use client';

import { useRef, useState } from 'react';

export interface MediaData {
  photos: File[];
  reporterName: string;
  reporterContact: string;
}

interface StepMediaProps {
  data: MediaData;
  onChange: (data: MediaData) => void;
  errors: Partial<Record<keyof MediaData, string>>;
}

export function StepMedia({ data, onChange, errors }: StepMediaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (field: 'reporterName' | 'reporterContact') =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...data, [field]: e.target.value });

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (accepted.length === 0) return;
    onChange({ ...data, photos: [...data.photos, ...accepted] });
  };

  const removePhoto = (index: number) => {
    const updated = data.photos.filter((_, i) => i !== index);
    onChange({ ...data, photos: updated });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    // Reset so the same file can be re-added after removal
    e.target.value = '';
  };

  return (
    <div>
      <h2 className="form-card-title">Photos &amp; Contact</h2>
      <p className="form-card-subtitle">
        Upload at least one photo and provide your contact details for follow-up.
      </p>

      {/* Drop zone */}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleZoneClick();
          }}
        >
          <span className="dropzone-icon" aria-hidden="true">
            📷
          </span>
          <p className="dropzone-text">Drag &amp; drop photos here</p>
          <p className="dropzone-subtext">
            or click to browse — JPG, PNG, WEBP accepted
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="dropzone-input"
            onChange={handleFileChange}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
        {errors.photos && <span className="form-error">{errors.photos}</span>}
      </div>

      {/* Previews */}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(i);
                  }}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Reporter name */}
      <div className="form-group" style={{ marginTop: '1.5rem' }}>
        <label className="form-label" htmlFor="reporter-name">
          Your Name <span className="required-star">*</span>
        </label>
        <input
          id="reporter-name"
          type="text"
          className={`form-input${errors.reporterName ? ' error' : ''}`}
          value={data.reporterName}
          onChange={set('reporterName')}
          placeholder="Full name of the reporter"
          autoComplete="name"
        />
        <span className="private-note">
          🔒 Private — visible to admins only
        </span>
        {errors.reporterName && (
          <span className="form-error">{errors.reporterName}</span>
        )}
      </div>

      {/* Reporter contact */}
      <div className="form-group">
        <label className="form-label" htmlFor="reporter-contact">
          Contact Number or Email <span className="required-star">*</span>
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
          🔒 Private — visible to admins only
        </span>
        {errors.reporterContact && (
          <span className="form-error">{errors.reporterContact}</span>
        )}
      </div>
    </div>
  );
}
