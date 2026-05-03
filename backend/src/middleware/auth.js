import { supabase } from '../lib/supabase.js';

/**
 * Verifies the session cookie and attaches the profile to req.user.
 * Returns 401 if no valid session, 403 if account is INACTIVE.
 */
export async function requireAuth(req, res, next) {
  /* Accept token from cookie OR Authorization header */
  const cookieToken = req.cookies?.tuklas_session;
  const bearerToken = req.headers?.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  try {
    /* Verify the JWT with Supabase */
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Session expired or invalid.' });
    }

    /* Fetch the profile row for role + status */
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Profile not found.' });
    }

    if (profile.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Account is inactive. Contact a Super Admin.' });
    }

    req.user = profile;
    next();
  } catch (err) {
    console.error('[Auth Middleware]', err.message);
    res.status(500).json({ error: 'Authentication check failed.' });
  }
}

/**
 * Role guard factory. Usage: requireRole('ADMIN', 'SUPER_ADMIN')
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}
