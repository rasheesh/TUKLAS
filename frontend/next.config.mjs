/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
