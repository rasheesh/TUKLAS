'use client';

import { useState, useMemo, useEffect } from 'react';
import { profilesApi, type ApiLog } from '../../lib/api';

export type LogAction =
  | 'login' | 'logout'
  | 'verify' | 'approve' | 'reject'
  | 'edit' | 'delete' | 'create' | 'deactivate';

export interface LogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: LogAction;
  targetId: string;
  targetType: string;
  details: string;
  ipAddress: string;
}

function apiLogToEntry(l: ApiLog): LogEntry {
  return {
    id:         String(l.id),
    timestamp:  l.created_at,
    userId:     '',
    userName:   l.user_name ?? 'System',
    action:     (l.action_type?.toLowerCase().replace('case_', '').replace('user_', '') ?? 'edit') as LogAction,
    targetId:   l.target_id ?? '',
    targetType: l.target_type ?? '',
    details:    l.description ?? '',
    ipAddress:  l.ip_address ?? '',
  };
}

/* ── API-ready: logs will be fetched from the backend ───────── */
const EMPTY_LOGS: LogEntry[] = [];

const ACTION_COLORS: Record<LogAction, string> = {
  login:      'login',
  logout:     'logout',
  verify:     'verify',
  approve:    'approve',
  reject:     'reject',
  edit:       'edit',
  delete:     'delete',
  create:     'create',
  deactivate: 'deactivate',
};

function fmtTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

const PAGE_SIZE = 10;

export function ActivityLogs({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  /* API-ready: replace with useEffect fetch when backend is live */
  const [logs, setLogs] = useState<LogEntry[]>(EMPTY_LOGS);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError]     = useState('');

  useEffect(() => {
    /* All admin roles (ADMIN, SYSTEM_OWNER, SUPER_ADMIN) can view logs.
       The isSuperAdmin prop is kept for the role-gate UI only. */
    profilesApi.getLogs(1, 100)
      .then(r => setLogs(r.logs.map(apiLogToEntry)))
      .catch(err => setFetchError(err.message))
      .finally(() => setFetchLoading(false));
  }, []);

  const [actionFilter, setActionFilter] = useState<LogAction | 'all'>('all');
  const [userFilter,   setUserFilter]   = useState('all');
  const [page, setPage] = useState(1);

  const uniqueUsers = useMemo(() =>
    Array.from(new Set(logs.map(l => l.userName))).sort()
  , [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (userFilter   !== 'all' && l.userName !== userFilter)  return false;
      return true;
    });
  }, [logs, actionFilter, userFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const slice      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="log-table-wrap">
      {/* Read-only banner */}
      <div className="log-readonly-banner" role="note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Read-Only Audit Trail — These logs cannot be edited or deleted by any user, including Super Admins.
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="log-readonly-banner" role="alert" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.2)', color: '#c0392b' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Failed to load logs: {fetchError}
        </div>
      )}

      {/* Loading shimmer */}
      {fetchLoading && (
        <div style={{ padding: '1rem' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid #f0f0f0' }}>
              <div className="shimmer shimmer-line" style={{ width: 120 }} />
              <div className="shimmer shimmer-line shimmer-line-short" />
              <div className="shimmer shimmer-line shimmer-line-med" style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {!fetchLoading && (
      <div style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid #e8eaed', flexWrap: 'wrap' }}>
        <select
          className="vtable-filter-select"
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value as typeof actionFilter); setPage(1); }}
          aria-label="Filter by action"
        >
          <option value="all">All Actions</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
          <option value="verify">Verify</option>
          <option value="edit">Edit</option>
          <option value="delete">Delete</option>
          <option value="create">Create</option>
          <option value="deactivate">Deactivate</option>
        </select>
        <select
          className="vtable-filter-select"
          value={userFilter}
          onChange={e => { setUserFilter(e.target.value); setPage(1); }}
          aria-label="Filter by user"
        >
          <option value="all">All Users</option>
          {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', alignSelf: 'center', marginLeft: 'auto' }}>
          {filtered.length} entries
        </span>
      </div>
      )}

      {/* Empty state */}
      {logs.length === 0 ? (
        <div className="vtable-empty" role="status" aria-live="polite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p className="vtable-empty-title">No audit logs yet</p>
          <p className="vtable-empty-sub">Activity will be recorded here once admins begin using the system.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="log-table-scroll">
            <table className="log-table" aria-label="Activity audit log" aria-readonly="true">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Target ID</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {slice.map(l => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{fmtTs(l.timestamp)}</td>
                    <td className="log-td-normal" style={{ fontWeight: 600, fontSize: '0.8rem' }}>{l.userName}</td>
                    <td className="log-td-normal">
                      <span className={`log-action-badge ${ACTION_COLORS[l.action]}`}>{l.action}</span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{l.targetId}</td>
                    <td className="log-td-normal" style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{l.targetType}</td>
                    <td className="log-td-normal" style={{ fontSize: '0.78rem', maxWidth: '260px' }}>{l.details}</td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>{l.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="vtable-pagination">
              <span className="vtable-page-info">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="vtable-page-btns">
                <button className="vtable-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} aria-label="Previous">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} className={`vtable-page-btn${n === safePage ? ' active' : ''}`} onClick={() => setPage(n)} aria-label={`Page ${n}`}>{n}</button>
                ))}
                <button className="vtable-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} aria-label="Next">›</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
