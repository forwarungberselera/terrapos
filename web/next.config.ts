import path from "node:path";
import type { NextConfig } from "next";

const isExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Server mode untuk VPS, export mode untuk APK build
  ...(isExport ? { output: "export" } : {}),
};

export default nextConfig;
