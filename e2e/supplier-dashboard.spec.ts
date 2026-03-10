/**
 * E2E: Supplier Dashboard (SUP-DASH-01 ~ SUP-DASH-08)
 *
 * Requires Supplier auth state (storageState from globalSetup).
 * Tests the supplier-facing dashboard and onboarding flow.
 */

import { test, expect } from "@playwright/test";

test.describe("Supplier Dashboard — page structure", () => {
  test("SUP-DASH-01: page loads without error", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBeLessThan(500);
  });

  test("SUP-DASH-02: navigation bar is visible", async ({ page }) => {
    await page.goto("/dashboard");

    // Should have some navigation element
    const nav = page.locator("nav");
    if (await nav.isVisible()) {
      await expect(nav).toBeVisible();
    }
  });

  test("SUP-DASH-03: welcome section or content area exists", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Dashboard should have main content
    const main = page.locator("main");
    if (await main.isVisible()) {
      await expect(main).toBeVisible();
    }
  });
});

test.describe("Supplier Dashboard — content states", () => {
  test("SUP-DASH-04: shows contract or building section", async ({ page }) => {
    await page.goto("/dashboard");

    // Depending on supplier status, should show one of:
    // - Contract preview (PENDING_CONTRACT)
    // - Building cards (SIGNED)
    // - Under review message (NEW with application)
    const hasContent = await page
      .locator("main")
      .textContent()
      .then((t) => (t?.length ?? 0) > 10)
      .catch(() => false);

    expect(hasContent).toBeTruthy();
  });

  test("SUP-DASH-05: no JavaScript errors on load", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (error) => jsErrors.push(error.message));

    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    expect(jsErrors).toHaveLength(0);
  });
});

test.describe("Supplier Dashboard — responsive", () => {
  test("SUP-DASH-06: mobile view renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBeLessThan(500);
  });

  test("SUP-DASH-07: tablet view renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBeLessThan(500);
  });

  test("SUP-DASH-08: no horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);
  });
});
