'use client';

import { useState, useRef, useCallback } from 'react';
import { casesApi } from '../../lib/api';

/* ── Column mapping ─────────────────────────────────────────── */
/* Maps common spreadsheet column headers to our internal field names.
   Case-insensitive, trims whitespace. */
const COLUMN_MAP: Record<string, string> = {
  // type
  'type': 'type', 'case type': 'type', 'report type': 'type',
  // gender
  'gender': 'gender', 'sex': 'gender',
  // barangay
  'barangay': 'barangay_name', 'barangay name': 'barangay_name', 'location barangay': 'barangay_name',
  // first name
  'first name': 'first_name', 'firstname': 'first_name', 'given name': 'first_name',
  // last name
  'last name': 'last_name', 'lastname': 'last_name', 'surname': 'last_name', 'family name': 'last_name',
  // nickname
  'nickname': 'nickname', 'alias': 'nickname',
  // age
  'age': 'age_approx', 'approximate age': 'age_approx', 'age approx': 'age_approx',
  // description
  'description': 'description', 'physical description': 'description', 'details': 'description',
  // location
  'location': 'location_text', 'specific location': 'location_text', 'landmark': 'location_text', 'address': 'location_text',
  // date
  'date': 'incident_date', 'incident date': 'incident_date', 'date last seen': 'incident_date', 'date found': 'incident_date',
  // reporter
  'reporter name': 'reporter_first_name', 'reporter': 'reporter_first_name', 'reported by': 'reporter_first_name',
  'reporter contact': 'reporter_contact', 'contact': 'reporter_contact', 'contact number': 'reporter_contact',
};

export interface ImportRow {
  rowNum: number;
  raw: Record<string, string>;
  mapped: Record<string, string>;
  errors: string[];
  status: 'pending' | 'importing' | 'success' | 'error';
  errorMsg?: string;
}

interface ImportCasesModalProps {
  onClose: () => void;
  onImported: (count: number) => void;
}

/* ── Normalise a type value ─────────────────────────────────── */
function normaliseType(v: string): string {
  const l = v.toLowerCase().trim();
  if (l.includes('missing')) return 'missing';
  if (l.includes('unidentified') || l.includes('unknown')) return 'unidentified';
  return l;
}

/* ── Normalise a gender value ───────────────────────────────── */
function normaliseGender(v: string): string {
  const l = v.toLowerCase().trim();
  if (l === 'm' || l.startsWith('male')) return 'Male';
  if (l === 'f' || l.startsWith('female')) return 'Female';
  return 'Unknown / Undetermined';
}

/* ── Parse CSV text into rows ───────────────────────────────── */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cells.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

/* ── Map raw headers to internal field names ────────────────── */
function mapHeaders(headers: string[]): string[] {
  return headers.map(h => COLUMN_MAP[h.toLowerCase().trim()] ?? h.toLowerCase().trim());
}

/* ── Validate and map a single data row ─────────────────────── */
function processRow(headers: string[], cells: string[], rowNum: number): ImportRow {
  const raw: Record<string, string> = {};
  const mapped: Record<string, string> = {};
  const errors: string[] = [];

  headers.forEach((h, i) => { raw[h] = cells[i] ?? ''; });
  const mappedHeaders = mapHeaders(headers);
  mappedHeaders.forEach((mh, i) => { mapped[mh] = cells[i]?.trim() ?? ''; });

  // Validate required fields
  const type = normaliseType(mapped['type'] ?? '');
  if (!type || (type !== 'missing' && type !== 'unidentified')) {
    errors.push('Type must be "missing" or "unidentified"');
  } else {
    mapped['type'] = type;
  }

  if (!mapped['barangay_name']) errors.push('Barangay is required');
  if (!mapped['incident_date']) errors.push('Incident date is required');
  if (!mapped['location_text']) errors.push('Location is required');

  const gender = normaliseGender(mapped['gender'] ?? '');
  mapped['gender'] = gender;

  return { rowNum, raw, mapped, errors, status: 'pending' };
}

