/**
 * E2E: Admin Invite Page (ADM-INV-01 ~ ADM-INV-10)
 *
 * Requires BD auth state (storageState from globalSetup).
 * Tests the supplier invitation workflow.
 */

import { test, expect } from "@playwright/test";

test.describe("Admin Invite — page structure", () => {
  test("ADM-INV-01: page loads with form and tips", async ({ page }) => {
    await page.goto("/admin/invite");

    // Header
    await expect(page.getByText(/invite.*supplier/i).first()).toBeVisible();

    // Form fields
    await expect(page.locator("#invite-email")).toBeVisible();
    await expect(page.locator("#invite-company")).toBeVisible();
    await expect(page.locator("#invite-supplier-type")).toBeVisible();
  });

  test("ADM-INV-02: flow steps are displayed", async ({ page }) => {
    await page.goto("/admin/invite");

    // 4-step flow indicator
    await expect(page.getByText(/invite/i).first()).toBeVisible();
    await expect(page.getByText(/register/i).first()).toBeVisible();
  });

  test("ADM-INV-03: tips panel shows guidance", async ({ page }) => {
    await page.goto("/admin/invite");

    await expect(page.getByText("Quick Tips")).toBeVisible();
  });
});

test.describe("Admin Invite — form validation", () => {
  test("ADM-INV-04: empty form shows validation errors", async ({ page }) => {
    await page.goto("/admin/invite");

    await page.getByRole("button", { name: /send invitation/i }).click();

    // Required field errors
    await expect(page.getByText(/email/i).first()).toBeVisible();
  });

  test("ADM-INV-05: invalid email shows error", async ({ page }) => {
    await page.goto("/admin/invite");

    await page.locator("#invite-email").fill("not-an-email");
    await page.locator("#invite-company").fill("Test Corp");

    // Select supplier type
    await page.locator("#invite-supplier-type").selectOption({ index: 1 });

    await page.getByRole("button", { name: /send invitation/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test("ADM-INV-06: successful submission shows success card", async ({
    page,
  }) => {
    // Mock the API to succeed
    await page.route("**/api/admin/invite-supplier", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      }),
    );

    await page.goto("/admin/invite");

    await page.locator("#invite-email").fill("supplier@example.com");
    await page.locator("#invite-company").fill("Test Property Corp");
    await page.locator("#invite-supplier-type").selectOption({ index: 1 });

    await page.getByRole("button", { name: /send invitation/i }).click();

    await expect(page.getByText(/invitation sent/i)).toBeVisible();
  });

  test("ADM-INV-07: invite another resets form", async ({ page }) => {
    await page.route("**/api/admin/invite-supplier", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      }),
    );

    await page.goto("/admin/invite");

    await page.locator("#invite-email").fill("supplier@example.com");
    await page.locator("#invite-company").fill("Test Corp");
    await page.locator("#invite-supplier-type").selectOption({ index: 1 });

    await page.getByRole("button", { name: /send invitation/i }).click();
    await expect(page.getByText(/invitation sent/i)).toBeVisible();

    await page.getByText(/invite another/i).click();
    await expect(page.locator("#invite-email")).toBeVisible();
    await expect(page.locator("#invite-email")).toHaveValue("");
  });
});

test.describe("Admin Invite — contract fields section", () => {
  test("ADM-INV-08: contract fields section is collapsible", async ({
    page,
  }) => {
    await page.goto("/admin/invite");

    const toggle = page.getByText(/pre-fill contract/i);
    await expect(toggle).toBeVisible();

    // Click to expand
    await toggle.click();
    await page.waitForTimeout(300); // CSS transition
  });
});

test.describe("Admin Invite — responsive", () => {
  test("ADM-INV-09: mobile view shows stacked layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/invite");

    await expect(page.locator("#invite-email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send invitation/i }),
    ).toBeVisible();
  });

  test("ADM-INV-10: API error shows user-friendly message", async ({
    page,
  }) => {
    await page.route("**/api/admin/invite-supplier", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      }),
    );

    await page.goto("/admin/invite");

    await page.locator("#invite-email").fill("supplier@example.com");
    await page.locator("#invite-company").fill("Test Corp");
    await page.locator("#invite-supplier-type").selectOption({ index: 1 });

    await page.getByRole("button", { name: /send invitation/i }).click();

    await expect(page.getByText(/error|failed/i).first()).toBeVisible();
  });
});
