import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ["@libsql/client"],
  images: {
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
};

export default withNextIntl(nextConfig);
