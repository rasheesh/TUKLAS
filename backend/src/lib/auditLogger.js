import { supabase } from './supabase.js';

/**
 * Inserts a record into audit_logs.
 * Non-blocking — failures are logged to console but never throw.
 *
 * @param {object} params
 * @param {string|null} params.adminId   - UUID of the authenticated user
 * @param {string}      params.action    - log_action enum value
 * @param {string|null} params.targetId  - UUID of the affected record
 * @param {string}      params.targetType - e.g. 'case', 'profile'
 * @param {string}      params.description
 * @param {string|null} params.ipAddress - client IP
 */
export async function logAction({ adminId, action, targetId, targetType, description, ipAddress }) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      admin_id:    adminId   ?? null,
      action_type: action,
      target_id:   targetId  ?? null,
      target_type: targetType,
      description,
      ip_address:  ipAddress ?? null,
    });
    if (error) console.error('[AuditLogger] Insert failed:', error.message);
  } catch (err) {
    console.error('[AuditLogger] Unexpected error:', err.message);
  }
}
