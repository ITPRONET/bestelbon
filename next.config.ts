import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // WordPress uses trailing slashes; let those requests pass through unchanged.
  skipTrailingSlashRedirect: true,
  // Photos of dishes are shrunk in the browser, but leave some room.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ];
    return [
      // Beheer en aanmelden mogen niet in een iframe van een andere site (clickjacking).
      { source: "/beheer/:path*", headers: [...common, { key: "X-Frame-Options", value: "DENY" }, { key: "Cache-Control", value: "private, no-store" }] },
      { source: "/aanmelden", headers: [...common, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/api/:path*", headers: common },
      { source: "/:slug", headers: common },
    ];
  },
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/cloudprnt/[token]": ["./src/assets/fonts/**"],
    "/beheer/bon/[id]": ["./src/assets/fonts/**"],
  },
};
export default nextConfig;
