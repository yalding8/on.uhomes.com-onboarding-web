import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  globalSetup: "./e2e/helpers/auth-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Public tests — no auth needed
    {
      name: "public",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [
        "landing-page.spec.ts",
        "landing-page-extended.spec.ts",
        "login.spec.ts",
        "login-extended.spec.ts",
        "auth-protection.spec.ts",
        "auth-protection-extended.spec.ts",
        "legal-pages.spec.ts",
        "navigation.spec.ts",
        "responsive.spec.ts",
        "api-security.spec.ts",
        "webhook-security.spec.ts",
      ],
    },
    // Admin (BD) tests — requires @uhomes.com auth
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./e2e/.auth/bd.json",
      },
      testMatch: ["admin-*.spec.ts"],
      dependencies: ["public"],
    },
    // Supplier tests — requires supplier auth
    {
      name: "supplier",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./e2e/.auth/supplier.json",
      },
      testMatch: ["supplier-*.spec.ts"],
      dependencies: ["public"],
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
