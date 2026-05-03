'use client';

import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi, type SessionUser, type AppRole, ApiError } from '../lib/api';

/* ── Types ────────────────────────────────────────────────── */
interface AuthContextValue {
  user:        SessionUser | null;
  loading:     boolean;
  error:        string | null;
  login:       (email: string, password: string) => Promise<void>;
  logout:      () => Promise<void>;
  hasRole:     (...roles: AppRole[]) => boolean;
}

/* ── Context ──────────────────────────────────────────────── */
const AuthContext = createContext<AuthContextValue | null>(null);

/* ── RBAC helpers ─────────────────────────────────────────── */
const ROLE_RANK: Record<AppRole, number> = {
  MODERATOR:    1,
  ADMIN:        2,
  SYSTEM_OWNER: 3,
  SUPER_ADMIN:  4,
};

/* Routes that require authentication */
const PROTECTED_ROUTES = ['/admin'];
/* Routes that should redirect away if already logged in */
const AUTH_ROUTES      = ['/login'];

/* ── Provider ─────────────────────────────────────────────── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const router   = useRouter();
  const pathname = usePathname();

  /* Restore session on mount */
  useEffect(() => {
    authApi.session()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  /* Route protection */
  useEffect(() => {
    if (loading) return;

    const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
    const isAuthRoute = AUTH_ROUTES.includes(pathname);

    if (isProtected && !user) {
      router.replace('/login');
      return;
    }
    if (isAuthRoute && user) {
      router.replace('/admin');
    }
  }, [loading, user, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const { user, token } = await authApi.login(email, password) as { user: SessionUser; token: string };
      /*
       * Security note: the JWT is stored in sessionStorage so it can be sent
       * as an Authorization header for cross-origin API calls (the backend is
       * on a different port/domain). The httpOnly cookie handles same-origin
       * authentication and is the primary security mechanism — it is not
       * accessible to JavaScript. sessionStorage is cleared on tab close and
       * on logout. If the frontend and backend are ever co-located on the same
       * origin, the sessionStorage token can be removed entirely.
       */
      if (token) sessionStorage.setItem('tuklas_token', token);
      setUser(user);
      router.replace('/admin');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    sessionStorage.removeItem('tuklas_token');
    setUser(null);
    router.replace('/login');
  }, [router]);

  const hasRole = useCallback((...roles: AppRole[]) => {
    if (!user) return false;
    return roles.some(r => ROLE_RANK[user.role] >= ROLE_RANK[r]);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────── */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
