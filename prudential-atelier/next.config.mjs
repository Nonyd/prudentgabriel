import { PERMANENT_REDIRECTS } from "./redirects.mjs";
import { NOINDEX_HEADER_VALUE, searchIndexingAllowed } from "./search-indexing.mjs";
import { securityHeaderRules } from "./security-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "staging.prudentgabriel.com", pathname: "/media/**" },
      { protocol: "https", hostname: "prudentgabriel.com", pathname: "/media/**" },
      { protocol: "https", hostname: "www.prudentgabriel.com", pathname: "/media/**" },
      { protocol: "http", hostname: "localhost", pathname: "/media/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/media/**" },
    ],
    // AZ1 — GHSA-2xp9-vwfh-vxw4: MITIGATED, NOT FIXED. No patched Next 14.x.
    // AVIF via the Image Optimization API is RCE-capable until Next ≥15.5.24.
    // Do not re-enable "image/avif" before that migration (Slice X measured ~6×
    // smaller; the hole reopens the day AVIF returns on 14.x).
    formats: ["image/webp"],
    minimumCacheTTL: 31536000,
  },
  compress: true,
  poweredByHeader: false,
  transpilePackages: ["mediabunny"],
  // SKIP_STANDALONE is local Windows only. CI/Docker must always emit standalone.
  output: process.env.SKIP_STANDALONE === "1" && !process.env.CI ? undefined : "standalone",
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["sharp"],
  },
  async redirects() {
    return PERMANENT_REDIRECTS;
  },
  async headers() {
    return [
      ...securityHeaderRules(),
      {
        source: "/.well-known/apple-developer-merchantid-domain-association",
        headers: [
          { key: "Content-Type", value: "text/plain" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      // Every response of a non-production deployment (staging, previews,
      // localhost) — pages, API, media, static — carries noindex. Decided by the
      // image's own NEXT_PUBLIC_APP_URL, never a flag. See search-indexing.mjs.
      ...(searchIndexingAllowed()
        ? []
        : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: NOINDEX_HEADER_VALUE }] }]),
    ];
  },
};

export default nextConfig;
