import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin Turbopack's workspace root to this folder so it never infers the
  // monorepo root (and scans backend/) when stray lockfiles appear above.
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [
      {
        // Supabase Storage — for case photos uploaded by reporters
        protocol: 'https',
        hostname: 'mfhpfxowxvdfqeuwkcdf.supabase.co',
      },
    ],
  },
};

export default nextConfig;
