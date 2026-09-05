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
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },
  compress: true,
  // SKIP_STANDALONE is local Windows only. CI/Docker must always emit standalone.
  output: process.env.SKIP_STANDALONE === "1" && !process.env.CI ? undefined : "standalone",
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["heic-convert", "libheif-js"],
  },
};

export default nextConfig;
