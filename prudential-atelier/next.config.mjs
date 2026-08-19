/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },
  compress: true,
  // SKIP_STANDALONE is local Windows only. CI/Docker must always emit standalone.
  output: process.env.SKIP_STANDALONE === "1" && !process.env.CI ? undefined : "standalone",
};

export default nextConfig;
