import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  env: {
    VITE_API_MODE: process.env.VITE_API_MODE ?? "mock",
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? "/api",
  },
};

export default nextConfig;