/* ── Component ──────────────────────────────────────────────── */
export function ImportCasesModal({ onClose, onImported }: ImportCasesModalProps) {
  const [step, setStep]           = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [rows, setRows]           = useState<ImportRow[]>([]);
  const [dragOver, setDragOver]   = useState(false);
  const [parseError, setParseError] = useState('');
  const [progress, setProgress]   = useState({ done: 0, total: 0, failed: 0 });
  const fileInputRef              = useRef<HTMLInputElement>(null);

  /* ── Parse file ── */
  const handleFile = useCallback(async (file: File) => {
    setParseError('');
    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      let rawRows: string[][] = [];

      if (ext === 'csv') {
        const text = await file.text();
        rawRows = parseCSV(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        // Dynamically import SheetJS only when needed
        const XLSX = await import('xlsx');
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
        rawRows = data.map(r => r.map(c => String(c ?? '')));
      } else {
        setParseError('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.');
        return;
      }

      if (rawRows.length < 2) {
        setParseError('File must have at least a header row and one data row.');
        return;
      }

      const headers = rawRows[0];
      const dataRows = rawRows.slice(1).filter(r => r.some(c => c.trim()));
      const processed = dataRows.map((r, i) => processRow(headers, r, i + 2));
      setRows(processed);
      setStep('preview');
    } catch (err: unknown) {
      setParseError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  /* ── Import rows ── */
  async function startImport() {
    const validRows = rows.filter(r => r.errors.length === 0);
    setProgress({ done: 0, total: validRows.length, failed: 0 });
    setStep('importing');

    let failed = 0;
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setRows(prev => prev.map(r => r.rowNum === row.rowNum ? { ...r, status: 'importing' } : r));

      try {
        const fd = new FormData();
        const m = row.mapped;
        fd.append('type',            m['type'] === 'missing' ? 'MISSING' : 'UNIDENTIFIED');
        fd.append('gender',          m['gender'] === 'Male' ? 'MALE' : m['gender'] === 'Female' ? 'FEMALE' : 'UNKNOWN');
        fd.append('barangay_name',   m['barangay_name'] ?? '');
        fd.append('location_text',   m['location_text'] ?? '');
        fd.append('incident_date',   m['incident_date'] ?? '');
        if (m['first_name'])          fd.append('first_name',  m['first_name']);
        if (m['last_name'])           fd.append('last_name',   m['last_name']);
        if (m['nickname'])            fd.append('nickname',    m['nickname']);
        if (m['age_approx'])          fd.append('age_approx',  m['age_approx']);
        if (m['description'])         fd.append('description', m['description']);
        if (m['reporter_first_name']) fd.append('reporter_first_name', m['reporter_first_name']);
        if (m['reporter_contact'])    fd.append('reporter_contact',    m['reporter_contact']);

        await casesApi.submitReport(fd);
        setRows(prev => prev.map(r => r.rowNum === row.rowNum ? { ...r, status: 'success' } : r));
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : 'Import failed';
        setRows(prev => prev.map(r => r.rowNum === row.rowNum ? { ...r, status: 'error', errorMsg: msg } : r));
      }

      setProgress({ done: i + 1, total: validRows.length, failed });
    }

    setStep('done');
    const succeeded = validRows.length - failed;
    if (succeeded > 0) onImported(succeeded);
  }

  const validCount   = rows.filter(r => r.errors.length === 0).length;
  const invalidCount = rows.filter(r => r.errors.length > 0).length;

  return (
    <div
      className="mgmt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import cases from file"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mgmt-modal" style={{ maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="mgmt-modal-header">
          <h2 className="mgmt-modal-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            Import Cases from File
          </h2>
          <button className="mgmt-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="mgmt-modal-body" style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── STEP 1: Upload ── */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Format info */}
              <div style={{ background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#2980b9', lineHeight: 1.6 }}>
                <strong>Accepted formats:</strong> CSV (.csv), Excel (.xlsx, .xls)<br/>
                <strong>Required columns:</strong> Type, Barangay, Location, Incident Date<br/>
                <strong>Optional columns:</strong> First Name, Last Name, Nickname, Age, Gender, Description, Reporter Name, Reporter Contact<br/>
                <strong>Type values:</strong> &ldquo;missing&rdquo; or &ldquo;unidentified&rdquo; &nbsp;·&nbsp; <strong>Date format:</strong> YYYY-MM-DD
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Drop file here or click to browse"
                onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#701515' : '#d0d0d0'}`,
                  borderRadius: 12,
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'rgba(112,21,21,0.04)' : '#fafafa',
                  transition: 'all 150ms ease',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#701515' : '#bbb'} strokeWidth="1.5" width="40" height="40" style={{ display: 'block', margin: '0 auto 0.75rem' }} aria-hidden="true">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                <p style={{ fontWeight: 700, color: 'var(--color-text-dark)', margin: '0 0 0.25rem', fontSize: '0.9rem' }}>
                  Drop your file here, or click to browse
                </p>
                <p style={{ color: 'var(--color-text-light)', fontSize: '0.78rem', margin: 0 }}>
                  Supports .csv, .xlsx, .xls
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileInput}
                  aria-hidden="true"
                />
              </div>

              {parseError && (
                <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: '#c0392b' }}>
                  {parseError}
                </div>
              )}

              {/* Template download */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                Need a template?
                <button
                  style={{ background: 'none', border: 'none', color: '#701515', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', padding: 0, fontFamily: 'var(--font-family)' }}
                  onClick={() => {
                    const csv = 'Type,First Name,Last Name,Nickname,Age,Gender,Barangay,Location,Incident Date,Description,Reporter Name,Reporter Contact\nmissing,Juan,dela Cruz,,25,Male,Session Road Area,Near SM City Baguio,2024-01-15,Wearing blue jacket,Maria dela Cruz,09171234567\nunidentified,,,,,Female,Camp 7,Found near Camp 7 road,2024-02-20,Estimated 30-40 years old wearing red dress,,';
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url  = URL.createObjectURL(blob);
                    const a    = Object.assign(document.createElement('a'), { href: url, download: 'tuklas-import-template.csv' });
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download CSV template
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Preview ── */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Summary */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)', borderRadius: 8, padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: '#1e8449', fontWeight: 700 }}>
                  ✓ {validCount} row{validCount !== 1 ? 's' : ''} ready to import
                </div>
                {invalidCount > 0 && (
                  <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 8, padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: '#c0392b', fontWeight: 700 }}>
                    ✗ {invalidCount} row{invalidCount !== 1 ? 's' : ''} with errors (will be skipped)
                  </div>
                )}
              </div>

              {/* Preview table */}
              <div style={{ overflowX: 'auto', border: '1px solid #e8eaed', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-light)', borderBottom: '1px solid #e8eaed', whiteSpace: 'nowrap' }}>Row</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-light)', borderBottom: '1px solid #e8eaed' }}>Type</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-light)', borderBottom: '1px solid #e8eaed' }}>Name</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-light)', borderBottom: '1px solid #e8eaed' }}>Barangay</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-light)', borderBottom: '1px solid #e8eaed' }}>Date</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-light)', borderBottom: '1px solid #e8eaed' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.rowNum} style={{ borderBottom: '1px solid #f0f0f0', background: r.errors.length > 0 ? 'rgba(231,76,60,0.03)' : undefined }}>
                        <td style={{ padding: '0.45rem 0.75rem', color: 'var(--color-text-light)' }}>{r.rowNum}</td>
                        <td style={{ padding: '0.45rem 0.75rem' }}>
                          <span style={{ background: r.mapped['type'] === 'missing' ? 'rgba(112,21,21,0.1)' : 'rgba(243,156,18,0.1)', color: r.mapped['type'] === 'missing' ? '#701515' : '#d35400', borderRadius: 4, padding: '0.1rem 0.4rem', fontWeight: 700, fontSize: '0.68rem', textTransform: 'capitalize' }}>
                            {r.mapped['type'] || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>
                          {[r.mapped['first_name'], r.mapped['last_name']].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td style={{ padding: '0.45rem 0.75rem' }}>{r.mapped['barangay_name'] || '—'}</td>
                        <td style={{ padding: '0.45rem 0.75rem', color: 'var(--color-text-light)' }}>{r.mapped['incident_date'] || '—'}</td>
                        <td style={{ padding: '0.45rem 0.75rem' }}>
                          {r.errors.length === 0 ? (
                            <span style={{ color: '#1e8449', fontWeight: 700, fontSize: '0.72rem' }}>✓ Valid</span>
                          ) : (
                            <span style={{ color: '#c0392b', fontSize: '0.72rem' }} title={r.errors.join('; ')}>
                              ✗ {r.errors[0]}{r.errors.length > 1 ? ` (+${r.errors.length - 1})` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                style={{ background: 'none', border: 'none', color: 'var(--color-text-light)', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font-family)' }}
                onClick={() => { setRows([]); setStep('upload'); }}
              >
                ← Upload a different file
              </button>
            </div>
          )}

          {/* ── STEP 3: Importing ── */}
          {(step === 'importing' || step === 'done') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Progress bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600 }}>{step === 'done' ? 'Import complete' : `Importing… ${progress.done} / ${progress.total}`}</span>
                  <span style={{ color: 'var(--color-text-light)' }}>{progress.failed > 0 ? `${progress.failed} failed` : ''}</span>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`, background: progress.failed > 0 ? '#f39c12' : '#27ae60', borderRadius: 4, transition: 'width 200ms ease' }} />
                </div>
              </div>

              {/* Row results */}
              <div style={{ overflowX: 'auto', border: '1px solid #e8eaed', borderRadius: 8, maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <tbody>
                    {rows.filter(r => r.errors.length === 0).map(r => (
                      <tr key={r.rowNum} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '0.4rem 0.75rem', color: 'var(--color-text-light)', width: 40 }}>#{r.rowNum}</td>
                        <td style={{ padding: '0.4rem 0.75rem', fontWeight: 600 }}>
                          {[r.mapped['first_name'], r.mapped['last_name']].filter(Boolean).join(' ') || 'Unnamed'}
                        </td>
                        <td style={{ padding: '0.4rem 0.75rem' }}>{r.mapped['barangay_name']}</td>
                        <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>
                          {r.status === 'pending'   && <span style={{ color: '#bbb', fontSize: '0.72rem' }}>Waiting…</span>}
                          {r.status === 'importing' && <span style={{ color: '#2980b9', fontSize: '0.72rem' }}>Importing…</span>}
                          {r.status === 'success'   && <span style={{ color: '#1e8449', fontWeight: 700, fontSize: '0.72rem' }}>✓ Imported</span>}
                          {r.status === 'error'     && <span style={{ color: '#c0392b', fontSize: '0.72rem' }} title={r.errorMsg}>✗ {r.errorMsg}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="mgmt-modal-footer">
          {step === 'upload' && (
            <button type="button" className="mgmt-btn-ghost" onClick={onClose}>Cancel</button>
          )}
          {step === 'preview' && (
            <>
              <button type="button" className="mgmt-btn-ghost" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="mgmt-btn-primary"
                onClick={startImport}
                disabled={validCount === 0}
                style={{ opacity: validCount === 0 ? 0.5 : 1 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                Import {validCount} Case{validCount !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {step === 'importing' && (
            <button type="button" className="mgmt-btn-ghost" disabled>Importing…</button>
          )}
          {step === 'done' && (
            <button type="button" className="mgmt-btn-primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
