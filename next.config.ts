import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
    ],
  },
};

export default withNextIntl(nextConfig);
