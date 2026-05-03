import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { logAction } from '../lib/auditLogger.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
  path: '/',
};

/* ── POST /api/auth/login ─────────────────────────────────── */
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    /* 1. Authenticate with Supabase Auth — trim both fields to prevent
          whitespace mismatches (e.g. after a copy-paste or password reset) */
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password: password.trim(),
    });

    if (authError || !authData?.session) {
      return res.status(401).json({ error: 'Invalid credentials. Access denied.' });
    }

    /* 2. Fetch profile for role + status */
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.error('[Auth /login] Profile lookup failed:', profileError?.message, '| user id:', authData.user.id);
      return res.status(401).json({ error: 'No admin profile found for this account.' });
    }

    if (profile.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Account is inactive. Contact a Super Admin.' });
    }

    /* 3. Set session cookie AND return token in body */
    res.cookie('tuklas_session', authData.session.access_token, COOKIE_OPTIONS);

    /* 4. Log the login */
    await logAction({
      adminId:     profile.id,
      action:      'LOGIN',
      targetId:    profile.id,
      targetType:  'profile',
      description: `${profile.full_name} logged in`,
      ipAddress:   req.ip,
    });

    return res.json({
      token: authData.session.access_token,
      user: {
        id:       profile.id,
        email:    profile.email,
        name:     profile.full_name,
        role:     profile.role,
        status:   profile.status,
      },
    });
  } catch (err) {
    console.error('[Auth /login]', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/* ── POST /api/auth/logout ────────────────────────────────── */
router.post('/logout', async (req, res) => {
  const token = req.cookies?.tuklas_session;

  if (token) {
    /* Sign out from Supabase (invalidates the token server-side) */
    await supabase.auth.admin.signOut(token).catch(() => {});
  }

  res.clearCookie('tuklas_session', { path: '/' });
  res.json({ message: 'Logged out.' });
});

/* ── GET /api/auth/session ────────────────────────────────── */
router.get('/session', async (req, res) => {
  const token = req.cookies?.tuklas_session;
  if (!token) return res.status(401).json({ error: 'No session.' });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Session expired.' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.status === 'INACTIVE') {
      return res.status(401).json({ error: 'Session invalid.' });
    }

    return res.json({
      user: {
        id:     profile.id,
        email:  profile.email,
        name:   profile.full_name,
        role:   profile.role,
        status: profile.status,
      },
    });
  } catch (err) {
    console.error('[Auth /session]', err.message);
    res.status(500).json({ error: 'Session check failed.' });
  }
});

/* ── PATCH /api/auth/me/password ──────────────────────────── */
router.patch('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword?.trim() || !newPassword?.trim()) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
  }
  if (newPassword.trim().length < 8) {
    return res.status(422).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    /* Step 1 — Verify current password */
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email:    req.user.email,
      password: currentPassword.trim(),
    });
    if (verifyError) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    /* Step 2 — Update password (Supabase handles bcrypt hashing) */
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      req.user.id,
      { password: newPassword.trim() }
    );
    if (updateError) {
      console.error('[Auth /me/password] Update failed:', updateError.message);
      return res.status(500).json({ error: 'Failed to update password. Please try again.' });
    }

    /* Step 3 — Audit log (non-blocking) */
    logAction({
      adminId:     req.user.id,
      action:      'USER_UPDATED',
      targetId:    req.user.id,
      targetType:  'profile',
      description: `User ${req.user.id} updated their own password.`,
      ipAddress:   req.ip,
    }).catch(err => console.error('[Auth /me/password] Audit log failed:', err.message));

    return res.json({ message: 'Password successfully updated.' });
  } catch (err) {
    console.error('[Auth /me/password]', err.message);
    res.status(500).json({ error: 'Password update failed. Please try again.' });
  }
});

export default router;
