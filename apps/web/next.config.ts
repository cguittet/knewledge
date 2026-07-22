import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@knewledge/contracts", "@knewledge/core"],
  experimental: { optimizePackageImports: ["lucide-react"] },
};

export default nextConfig;

