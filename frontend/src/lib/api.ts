/**
 * Thin fetch wrapper for all TUKLAS API calls.
 * - Automatically includes credentials (cookies) on every request
 * - Throws a typed ApiError on non-2xx responses
 * - Base URL comes from NEXT_PUBLIC_API_URL env variable
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name  = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  /* Include stored token as Authorization header if available */
  const token = typeof window !== 'undefined'
    ? sessionStorage.getItem('tuklas_token')
    : null;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* ignore parse errors */ }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

/* ── Auth ─────────────────────────────────────────────────── */
export const authApi = {
  login:   (email: string, password: string) =>
    request<{ user: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout:  () =>
    request<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  session: () =>
    request<{ user: SessionUser }>('/api/auth/session'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/api/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

/* ── Cases ────────────────────────────────────────────────── */
export const casesApi = {
  getPublic: (params?: CaseFilters) => {
    const qs = new URLSearchParams();
    if (params?.barangay_id) qs.set('barangay_id', String(params.barangay_id));
    if (params?.type)        qs.set('type', params.type);
    if (params?.gender)      qs.set('gender', params.gender);
    const query = qs.toString() ? `?${qs}` : '';
    return request<{ cases: ApiCase[] }>(`/api/cases${query}`);
  },

  getBarangays: () =>
    request<{ barangays: { id: number; name: string }[] }>('/api/cases/barangays'),

  getPending: () =>
    request<{ cases: ApiCase[] }>('/api/cases/admin/pending'),

  getVerified: (params?: AdminCaseFilters) => {
    const qs = new URLSearchParams();
    if (params?.type)   qs.set('type', params.type);
    if (params?.status) qs.set('status', params.status);
    if (params?.gender) qs.set('gender', params.gender);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString() ? `?${qs}` : '';
    return request<{ cases: ApiCase[] }>(`/api/cases/admin/verified${query}`);
  },

  submitReport: (formData: FormData) =>
    fetch(`${BASE}/api/cases`, {
      method: 'POST',
      credentials: 'include',
      body: formData,   // multipart — no Content-Type header, browser sets it
    }).then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body?.error ?? 'Submission failed.', res.status);
      }
      return res.json() as Promise<{ id: string; reference: string }>;
    }),

  updateStatus: (id: string, status: string, resolution?: object) =>
    request<{ case: ApiCase }>(`/api/cases/admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolution }),
    }),

  publish: (id: string) =>
    request<{ case: ApiCase }>(`/api/cases/admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'PUBLISH' }),
    }),

  togglePhoto: (id: string, currentPhotoHidden: boolean) =>
    request<{ case: ApiCase }>(`/api/cases/admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'TOGGLE_PHOTO', currentPhotoHidden }),
    }),
};

/* ── Matches ──────────────────────────────────────────────── */
export const matchesApi = {
  getMatches: () =>
    request<{ matches: ApiMatch[] }>('/api/matches'),

  runEngine: () =>
    request<{ inserted: number; message: string }>('/api/matches/run', {
      method: 'POST',
    }),

  dismiss: (id: string) =>
    request<{ message: string }>(`/api/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'dismiss' }),
    }),

  confirm: (id: string, resolution?: { notes?: string; identifiedName?: string }) =>
    request<{ message: string; missingCaseId: string; unidentifiedCaseId: string }>(
      `/api/matches/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ action: 'confirm', resolution }),
      }
    ),

  flag: (id: string) =>
    request<{ message: string }>(`/api/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'flag' }),
    }),

  unflag: (id: string) =>
    request<{ message: string }>(`/api/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'unflag' }),
    }),
};

/* ── Profiles ─────────────────────────────────────────────── */
export const profilesApi = {
  getAll: () =>
    request<{ profiles: ApiProfile[] }>('/api/admin/profiles'),

  create: (data: { email: string; password: string; full_name: string; role: AppRole }) =>
    request<{ profile: ApiProfile }>('/api/admin/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, updates: Partial<Pick<ApiProfile, 'full_name' | 'status' | 'role'>>) =>
    request<{ profile: ApiProfile }>(`/api/admin/profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  updatePassword: (id: string, password: string) =>
    request<{ message: string }>(`/api/admin/profiles/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    }),

  getLogs: (page = 1, limit = 50) =>
    request<{ logs: ApiLog[]; total: number; page: number; limit: number }>(
      `/api/admin/profiles/logs?page=${page}&limit=${limit}`
    ),
};

/* ── Types ────────────────────────────────────────────────── */
export type AppRole = 'SUPER_ADMIN' | 'SYSTEM_OWNER' | 'ADMIN' | 'MODERATOR';

export interface SessionUser {
  id:     string;
  email:  string;
  name:   string;
  role:   AppRole;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ApiCase {
  id:             string;
  type:           'MISSING' | 'UNIDENTIFIED';
  status:         'PENDING' | 'VERIFIED' | 'FOUND' | 'IDENTIFIED';
  case_reference?: string | null;
  full_name:      string | null;
  nickname:       string | null;
  age_approx:     number | null;
  age_range_min:  number | null;
  age_range_max:  number | null;
  gender:         'MALE' | 'FEMALE' | 'UNKNOWN';
  height_ft?:     number | null;
  description:    string | null;
  barangay_id:    number;
  barangay_name:  string | null;
  location_text:  string | null;
  incident_date:  string | null;
  coords:         { lat: number; lng: number } | null;
  photo_url:      string | null;
  reporter_name?:    string | null;
  reporter_contact?: string | null;
  /* Resolution fields — populated when status is FOUND or IDENTIFIED */
  resolution_notes?: string | null;
  identified_name?:  string | null;
  resolved_at?:      string | null;
  /* Publish / photo visibility flags */
  published?:        boolean;
  photo_hidden?:     boolean;
  created_at:     string;
}

export interface ApiProfile {
  id:         string;
  email:      string;
  full_name:  string;
  role:       AppRole;
  status:     'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface ApiLog {
  id:          number;
  created_at:  string;
  action_type: string;
  target_id:   string | null;
  target_type: string | null;
  description: string | null;
  ip_address:  string | null;
  user_name:   string | null;
  user_email:  string | null;
}

export interface ApiMatchPerson {
  name:            string;
  age:             string;
  gender:          string;
  barangay:        string;
  date:            string;
  location:        string;
  description:     string;
  photo:           string;
  reporterContact: string;
}

export interface ApiMatch {
  id:                 string;
  score:              number;
  distanceKm:         number | null;
  matchReasons:       string[];
  flagged:            boolean;
  missingCaseId:      string;
  unidentifiedCaseId: string;
  missing:            ApiMatchPerson;
  unidentified:       ApiMatchPerson;
}

export interface CaseFilters {
  barangay_id?: number;
  type?:        'MISSING' | 'UNIDENTIFIED';
  gender?:      'MALE' | 'FEMALE' | 'UNKNOWN';
}

export interface AdminCaseFilters extends CaseFilters {
  status?: string;
  search?: string;
}
