/**
 * E2E: Login Page — OTP 登录流程 (LG-01 ~ LG-08)
 *
 * 使用 route mock 模拟 Supabase Auth OTP，不依赖真实邮件。
 */

import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  // LG-01: 页面加载
  test("LG-01: page loads with email input and continue button", async ({
    page,
  }) => {
    await expect(page.getByText("Welcome to uhomes")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with email/i }),
    ).toBeVisible();
  });

  // LG-02: 空邮箱提交
  test("LG-02: empty email shows error", async ({ page }) => {
    await page.getByRole("button", { name: /continue with email/i }).click();
    await expect(
      page.getByText("Please enter a valid email address"),
    ).toBeVisible();
  });

  // LG-03: 发送 OTP — mock supabase signInWithOtp
  test("LG-03: valid email transitions to OTP step", async ({ page }) => {
    // Mock supabase auth endpoint to succeed
    await page.route("**/auth/v1/otp*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );

    await page.locator("#email").fill("test@example.com");
    await page.getByRole("button", { name: /continue with email/i }).click();

    // Should switch to OTP step
    await expect(page.locator("#otp")).toBeVisible();
    await expect(page.getByText("test@example.com")).toBeVisible();
  });

  // LG-04: OTP 步骤展示
  test("LG-04: OTP step shows code input, login button and back link", async ({
    page,
  }) => {
    await page.route("**/auth/v1/otp*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.locator("#email").fill("test@example.com");
    await page.getByRole("button", { name: /continue with email/i }).click();

    await expect(page.locator("#otp")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /secure login/i }),
    ).toBeVisible();
    await expect(page.getByText("Use a different email address")).toBeVisible();
  });

  // LG-05: 返回邮箱步骤
  test("LG-05: back link returns to email step", async ({ page }) => {
    await page.route("**/auth/v1/otp*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.locator("#email").fill("test@example.com");
    await page.getByRole("button", { name: /continue with email/i }).click();
    await expect(page.locator("#otp")).toBeVisible();

    await page.getByText("Use a different email address").click();

    await expect(page.locator("#email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with email/i }),
    ).toBeVisible();
  });

  // LG-06: OTP 不足 8 位
  test("LG-06: login button disabled when OTP < 8 digits", async ({ page }) => {
    await page.route("**/auth/v1/otp*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.locator("#email").fill("test@example.com");
    await page.getByRole("button", { name: /continue with email/i }).click();

    await page.locator("#otp").fill("1234");

    await expect(
      page.getByRole("button", { name: /secure login/i }),
    ).toBeDisabled();
  });

  // LG-07: 错误 OTP
  test("LG-07: wrong OTP shows error message", async ({ page }) => {
    await page.route("**/auth/v1/otp*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.locator("#email").fill("test@example.com");
    await page.getByRole("button", { name: /continue with email/i }).click();

    // Mock verify to fail
    await page.route("**/auth/v1/token*", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Token has expired or is invalid",
        }),
      }),
    );

    await page.locator("#otp").fill("00000000");
    await page.getByRole("button", { name: /secure login/i }).click();

    await expect(page.getByText(/expired|invalid|failed/i)).toBeVisible();
  });

  // LG-08: 正确 OTP 登录
  test("LG-08: correct OTP shows Verified button", async ({ page }) => {
    await page.route("**/auth/v1/otp*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.locator("#email").fill("test@example.com");
    await page.getByRole("button", { name: /continue with email/i }).click();

    // Mock verify to succeed
    await page.route("**/auth/v1/token*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: { id: "test-user-id", email: "test@example.com" },
        }),
      }),
    );

    await page.locator("#otp").fill("12345678");
    await page.getByRole("button", { name: /secure login/i }).click();

    await expect(page.getByRole("button", { name: /verified/i })).toBeVisible();
  });
});
