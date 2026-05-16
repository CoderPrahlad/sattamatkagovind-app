import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Completely hide the Next.js development indicator (the floating "N" icon)
  devIndicators: false,
};

export default nextConfig;
