import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { logAction } from '../lib/auditLogger.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/* ── POST /api/admin/profiles — create new staff account ─── */
router.post('/', requireAuth, requireRole('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'), async (req, res) => {
  const { email, password, full_name, role } = req.body ?? {};
  const callerRole = req.user.role;

  /* Validate required fields */
  if (!email || !password || !full_name || !role) {
    return res.status(422).json({ error: 'email, password, full_name, and role are required.' });
  }
  if (password.length < 8) {
    return res.status(422).json({ error: 'Password must be at least 8 characters.' });
  }

  /* Role escalation guard */
  if (callerRole === 'ADMIN' && (role === 'SUPER_ADMIN' || role === 'SYSTEM_OWNER')) {
    return res.status(403).json({ error: 'Admin cannot create Super Admin or System Owner accounts.' });
  }
  if (callerRole === 'SYSTEM_OWNER' && role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'System Owner cannot create Super Admin accounts.' });
  }

  try {
    /* 1. Create the Supabase Auth user (service role required) */
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,   // skip email confirmation for admin-created accounts
    });

    if (authError) {
      /* Surface friendly messages for common errors */
      if (authError.message?.toLowerCase().includes('already registered')) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      throw authError;
    }

    const userId = authData.user.id;

    /* 2. Insert the profile row */
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id:        userId,
        email,
        full_name,
        role,
        status:    'ACTIVE',
      })
      .select('id, email, full_name, role, status, created_at, updated_at')
      .single();

    if (profileError) {
      /* Clean up the auth user if profile insert fails */
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      throw profileError;
    }

    await logAction({
      adminId:     req.user.id,
      action:      'USER_CREATED',
      targetId:    userId,
      targetType:  'profile',
      description: `Account created for ${email} (${role}) by ${req.user.full_name}`,
      ipAddress:   req.ip,
    });

    res.status(201).json({ profile });
  } catch (err) {
    console.error('[POST /admin/profiles]', err.message);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

/* ── GET /api/admin/profiles ─────────────────────────────── */
router.get('/', requireAuth, requireRole('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, role, status, created_at, updated_at')
      .order('created_at', { ascending: true });

    /* ADMIN and MODERATOR must not see SUPER_ADMIN or SYSTEM_OWNER accounts.
       Only SUPER_ADMIN and SYSTEM_OWNER can see the full list. */
    const callerRole = req.user.role;
    if (callerRole === 'ADMIN' || callerRole === 'MODERATOR') {
      query = query.in('role', ['ADMIN', 'MODERATOR']);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ profiles: data });
  } catch (err) {
    console.error('[GET /admin/profiles]', err.message);
    res.status(500).json({ error: 'Failed to fetch profiles.' });
  }
});

/* ── GET /api/admin/profiles/logs ────────────────────────── */
/* IMPORTANT: this route MUST be defined before /:id to prevent
   Express matching "logs" as an :id parameter. */
