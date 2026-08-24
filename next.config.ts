import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const lanDevOrigins = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === "IPv4" && !address.internal)
  .map((address) => address.address);

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  devIndicators: false,
  // `next dev --hostname 0.0.0.0` is opened through the adapter address on
  // phones. Next otherwise rejects its own client chunks as cross-origin.
  allowedDevOrigins: [...new Set(["127.0.0.1", ...lanDevOrigins])],
};

export default nextConfig;
