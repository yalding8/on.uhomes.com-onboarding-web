/**
 * E2E: Landing Page — 表单提交 (L-01 ~ L-07)
 *
 * 公开页面，无需登录。
 */

import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // L-01: 页面加载
  test("L-01: page loads with hero, form and nav", async ({ page }) => {
    // Navigation bar with login link
    await expect(
      page.getByRole("link", { name: /supplier sign in/i }),
    ).toBeVisible();
    // Form heading
    await expect(page.getByText("Become a Supplier")).toBeVisible();
    // Submit button
    await expect(
      page.getByRole("button", { name: /submit request/i }),
    ).toBeVisible();
  });

  // L-02: 导航到登录
  test("L-02: Supplier Sign In link navigates to /login", async ({ page }) => {
    await page.getByRole("link", { name: /supplier sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  // L-03: 表单必填校验 — 直接提交空表单
  test("L-03: empty form submission shows validation errors", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /submit request/i }).click();

    // All required fields should show errors
    await expect(page.getByText("Company Name is required")).toBeVisible();
    await expect(page.getByText("Valid work email is required")).toBeVisible();
    await expect(
      page.getByText("Valid phone number is required"),
    ).toBeVisible();
    await expect(page.getByText("City is required")).toBeVisible();
    await expect(page.getByText("Country is required")).toBeVisible();
  });

  // L-04: 邮箱格式校验
  test("L-04: invalid email shows format error", async ({ page }) => {
    await page.getByPlaceholder("Your Property Management LLC").fill("Test Co");
    await page.getByPlaceholder("hello@example.com").fill("abc");
    await page.getByPlaceholder("+1 (555) 000-0000").fill("+1 555 1234");
    await page.getByPlaceholder("e.g. London").fill("London");
    await page.getByPlaceholder("e.g. United Kingdom").fill("UK");

    await page.getByRole("button", { name: /submit request/i }).click();

    await expect(page.getByText("Valid work email is required")).toBeVisible();
  });

  // L-05: 成功提交
  test("L-05: successful submission shows success card", async ({ page }) => {
    // Intercept API to avoid real DB write
    await page.route("**/api/apply", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Application submitted.",
        }),
      }),
    );

    await page
      .getByPlaceholder("Your Property Management LLC")
      .fill("Test Property LLC");
    await page.getByPlaceholder("hello@example.com").fill("test@example.com");
    await page.getByPlaceholder("+1 (555) 000-0000").fill("+1 555 1234");
    await page.getByPlaceholder("e.g. London").fill("London");
    await page.getByPlaceholder("e.g. United Kingdom").fill("United Kingdom");

    await page.getByRole("button", { name: /submit request/i }).click();

    await expect(page.getByText("Application Received!")).toBeVisible();
  });

  // L-06: 可选字段为空
  test("L-06: optional website_url can be empty", async ({ page }) => {
    await page.route("**/api/apply", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      }),
    );

    await page.getByPlaceholder("Your Property Management LLC").fill("Test Co");
    await page.getByPlaceholder("hello@example.com").fill("test@example.com");
    await page.getByPlaceholder("+1 (555) 000-0000").fill("+1 555 1234");
    await page.getByPlaceholder("e.g. London").fill("London");
    await page.getByPlaceholder("e.g. United Kingdom").fill("UK");
    // Leave website_url empty

    await page.getByRole("button", { name: /submit request/i }).click();

    await expect(page.getByText("Application Received!")).toBeVisible();
  });

  // L-07: 再次提交
  test("L-07: submit another application resets form", async ({ page }) => {
    await page.route("**/api/apply", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      }),
    );

    // Submit first
    await page.getByPlaceholder("Your Property Management LLC").fill("Test Co");
    await page.getByPlaceholder("hello@example.com").fill("test@example.com");
    await page.getByPlaceholder("+1 (555) 000-0000").fill("+1 555 1234");
    await page.getByPlaceholder("e.g. London").fill("London");
    await page.getByPlaceholder("e.g. United Kingdom").fill("UK");
    await page.getByRole("button", { name: /submit request/i }).click();
    await expect(page.getByText("Application Received!")).toBeVisible();

    // Click "Submit another application"
    await page.getByText("Submit another application").click();

    // Form should be visible again
    await expect(page.getByText("Become a Supplier")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /submit request/i }),
    ).toBeVisible();
  });
});
