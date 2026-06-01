/**
 * Lightweight draft persistence for the multi-step Report form.
 *
 * Saves the *text* portions of an in-progress report to localStorage so a user
 * who leaves (or reloads) before submitting can pick up where they left off.
 *
 * NOTE: Uploaded files (photos, supporting documents) are File objects and
 * cannot be serialised to localStorage, so they are intentionally NOT saved.
 * Source links, which are plain strings, ARE saved. The resume UI tells the
 * user they'll need to re-attach any photos/documents.
 */

import type { IdentityData } from '../components/ReportForm/StepIdentity';
import type { IncidentData } from '../components/ReportForm/StepIncident';
import type { SourceLink } from '../components/ReportForm/StepMedia';

const DRAFT_KEY = 'tuklas_report_draft_v1';

export type DraftReportType = 'missing' | 'unidentified';

export interface ReportDraft {
  savedAt: number;
  reportType: DraftReportType;
  step: 1 | 2 | 3;
  identity: IdentityData;
  incident: IncidentData;
  media: {
    sourceLinks: SourceLink[];
    reporterFirstName: string;
    reporterLastName: string;
    reporterContact: string;
  };
}

/** Persist the current form state. Silently no-ops if storage is unavailable. */
export function saveDraft(draft: ReportDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage full / blocked — ignore */ }
}

/** Load a saved draft, or null if none / unparseable. */
export function loadDraft(): ReportDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReportDraft;
    if (!parsed || (parsed.reportType !== 'missing' && parsed.reportType !== 'unidentified')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Remove any saved draft (call after a successful submit or explicit discard). */
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore */ }
}

/** True when a draft holds at least one user-entered value worth restoring. */
export function draftHasContent(d: ReportDraft | null): boolean {
  if (!d) return false;
  const i = d.identity;
  const inc = d.incident;
  const m = d.media;
  const filled = [
    i.firstName, i.lastName, i.nickname, i.ageMin, i.ageMax, i.gender,
    i.heightFt, i.physicalDescription,
    inc.barangay, inc.date, inc.time, inc.location,
    m.reporterFirstName, m.reporterLastName, m.reporterContact,
  ];
  return filled.some((v) => v && String(v).trim() !== '') || m.sourceLinks.length > 0;
}
