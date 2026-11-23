import type { NextConfig } from 'next';

const config: NextConfig = {
  async rewrites() {
    return ['auth', 'api', 'media'].map(prefix => ({
      source: `/${prefix}/:path*`,
      destination: `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:24000'}/${prefix}/:path*`,
    }));
  },
};
export default config;

