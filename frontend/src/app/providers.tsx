'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../context/AuthContext';

/** Client-side providers wrapper. Keeps the root layout a server component
 *  while still establishing the AuthProvider context the app depends on. */
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
