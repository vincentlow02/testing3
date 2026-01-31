import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Turbopack uses this project root, not a parent workspace
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
