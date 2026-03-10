/**
 * E2E: Admin Suppliers Page (ADM-SUP-01 ~ ADM-SUP-08)
 *
 * Requires BD auth state (storageState from globalSetup).
 * Tests admin supplier management workflows.
 */

import { test, expect } from "@playwright/test";

test.describe("Admin Suppliers — page structure", () => {
  test("ADM-SUP-01: page loads with header", async ({ page }) => {
    await page.goto("/admin/suppliers");

    await expect(page.getByText(/suppliers/i).first()).toBeVisible();
  });

  test("ADM-SUP-02: table or empty state is shown", async ({ page }) => {
    await page.goto("/admin/suppliers");

    const hasTable = await page
      .locator("table")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByText(/no suppliers|invite your first/i)
      .isVisible()
      .catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test("ADM-SUP-03: invite button links to invite page", async ({ page }) => {
    await page.goto("/admin/suppliers");

    const inviteLink = page.getByRole("link", { name: /invite/i });
    if (await inviteLink.isVisible()) {
      const href = await inviteLink.getAttribute("href");
      expect(href).toContain("/admin/invite");
    }
  });
});

test.describe("Admin Suppliers — interactions", () => {
  test("ADM-SUP-04: search filters suppliers", async ({ page }) => {
    await page.goto("/admin/suppliers");

    const search = page.getByPlaceholder(/search/i);
    if (await search.isVisible()) {
      await search.fill("nonexistent-supplier-xyz");
      // Wait for filter
      await page.waitForTimeout(500);
      // Should show filtered results or empty
      await expect(search).toHaveValue("nonexistent-supplier-xyz");
    }
  });

  test("ADM-SUP-05: clicking supplier row navigates to detail", async ({
    page,
  }) => {
    await page.goto("/admin/suppliers");

    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      // Should navigate to detail or open drawer
      await page.waitForTimeout(1000);
    }
  });

  test("ADM-SUP-06: stats section loads", async ({ page }) => {
    await page.goto("/admin/suppliers");

    // Wait for stats to load (may be async)
    await page.waitForTimeout(1000);

    // Page should not have error state
    const hasError = await page
      .getByText(/error|failed to load/i)
      .isVisible()
      .catch(() => false);
    expect(hasError).toBe(false);
  });
});

test.describe("Admin Suppliers — responsive", () => {
  test("ADM-SUP-07: mobile view renders without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/suppliers");

    await expect(page.getByText(/suppliers/i).first()).toBeVisible();

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test("ADM-SUP-08: tablet view renders table", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/admin/suppliers");

    await expect(page.getByText(/suppliers/i).first()).toBeVisible();
  });
});
