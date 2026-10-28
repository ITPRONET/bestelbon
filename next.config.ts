import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // WordPress uses trailing slashes; let those requests pass through unchanged.
  skipTrailingSlashRedirect: true,
  // Photos of dishes are shrunk in the browser, but leave some room.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/cloudprnt/[token]": ["./src/assets/fonts/**"],
    "/beheer/bon/[id]": ["./src/assets/fonts/**"],
  },
};
export default nextConfig;
