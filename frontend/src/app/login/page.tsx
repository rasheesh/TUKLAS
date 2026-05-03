'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import '../../css/Login.css';

export default function LoginPage() {
  const { login, loading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [shaking, setShaking]   = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || authLoading) return;

    setError('');
    setLoading(true);

    try {
      await login(username.trim(), password.trim());
      /* Redirect is handled by AuthContext */
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Login failed.';
      /* Map backend error messages to user-friendly text */
      let msg = raw;
      if (raw.toLowerCase().includes('invalid credentials') || raw.toLowerCase().includes('invalid login')) {
        msg = 'Incorrect email or password. Please try again.';
      } else if (raw.toLowerCase().includes('inactive')) {
        msg = 'Your account has been deactivated. Contact a Super Admin.';
      } else if (raw.toLowerCase().includes('no admin profile')) {
        msg = 'No admin account found for this email.';
      }
      setError(msg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  const isSubmitting = loading || authLoading;

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true" />

      <div
        ref={cardRef}
        className={`login-card${shaking ? ' shake' : ''}`}
        role="main"
      >
        {/* Branding */}
        <div className="login-logos" aria-label="TUKLAS branding">
          <img
            src="/assets/icons/UBlogo.png"
            alt="University of Baguio seal"
            className="login-logo-img"
          />
          <div className="login-logo-divider" aria-hidden="true" />
          <div className="login-brand-text">
            <span className="login-brand-name">TUKLAS</span>
            <span className="login-brand-sub">Baguio City · Philippines</span>
          </div>
        </div>

        {/* Heading */}
        <div className="login-heading">
          <h1 className="login-title">Admin Portal Access</h1>
          <p className="login-subtitle">Authorized personnel only</p>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>

          {/* Email */}
          <div className="login-field">
            <label className="login-label" htmlFor="login-username">
              Email / Username
            </label>
            <div className="login-input-wrap">
              <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                id="login-username"
                type="email"
                className={`login-input${error ? ' error' : ''}`}
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="admin@tuklas.gov.ph"
                autoComplete="username"
                autoFocus
                required
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              Password
            </label>
            <div className="login-input-wrap">
              <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                className={`login-input${error ? ' error' : ''}`}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                aria-describedby={error ? 'login-error' : undefined}
              />
              <button
                type="button"
                className="login-pw-toggle"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              id="login-error"
              className={`login-error-msg${error.toLowerCase().includes('deactivated') ? ' inactive' : ''}`}
              role="alert"
              aria-live="assertive"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="login-submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Verifying…
              </>
            ) : (
              'Authorize Access'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <Link href="/forgot-password" className="login-footer-link">
            Forgot Password?
          </Link>
          <Link href="/" className="login-footer-link return">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Return to Public Site
          </Link>
        </div>

        {/* Security notice */}
        <div className="login-security-notice" aria-label="Security notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Secured · All access attempts are logged
        </div>
      </div>
    </div>
  );
}
