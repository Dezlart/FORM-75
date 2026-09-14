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
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Public assets retain their filenames when regenerated, so use a short
      // fresh lifetime with revalidation instead of an immutable year-long cache.
      ...["/images/:path*", "/audio/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
    ];
  },
  // `next dev --hostname 0.0.0.0` is opened through the adapter address on
  // phones. Next otherwise rejects its own client chunks as cross-origin.
  allowedDevOrigins: [...new Set(["127.0.0.1", ...lanDevOrigins])],
};

export default nextConfig;
