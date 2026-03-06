import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdf-parse"],
};

export default withSentryConfig(nextConfig, {
  // Suppress source map upload logs in CI
  silent: true,
  // Upload source maps to Sentry for better stack traces
  widenClientFileUpload: true,
  // Hide source maps from client bundles
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Disable Sentry webpack plugin when DSN is not set (dev/test)
  disableLogger: true,
});
