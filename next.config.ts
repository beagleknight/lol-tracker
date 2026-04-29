import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// ─── Content Security Policy ──────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://sdk.canny.io https://stats.thegreenvintage.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://ddragon.leagueoflegends.com https://cdn.discordapp.com https://raw.communitydragon.org https://*.canny.io",
  "font-src 'self'",
  "connect-src 'self' https://*.canny.io https://stats.thegreenvintage.com",
  "object-src 'none'",
  "frame-src https://*.canny.io",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
];

const cspHeader = cspDirectives.join("; ");

// ─── Next.js Configuration ───────────────────────────────────────────────────
const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ["@libsql/client"],
  images: {
    minimumCacheTTL: 2592000, // 30 days — DDragon assets are versioned and never change
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com",
        pathname: "/cdn/**",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "raw.communitydragon.org",
        pathname: "/latest/plugins/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
