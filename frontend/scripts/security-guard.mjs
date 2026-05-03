/**
 * Security Guard — TUKLAS
 *
 * Runs early in the browser to clear stale auth state.
 * Called by the Next.js app before the main bundle loads.
 *
 * Responsibilities:
 *  1. Detect and clear expired / malformed JWT tokens from sessionStorage
 *  2. Ensure a forced-logout (password reset) is honoured by clearing
 *     the local token so the next request gets a 401 and redirects to login
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'tuklas_token';

  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;

    /* Decode the JWT payload (base64url, no verification — server verifies) */
    const parts = token.split('.');
    if (parts.length !== 3) {
      sessionStorage.removeItem(TOKEN_KEY);
      console.warn('[Security Guard] Malformed token removed.');
      return;
    }

    /* base64url → base64 → JSON */
    const padded  = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded));

    /* Check expiry — exp is Unix seconds */
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      sessionStorage.removeItem(TOKEN_KEY);
      console.warn('[Security Guard] Expired token cleared.');
      return;
    }

    /* Token looks valid — leave it in place for AuthContext to use */
  } catch (err) {
    /* Any parse error → clear the token to force a clean login */
    sessionStorage.removeItem(TOKEN_KEY);
    console.warn('[Security Guard] Token parse error — cleared.', err.message);
  }
})();
