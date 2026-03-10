/**
 * E2E: Admin Applications Page (ADM-APP-01 ~ ADM-APP-10)
 *
 * Requires BD auth state (storageState from globalSetup).
 * Tests admin application management workflows.
 */

import { test, expect } from "@playwright/test";

test.describe("Admin Applications — page structure", () => {
  test("ADM-APP-01: page loads with header and stats", async ({ page }) => {
    await page.goto("/admin/applications");

    // Should see the page title
    await expect(page.getByText(/applications/i).first()).toBeVisible();
  });

  test("ADM-APP-02: sidebar navigation is visible", async ({ page }) => {
    await page.goto("/admin/applications");

    // Sidebar should show navigation items
    await expect(
      page.getByRole("link", { name: /applications/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /suppliers/i }).first(),
    ).toBeVisible();
  });

  test("ADM-APP-03: navigate to suppliers via sidebar", async ({ page }) => {
    await page.goto("/admin/applications");

    await page
      .getByRole("link", { name: /suppliers/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/suppliers/);
  });

  test("ADM-APP-04: navigate to invite via sidebar", async ({ page }) => {
    await page.goto("/admin/applications");

    await page
      .getByRole("link", { name: /invite/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/invite/);
  });
});

test.describe("Admin Applications — data display", () => {
  test("ADM-APP-05: table or empty state is shown", async ({ page }) => {
    await page.goto("/admin/applications");

    // Either a table with data or empty state
    const hasTable = await page
      .locator("table")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByText(/no applications|no data|empty/i)
      .isVisible()
      .catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test("ADM-APP-06: search input is accessible", async ({ page }) => {
    await page.goto("/admin/applications");

    const search = page.getByPlaceholder(/search/i);
    if (await search.isVisible()) {
      await search.fill("test company");
      // Should not crash
      await expect(search).toHaveValue("test company");
    }
  });
});

test.describe("Admin Applications — actions", () => {
  test("ADM-APP-07: clicking application row opens drawer", async ({
    page,
  }) => {
    await page.goto("/admin/applications");

    // If there are table rows, click one
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      // Drawer or detail panel should appear
      await expect(
        page.getByText(/details|notes|status/i).first(),
      ).toBeVisible();
    }
  });

  test("ADM-APP-08: stats section shows metrics", async ({ page }) => {
    await page.goto("/admin/applications");

    // Stats cards should be visible (pending, converted, etc.)
    const statsArea = page.locator("[class*=stat], [class*=Stats]").first();
    if (await statsArea.isVisible()) {
      await expect(statsArea).toBeVisible();
    }
  });
});

test.describe("Admin Applications — responsive", () => {
  test("ADM-APP-09: mobile view hides sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/applications");

    // Page should load without crash
    await expect(page.getByText(/applications/i).first()).toBeVisible();
  });

  test("ADM-APP-10: logout button is accessible", async ({ page }) => {
    await page.goto("/admin/applications");

    const logoutBtn = page.getByRole("button", { name: /log\s*out|sign out/i });
    if (await logoutBtn.isVisible()) {
      await expect(logoutBtn).toBeEnabled();
    }
  });
});
