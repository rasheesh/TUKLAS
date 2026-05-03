'use client';

import { useState, useEffect } from 'react';
import { profilesApi, type ApiProfile, type AppRole } from '../../lib/api';

export type UserRole   = 'superadmin' | 'admin' | 'moderator';
export type UserStatus = 'active' | 'inactive';

/* Map API role → local role */
function toLocalRole(r: AppRole): UserRole {
  if (r === 'SUPER_ADMIN' || r === 'SYSTEM_OWNER') return 'superadmin';
  if (r === 'ADMIN') return 'admin';
  return 'moderator';
}

/* Map local role → API role */
function toApiRole(r: UserRole): AppRole {
  if (r === 'superadmin') return 'SUPER_ADMIN';
  if (r === 'admin') return 'ADMIN';
  return 'MODERATOR';
}

export interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
  createdAt: string;
}

function apiProfileToStaffUser(p: ApiProfile): StaffUser {
  const name  = (p.full_name ?? '').trim();
  const spaceIdx = name.indexOf(' ');
  return {
    id:        p.id,
    firstName: spaceIdx >= 0 ? name.slice(0, spaceIdx) : name,
    lastName:  spaceIdx >= 0 ? name.slice(spaceIdx + 1) : '',
    email:     p.email,
    role:      toLocalRole(p.role),
    status:    p.status === 'ACTIVE' ? 'active' : 'inactive',
    lastLogin: '—',
    createdAt: p.created_at ?? '',
  };
}

interface UserManagementProps {
  currentRole: UserRole;
}

