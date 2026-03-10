/**
 * E2E: Extended Auth Protection (AUTH-05 ~ AUTH-14)
 *
 * Tests additional protected routes and edge cases beyond the basic
 * auth-protection.spec.ts file.
 */

import { test, expect } from "@playwright/test";

test.describe("Auth Protection — additional admin routes", () => {
  test("AUTH-05: /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTH-06: /admin/applications redirects to /login", async ({ page }) => {
    await page.goto("/admin/applications");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTH-07: /admin/invite redirects to /login", async ({ page }) => {
    await page.goto("/admin/invite");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTH-08: /admin/contracts/xxx/edit redirects to /login", async ({
    page,
  }) => {
    await page.goto("/admin/contracts/fake-id/edit");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTH-09: /admin/suppliers/xxx redirects to /login", async ({
    page,
  }) => {
    await page.goto("/admin/suppliers/fake-id");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Auth Protection — supplier routes", () => {
  test("AUTH-10: /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTH-11: /onboarding/building-123 redirects to /login", async ({
    page,
  }) => {
    await page.goto("/onboarding/building-123");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Auth Protection — public routes remain accessible", () => {
  test("AUTH-12: / (landing) loads without redirect", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Become a Supplier")).toBeVisible();
  });

  test("AUTH-13: /privacy loads without redirect", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Privacy Policy")).toBeVisible();
  });

  test("AUTH-14: /terms loads without redirect", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Terms of Service")).toBeVisible();
  });
});
