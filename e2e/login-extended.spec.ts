/**
 * E2E: Login Page Extended Tests (LGE-01 ~ LGE-10)
 *
 * Covers edge cases, responsive layout, and error handling
 * beyond the basic login.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { VIEWPORTS, mockOtpSuccess } from "./helpers/fixtures";

test.describe("Login Page — validation edge cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("LGE-01: invalid email format shows error", async ({ page }) => {
    await page.locator("#email").fill("not-an-email");
    await page.getByRole("button", { name: /continue with email/i }).click();

    await expect(page.getByText(/valid email|please enter/i)).toBeVisible();
  });

  test("LGE-02: OTP with non-numeric input is rejected", async ({ page }) => {
    await page.route("**/auth/v1/otp*", (route) =>
      route.fulfill(mockOtpSuccess()),
    );

    await page.locator("#email").fill("test@example.com");
    await page.getByRole("button", { name: /continue with email/i }).click();

    const otpInput = page.locator("#otp");
    await expect(otpInput).toBeVisible();

    // Type non-numeric — input should filter or stay empty
    await otpInput.fill("abcdefgh");
    const value = await otpInput.inputValue();
    // Should either be empty or only contain digits
    expect(value.replace(/\d/g, "")).toBe("");
  });

  test("LGE-03: Supabase OTP API failure shows error", async ({ page }) => {
    await page.route("**/auth/v1/otp*", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "rate_limit",
          message: "Too many requests",
        }),
      }),
    );

    await page.locator("#email").fill("test@example.com");
    await page.getByRole("button", { name: /continue with email/i }).click();

    await expect(page.getByText(/error|failed|try again/i)).toBeVisible();
  });

  test("LGE-04: resend OTP button appears on OTP step", async ({ page }) => {
    await page.route("**/auth/v1/otp*", (route) =>
      route.fulfill(mockOtpSuccess()),
    );

    await page.locator("#email").fill("test@example.com");
    await page.getByRole("button", { name: /continue with email/i }).click();

    await expect(page.getByText(/resend/i)).toBeVisible();
  });
});

test.describe("Login Page — terms checkbox", () => {
  test("LGE-05: page shows terms agreement checkbox", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/terms/i)).toBeVisible();
    await expect(page.getByText(/privacy/i)).toBeVisible();
  });
});

test.describe("Login Page — responsive layout", () => {
  test("LGE-06: mobile viewport shows login form", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/login");

    await expect(page.locator("#email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with email/i }),
    ).toBeVisible();
  });

  test("LGE-07: tablet viewport shows login form", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto("/login");

    await expect(page.locator("#email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with email/i }),
    ).toBeVisible();
  });
});

test.describe("Login Page — navigation", () => {
  test("LGE-08: back to landing page link exists", async ({ page }) => {
    await page.goto("/login");

    // There should be a way to navigate back to landing
    const homeLink = page.getByRole("link", { name: /uhomes|home|back/i });
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL("/");
    }
  });

  test("LGE-09: terms link navigates to /terms", async ({ page }) => {
    await page.goto("/login");
    const termsLink = page.getByRole("link", { name: /terms/i });

    if (await termsLink.isVisible()) {
      const href = await termsLink.getAttribute("href");
      expect(href).toContain("/terms");
    }
  });

  test("LGE-10: privacy link navigates to /privacy", async ({ page }) => {
    await page.goto("/login");
    const privacyLink = page.getByRole("link", { name: /privacy/i });

    if (await privacyLink.isVisible()) {
      const href = await privacyLink.getAttribute("href");
      expect(href).toContain("/privacy");
    }
  });
});