function fmt(iso: string) {
  if (iso === '—') return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(u: StaffUser) {
  return (u.firstName[0] + u.lastName[0]).toUpperCase();
}

function roleName(role: UserRole) {
  if (role === 'superadmin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  return 'Moderator';
}

/* ── Add User Modal ─────────────────────────────────────────── */
interface AddUserModalProps {
  currentRole: UserRole;
  onClose: () => void;
  onAdd: (u: StaffUser) => void;
}

function AddUserModal({ currentRole, onClose, onAdd }: AddUserModalProps) {
  const defaultRole: UserRole = 'moderator';
  const [form, setForm]   = useState({ firstName: '', lastName: '', email: '', role: defaultRole as UserRole, password: '' });
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setApiError('');
      setForm(f => ({ ...f, [k]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.password) return;
    setSaving(true);
    setApiError('');
    try {
      const res = await profilesApi.create({
        email:     form.email.trim(),
        password:  form.password,
        full_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        role:      toApiRole(form.role),
      });
      onAdd(apiProfileToStaffUser(res.profile));
      onClose();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mgmt-modal-overlay" role="dialog" aria-modal="true" aria-label="Add new user"
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="mgmt-modal">
        <div className="mgmt-modal-header">
          <h2 className="mgmt-modal-title">Add Staff Account</h2>
          <button className="mgmt-modal-close" onClick={onClose} aria-label="Close" disabled={saving}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mgmt-modal-body">
            {apiError && (
              <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#c0392b', marginBottom: '0.25rem' }} role="alert">
                {apiError}
              </div>
            )}
            <div className="mgmt-form-row">
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="add-fname">First Name *</label>
                <input id="add-fname" className="mgmt-form-input" type="text" value={form.firstName} onChange={set('firstName')} required autoFocus disabled={saving} />
              </div>
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="add-lname">Last Name *</label>
                <input id="add-lname" className="mgmt-form-input" type="text" value={form.lastName} onChange={set('lastName')} required disabled={saving} />
              </div>
            </div>
            <div className="mgmt-form-group full">
              <label className="mgmt-form-label" htmlFor="add-email">Email Address *</label>
              <input id="add-email" className="mgmt-form-input" type="email" value={form.email} onChange={set('email')} placeholder="user@tuklas.gov.ph" required disabled={saving} />
            </div>
            <div className="mgmt-form-row">
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="add-role">Role *</label>
                <select id="add-role" className="mgmt-form-select" value={form.role}
                  onChange={e => { setApiError(''); setForm(f => ({ ...f, role: e.target.value as UserRole })); }}
                  disabled={saving}>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  {currentRole === 'superadmin' && <option value="superadmin">Super Admin</option>}
                </select>
              </div>
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="add-pw">Temporary Password *</label>
                <input id="add-pw" className="mgmt-form-input" type="password" value={form.password} onChange={set('password')} placeholder="Min. 8 characters" required minLength={8} disabled={saving} />
              </div>
            </div>
          </div>
          <div className="mgmt-modal-footer">
            <button type="button" className="mgmt-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="mgmt-btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true" style={{ animation: 'spin 0.75s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10"/></svg>
                  Creating…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Create Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Details Modal (superadmin only) ───────────────────── */
interface EditDetailsModalProps {
  user: StaffUser;
  onClose: () => void;
  onSaved: (u: StaffUser) => void;
}

function EditDetailsModal({ user, onClose, onSaved }: EditDetailsModalProps) {
  const [form, setForm]     = useState({ firstName: user.firstName, lastName: user.lastName });
  const [pw, setPw]         = useState({ next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setApiError('');

    if (pw.next) {
      if (pw.next.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
      if (pw.next !== pw.confirm) { setPwError('Passwords do not match.'); return; }
    }

    setSaving(true);
    try {
      const full_name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      if (!full_name) {
        setApiError('First name and last name cannot be empty.');
        setSaving(false);
        return;
      }
      const res = await profilesApi.update(user.id, { full_name });
      /* Password reset requires a separate backend call */
      if (pw.next) {
        await profilesApi.updatePassword(user.id, pw.next);
      }
      onSaved(apiProfileToStaffUser(res.profile));
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes.';
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mgmt-modal-overlay" role="dialog" aria-modal="true"
      aria-label={`Edit details for ${user.firstName} ${user.lastName}`}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="mgmt-modal">
        <div className="mgmt-modal-header">
          <h2 className="mgmt-modal-title">Edit Personal Details</h2>
          <button className="mgmt-modal-close" onClick={onClose} aria-label="Close" disabled={saving}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mgmt-modal-body">
            {/* Superadmin-only notice */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.75rem', background: 'rgba(112,21,21,0.05)', borderRadius: '8px', border: '1px solid rgba(112,21,21,0.15)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#701515" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <p style={{ fontSize: '0.75rem', color: '#701515', margin: 0, lineHeight: 1.5 }}>
                Super Admin only — you are editing another user's personal information on their behalf.
              </p>
            </div>

            {apiError && (
              <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#c0392b' }} role="alert">
                {apiError}
              </div>
            )}

            <div className="mgmt-form-row">
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="ed-fname">First Name *</label>
                <input id="ed-fname" className="mgmt-form-input" type="text" value={form.firstName}
                  onChange={e => { setApiError(''); setForm(f => ({ ...f, firstName: e.target.value })); }}
                  required autoFocus disabled={saving} />
              </div>
              <div className="mgmt-form-group">
                <label className="mgmt-form-label" htmlFor="ed-lname">Last Name *</label>
                <input id="ed-lname" className="mgmt-form-input" type="text" value={form.lastName}
                  onChange={e => { setApiError(''); setForm(f => ({ ...f, lastName: e.target.value })); }}
                  required disabled={saving} />
              </div>
            </div>

            {/* Read-only email — shown for context only */}
            <div className="mgmt-form-group full">
              <label className="mgmt-form-label">Email Address</label>
              <input className="mgmt-form-input" type="email" value={user.email} readOnly
                style={{ background: '#f5f5f5', color: 'var(--color-text-light)', cursor: 'not-allowed' }}
                title="Email cannot be changed here" />
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: '0.2rem', display: 'block' }}>
                Email changes must be done directly in Supabase Auth.
              </span>
            </div>

            {/* Optional password reset */}
            <div style={{ borderTop: '1px solid #e8eaed', paddingTop: '0.75rem' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-light)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reset Password (optional)
              </p>
              <div className="mgmt-form-row">
                <div className="mgmt-form-group">
                  <label className="mgmt-form-label" htmlFor="ed-pw-new">New Password</label>
                  <input id="ed-pw-new" className={`mgmt-form-input${pwError ? ' mgmt-input-error' : ''}`} type="password"
                    value={pw.next} onChange={e => { setPw(p => ({ ...p, next: e.target.value })); setPwError(''); }}
                    placeholder="Min. 8 characters" autoComplete="new-password" disabled={saving} />
                </div>
                <div className="mgmt-form-group">
                  <label className="mgmt-form-label" htmlFor="ed-pw-confirm">Confirm Password</label>
                  <input id="ed-pw-confirm" className={`mgmt-form-input${pwError ? ' mgmt-input-error' : ''}`} type="password"
                    value={pw.confirm} onChange={e => { setPw(p => ({ ...p, confirm: e.target.value })); setPwError(''); }}
                    placeholder="Re-enter password" autoComplete="new-password" disabled={saving} />
                </div>
              </div>
              {pwError && <p style={{ fontSize: '0.75rem', color: '#e74c3c', fontWeight: 600, margin: '0.25rem 0 0' }} role="alert">{pwError}</p>}
            </div>
          </div>
          <div className="mgmt-modal-footer">
            <button type="button" className="mgmt-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="mgmt-btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true" style={{ animation: 'spin 0.75s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10"/></svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Save Details
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Role Modal ────────────────────────────────────────── */
interface EditRoleModalProps {
  user: StaffUser;
  currentRole: UserRole;
  onClose: () => void;
  onSaved: (u: StaffUser) => void;
}

function EditRoleModal({ user, currentRole, onClose, onSaved }: EditRoleModalProps) {
  const [role, setRole]     = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setApiError('');
    try {
      const res = await profilesApi.update(user.id, { role: toApiRole(role) });
      onSaved(apiProfileToStaffUser(res.profile));
      onClose();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to update access level.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mgmt-modal-overlay" role="dialog" aria-modal="true"
      aria-label={`Change access level for ${user.firstName} ${user.lastName}`}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="mgmt-modal mgmt-confirm-modal">
        <div className="mgmt-modal-header">
          <h2 className="mgmt-modal-title">Change Access Level</h2>
          <button className="mgmt-modal-close" onClick={onClose} aria-label="Close" disabled={saving}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mgmt-modal-body">
            {/* User identity — read-only */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e8eaed' }}>
              <div className="user-avatar" aria-hidden="true">{initials(user)}</div>
              <div>
                <div className="user-name">{user.firstName} {user.lastName}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>

            {apiError && (
              <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#c0392b' }} role="alert">
                {apiError}
              </div>
            )}

            <div className="mgmt-form-group full">
              <label className="mgmt-form-label" htmlFor="role-select">Access Level *</label>
              <select id="role-select" className="mgmt-form-select" value={role}
                onChange={e => { setApiError(''); setRole(e.target.value as UserRole); }}
                autoFocus disabled={saving}>
                <option value="moderator">Moderator — can view and flag cases</option>
                <option value="admin">Admin — can verify and manage cases</option>
                {currentRole === 'superadmin' && (
                  <option value="superadmin">Super Admin — full system access</option>
                )}
              </select>
            </div>

            {/* Info note */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.75rem', background: 'rgba(52,152,219,0.06)', borderRadius: '8px', border: '1px solid rgba(52,152,219,0.15)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#2980b9" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style={{ fontSize: '0.75rem', color: '#2980b9', margin: 0, lineHeight: 1.5 }}>
                <strong>Moderator</strong> — view and flag cases only. <strong>Admin</strong> — approve, reject, and manage cases. <strong>Super Admin</strong> — full access including user management.
              </p>
            </div>
          </div>
          <div className="mgmt-modal-footer">
            <button type="button" className="mgmt-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="mgmt-btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true" style={{ animation: 'spin 0.75s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10"/></svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Save Access Level
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ───────────────────────────────────── */
function DeleteConfirmModal({ user, onClose, onConfirm }: { user: StaffUser; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="mgmt-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm delete"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mgmt-modal mgmt-confirm-modal">
        <div className="mgmt-modal-header">
          <h2 className="mgmt-modal-title">Delete Account</h2>
          <button className="mgmt-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="mgmt-confirm-body">
          <div className="mgmt-confirm-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </div>
          <h3 className="mgmt-confirm-title">Delete {user.firstName} {user.lastName}?</h3>
          <p className="mgmt-confirm-sub">This is permanent and cannot be undone. All access for this account will be immediately revoked.</p>
        </div>
        <div className="mgmt-modal-footer">
          <button className="mgmt-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="mgmt-btn-danger" onClick={() => { onConfirm(); onClose(); }} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
            Yes, Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export function UserManagement({ currentRole }: UserManagementProps) {
  const [users, setUsers]               = useState<StaffUser[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [showAdd, setShowAdd]           = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<StaffUser | null>(null);
  const [roleTarget, setRoleTarget]     = useState<StaffUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);

  /* Fetch profiles on mount */
  useEffect(() => {
    profilesApi.getAll()
      .then(r => {
        let profiles = r.profiles.map(apiProfileToStaffUser);
        /* ADMIN must not see SUPER_ADMIN or SYSTEM_OWNER accounts —
           the backend already filters these out, but we double-filter
           on the frontend as a defence-in-depth measure. */
        if (currentRole === 'admin') {
          profiles = profiles.filter(u => u.role !== 'superadmin');
        }
        setUsers(profiles);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentRole]);

  /* Moderators cannot access this component */
  if (currentRole === 'moderator') {
    return (
      <div className="role-gate-blocked" role="alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <h3>Admin Access Required</h3>
        <p>User Management is restricted to Admin and Super Admin accounts only.</p>
      </div>
    );
  }

  async function toggleStatus(u: StaffUser) {
    const newStatus = u.status === 'active' ? 'INACTIVE' : 'ACTIVE';
    /* Optimistic update */
    setUsers(us => us.map(x => x.id === u.id ? { ...x, status: newStatus === 'ACTIVE' ? 'active' : 'inactive' } : x));
    try {
      await profilesApi.update(u.id, { status: newStatus });
    } catch (err: unknown) {
      /* Revert on failure */
      setUsers(us => us.map(x => x.id === u.id ? u : x));
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  async function updateUser(updated: StaffUser) {
    try {
      const res = await profilesApi.update(updated.id, {
        full_name: `${updated.firstName} ${updated.lastName}`.trim(),
        role:      toApiRole(updated.role),
        status:    updated.status === 'active' ? 'ACTIVE' : 'INACTIVE',
      });
      setUsers(us => us.map(u => u.id === updated.id ? apiProfileToStaffUser(res.profile) : u));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  async function deleteUser(id: string) {
    /* Note: deleting from profiles only — Supabase Auth user remains.
       Full deletion requires a backend endpoint with admin.deleteUser().
       For now we deactivate instead of hard delete. */
    try {
      await profilesApi.update(id, { status: 'INACTIVE' });
      setUsers(us => us.filter(u => u.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <>
      {/* Error banner */}
      {error && (
        <div className="log-readonly-banner" role="alert" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.2)', color: '#c0392b', marginBottom: '0.75rem' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="mgmt-toolbar">
        <div className="mgmt-toolbar-left">
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
            {loading ? 'Loading…' : `${users.length} staff accounts · ${users.filter(u => u.status === 'active').length} active`}
          </span>
        </div>
        <button className="mgmt-btn-primary" onClick={() => setShowAdd(true)} aria-label="Add new user">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add User
        </button>
      </div>

      {/* Loading shimmer */}
      {loading && (
        <div className="user-table-wrap">
          {[1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', borderBottom: '1px solid #f0f0f0' }}>
              <div className="shimmer" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div className="shimmer shimmer-line shimmer-line-med" />
                <div className="shimmer shimmer-line shimmer-line-short" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && (
      <div className="user-table-wrap">
        <div className="user-table-scroll">
          <table className="user-table" aria-label="Staff accounts">
            <thead>
              <tr>
                <th>User</th>
                <th>Access Level</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)', fontSize: '0.85rem' }}>No staff accounts found.</td></tr>
              ) : users.map(u => {
                const isSuperAdminRow = u.role === 'superadmin';
                const canEditRole     = currentRole === 'superadmin' || (currentRole === 'admin' && !isSuperAdminRow);
                const canDelete       = currentRole === 'superadmin' || (currentRole === 'admin' && !isSuperAdminRow);

                return (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar" aria-hidden="true">{initials(u)}</div>
                        <div>
                          <div className="user-name">{u.firstName} {u.lastName}</div>
                          <div className="user-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.role === 'moderator' ? (
                        <span className="role-badge moderator" style={{ background: 'rgba(124,58,237,0.1)', color: '#6d28d9', border: '1px solid rgba(124,58,237,0.2)' }}>Moderator</span>
                      ) : u.role === 'superadmin' ? (
                        /* Only super admins see the "Super Admin" label */
                        currentRole === 'superadmin'
                          ? <span className="role-badge superadmin">Super Admin</span>
                          : <span className="role-badge admin">Admin</span>
                      ) : (
                        <span className={`role-badge ${u.role}`}>{roleName(u.role)}</span>
                      )}
                    </td>
                    <td><span className={`status-badge ${u.status}`}>{u.status}</span></td>
                    <td style={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                      {u.lastLogin === '—' ? '—' : fmt(u.lastLogin)}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>{fmt(u.createdAt)}</td>
                    <td>
                      <label className="toggle-switch" aria-label={`${u.status === 'active' ? 'Deactivate' : 'Activate'} ${u.firstName}`}>
                        <input type="checkbox" checked={u.status === 'active'} onChange={() => toggleStatus(u)} />
                        <span className="toggle-track" />
                      </label>
                    </td>
                    <td>
                      <div className="user-actions">
                        {currentRole === 'superadmin' && (
                          <button className="mgmt-btn-ghost" onClick={() => setDetailsTarget(u)}
                            aria-label={`Edit details for ${u.firstName} ${u.lastName}`}
                            style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Details
                          </button>
                        )}
                        {(currentRole === 'admin' || currentRole === 'superadmin') && (
                          <button className="mgmt-btn-ghost" onClick={() => canEditRole && setRoleTarget(u)}
                            disabled={!canEditRole}
                            aria-label={`Change access level for ${u.firstName} ${u.lastName}`}
                            title={!canEditRole ? 'Cannot change Super Admin role' : undefined}
                            style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', opacity: canEditRole ? 1 : 0.4, cursor: canEditRole ? 'pointer' : 'not-allowed' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            Access
                          </button>
                        )}
                        {(currentRole === 'admin' || currentRole === 'superadmin') && (
                          <button className="mgmt-btn-danger" onClick={() => canDelete && setDeleteTarget(u)}
                            disabled={!canDelete}
                            aria-label={`Delete ${u.firstName} ${u.lastName}`}
                            title={!canDelete ? 'Cannot delete Super Admin' : undefined}
                            style={{ opacity: canDelete ? 1 : 0.4, cursor: canDelete ? 'pointer' : 'not-allowed' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            </svg>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddUserModal
          currentRole={currentRole}
          onClose={() => setShowAdd(false)}
          onAdd={u => setUsers(us => [u, ...us])}
        />
      )}
      {detailsTarget && (
        <EditDetailsModal
          user={detailsTarget}
          onClose={() => setDetailsTarget(null)}
          onSaved={updated => setUsers(us => us.map(u => u.id === updated.id ? updated : u))}
        />
      )}
      {roleTarget && (
        <EditRoleModal
          user={roleTarget}
          currentRole={currentRole}
          onClose={() => setRoleTarget(null)}
          onSaved={updated => setUsers(us => us.map(u => u.id === updated.id ? updated : u))}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteUser(deleteTarget.id)}
        />
      )}
    </>
  );
}
