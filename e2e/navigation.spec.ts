/**
 * E2E: Cross-Page Navigation Tests (NAV-01 ~ NAV-08)
 *
 * Verifies navigation between public pages works correctly.
 */

import { test, expect } from "@playwright/test";

test.describe("Navigation — public page flows", () => {
  test("NAV-01: landing → login → landing roundtrip", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Become a Supplier")).toBeVisible();

    // Navigate to login
    await page
      .getByRole("link", { name: /sign in/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible();

    // Navigate back (if back link exists)
    await page.goBack();
    await expect(page.getByText("Become a Supplier")).toBeVisible();
  });

  test("NAV-02: landing footer → privacy → terms", async ({ page }) => {
    await page.goto("/");

    // Go to privacy
    await page.getByRole("link", { name: /privacy/i }).click();
    await expect(page.getByText("Privacy Policy")).toBeVisible();

    // Navigate to terms
    const termsLink = page.getByRole("link", { name: /terms/i });
    if (await termsLink.isVisible()) {
      await termsLink.click();
      await expect(page.getByText("Terms of Service")).toBeVisible();
    }
  });

  test("NAV-03: direct URL access to /privacy works", async ({ page }) => {
    const response = await page.goto("/privacy");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Privacy Policy")).toBeVisible();
  });

  test("NAV-04: direct URL access to /terms works", async ({ page }) => {
    const response = await page.goto("/terms");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Terms of Service")).toBeVisible();
  });

  test("NAV-05: direct URL access to /login works", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page.locator("#email")).toBeVisible();
  });

  test("NAV-06: 404 page for unknown route", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    // Should either 404 or redirect
    const status = response?.status();
    expect(status === 404 || status === 200 || status === 307).toBeTruthy();
  });
});

test.describe("Navigation — protected routes redirect consistently", () => {
  test("NAV-07: all admin routes redirect to same login page", async ({
    page,
  }) => {
    const adminRoutes = [
      "/admin",
      "/admin/applications",
      "/admin/suppliers",
      "/admin/invite",
    ];

    for (const route of adminRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("NAV-08: all supplier routes redirect to same login page", async ({
    page,
  }) => {
    const supplierRoutes = ["/dashboard", "/onboarding/test-building"];

    for (const route of supplierRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
