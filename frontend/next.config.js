/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Multi-stage production Dockerfile: enabled when STANDALONE=true / OUTPUT_STANDALONE=1.
  // When building for Vercel or local dev/test, Next.js native build is used.
  ...(process.env.STANDALONE === "true" || process.env.OUTPUT_STANDALONE === "1" ? { output: "standalone" } : {}),

  // Dev-only: disable Webpack's persistent filesystem pack cache. Killing the
  // dev server mid-write leaves a half-renamed `.pack.gz_` behind, and the next
  // boot throws "Caching failed for pack: ENOENT". A fresh compile per restart
  // is a small cost that removes the corrupt-cache crash entirely.
  webpack: (config, { dev }) => {
    if (dev) config.cache = false;
    return config;
  },

  async redirects() {
    return [
      // Legacy routes → new enterprise URL scheme (301 permanent)
      // Note: Root (/) redirect is handled by app/page.tsx via next/navigation redirect
      { source: "/topology", destination: "/dashboard/topology", permanent: true },
      { source: "/wargame", destination: "/campaigns", permanent: true },
      { source: "/playground", destination: "/sandbox", permanent: true },
      { source: "/attack-library", destination: "/library", permanent: true },
      { source: "/policies", destination: "/admin/policies", permanent: true },
      { source: "/providers", destination: "/admin/providers", permanent: true },

      // Deep legacy paths (e.g., /wargame/anything → /campaigns/anything)
      { source: "/wargame/:path*", destination: "/campaigns/:path*", permanent: true },
      { source: "/playground/:path*", destination: "/sandbox/:path*", permanent: true },
      { source: "/attack-library/:path*", destination: "/library/:path*", permanent: true },
      { source: "/policies/:path*", destination: "/admin/policies/:path*", permanent: true },
      { source: "/providers/:path*", destination: "/admin/providers/:path*", permanent: true },
      { source: "/topology/:path*", destination: "/dashboard/topology/:path*", permanent: true },
      { source: "/register", destination: "/login?mode=register", permanent: false },
      { source: "/signup", destination: "/login?mode=register", permanent: false },
      // NOTE: /settings/* is intentionally NOT redirected — real App Router
      // pages exist at /settings/{integrations,audit-log,team,notifications}.
    ];
  },

  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
    // Only rewrite at edge if an explicit external backend is provided.
    // Otherwise, the BFF route handler in app/api/backend/[...path]/route.ts handles the request.
    if (backendUrl && !backendUrl.includes("127.0.0.1") && !backendUrl.includes("localhost")) {
      return [
        {
          source: "/api/backend/:path*",
          destination: `${backendUrl}/:path*`,
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
