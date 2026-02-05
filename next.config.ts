import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

  // Add caching headers for static assets
  async headers() {
    return [
      {
        // Cache team logo SVGs for 1 year (immutable content)
        source: '/images/teams/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache other static images for 1 week
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