router.get('/logs', requireAuth, requireRole('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  ?? '1'));
    const limit = Math.min(100, parseInt(req.query.limit ?? '50'));
    const from  = (page - 1) * limit;

    let query = supabase
      .from('audit_logs')
      .select(`
        id, created_at, action_type, target_id, target_type, description, ip_address,
        profiles ( full_name, email )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (req.query.action) query = query.eq('action_type', req.query.action);

    const { data, error, count } = await query;
    if (error) throw error;

    const logs = data.map(l => ({
      ...l,
      user_name:  l.profiles?.full_name ?? null,
      user_email: l.profiles?.email     ?? null,
      profiles:   undefined,
    }));

    res.json({ logs, total: count, page, limit });
  } catch (err) {
    console.error('[GET /admin/logs]', err.message);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

/* ── PATCH /api/admin/profiles/:id/password — reset password ─ */
router.patch('/:id/password', requireAuth, requireRole('SUPER_ADMIN', 'SYSTEM_OWNER'), async (req, res) => {
  const { id } = req.params;
  const { password } = req.body ?? {};

  if (!password || password.trim().length < 8) {
    return res.status(422).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    /* 1. Update the password in Supabase Auth (service role handles hashing) */
    const { error: pwError } = await supabase.auth.admin.updateUserById(id, {
      password: password.trim(),
    });
    if (pwError) throw pwError;

    /* 2. Force-logout all existing sessions for this user so stale tokens
          cannot be used to log in with the old password */
    const { error: signOutError } = await supabase.auth.admin.signOut(id, 'global');
    if (signOutError) {
      /* Non-fatal — log but don't fail the request */
      console.warn('[PATCH password] Could not invalidate sessions for user', id, ':', signOutError.message);
    }

    /* 3. Ensure the profile status is still ACTIVE (guard against accidental deactivation) */
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', id)
      .single();

    if (!profileErr && profile?.status === 'INACTIVE') {
      await supabase.from('profiles').update({ status: 'ACTIVE' }).eq('id', id);
      console.warn('[PATCH password] Profile was INACTIVE — restored to ACTIVE for user', id);
    }

    await logAction({
      adminId:     req.user.id,
      action:      'USER_UPDATED',
      targetId:    id,
      targetType:  'profile',
      description: `Password reset for user ${id} by ${req.user.full_name}. All sessions invalidated.`,
      ipAddress:   req.ip,
    });

    res.json({ message: 'Password updated and all sessions invalidated.' });
  } catch (err) {
    console.error('[PATCH /admin/profiles/:id/password]', err.message);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

/* ── PATCH /api/admin/profiles/:id ───────────────────────── */
router.patch('/:id', requireAuth, requireRole('ADMIN', 'SYSTEM_OWNER', 'SUPER_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { full_name, status, role } = req.body ?? {};
  const callerRole = req.user.role;

  /* ADMIN cannot modify SUPER_ADMIN or SYSTEM_OWNER accounts */
  if (callerRole === 'ADMIN') {
    const { data: target, error: fetchErr } = await supabase
      .from('profiles').select('role').eq('id', id).single();
    if (fetchErr) return res.status(404).json({ error: 'Profile not found.' });
    if (target.role === 'SUPER_ADMIN' || target.role === 'SYSTEM_OWNER') {
      return res.status(403).json({ error: 'Admin cannot modify Super Admin or System Owner accounts.' });
    }
  }

  /* SYSTEM_OWNER cannot assign SUPER_ADMIN role */
  if (callerRole === 'SYSTEM_OWNER' && role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'System Owner cannot assign Super Admin role.' });
  }

  /* ADMIN cannot assign SUPER_ADMIN or SYSTEM_OWNER role */
  if (callerRole === 'ADMIN' && (role === 'SUPER_ADMIN' || role === 'SYSTEM_OWNER')) {
    return res.status(403).json({ error: 'Admin cannot assign Super Admin or System Owner role.' });
  }

  try {
    const updates = {};
    if (full_name !== undefined && full_name.trim()) updates.full_name = full_name.trim();
    if (status    !== undefined) updates.status    = status;
    if (role      !== undefined) updates.role      = role;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    /* Verify the profile exists first */
    const { data: existing, error: existErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .single();

    if (existErr || !existing) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    /* Use the service-role client which bypasses RLS */
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select('id, email, full_name, role, status, created_at, updated_at')
      .single();

    if (error) {
      console.error(`[PATCH /admin/profiles/${id}] Supabase error:`, error.code, error.message, error.details);
      throw error;
    }

    await logAction({
      adminId:     req.user.id,
      action:      'USER_UPDATED',
      targetId:    id,
      targetType:  'profile',
      description: `Profile ${data.email} updated by ${req.user.full_name}: ${JSON.stringify(updates)}`,
      ipAddress:   req.ip,
    });

    res.json({ profile: data });
  } catch (err) {
    console.error('[PATCH /admin/profiles/:id]', err.message);
    res.status(500).json({ error: err.message || 'Failed to update profile.' });
  }
});

export default router;
