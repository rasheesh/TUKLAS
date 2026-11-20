import { createClient } from '@supabase/supabase-js';
import dns from 'node:dns';
import 'dotenv/config';

/*
 * Prefer IPv4 when resolving hostnames.
 *
 * Supabase's host can resolve to NAT64-synthesized IPv6 (AAAA) records
 * (64:ff9b::/96). When that IPv6 path is unroutable — common on Windows
 * dev machines and some VPNs — Node's fetch (undici Happy Eyeballs) can
 * intermittently fail the whole request with an opaque "TypeError: fetch
 * failed". Resolving IPv4 first sidesteps that path. No effect on hosts
 * that only have A records.
 */
dns.setDefaultResultOrder('ipv4first');

if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL in .env');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');

/**
 * Service-role client — bypasses RLS.
 * Used only in server-side route handlers. Never expose to the browser.
 */
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Throwaway client for password sign-in / verification.
 * signInWithPassword() stores the user's session on the client it is called
 * on, so it must never be called on the shared service-role client above —
 * doing so makes every later query run as that user and hit RLS.
 */
export function createAuthClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
