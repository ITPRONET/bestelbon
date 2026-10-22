import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/cloudprnt/[token]": ["./src/assets/fonts/**"],
    "/beheer/bon/[id]": ["./src/assets/fonts/**"],
  },
};
export default nextConfig;
