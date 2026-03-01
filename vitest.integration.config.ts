import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
  test: {
    root,
    environment: "node",
    globals: true,
    testTimeout: 45_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    include: ["tests/integration/agents/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    env: {
      INTEGRATION_BASE_URL: "http://localhost:3100",
    },
  },
});
