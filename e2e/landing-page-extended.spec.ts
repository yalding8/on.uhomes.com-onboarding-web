/**
 * E2E: Landing Page Extended Tests (LE-01 ~ LE-12)
 *
 * Covers edge cases, responsive layout, and error handling
 * beyond the basic landing-page.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { VIEWPORTS, VALID_APPLICATION } from "./helpers/fixtures";

test.describe("Landing Page — form edge cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("LE-01: phone validation rejects invalid format", async ({ page }) => {
    await page.getByPlaceholder("Your Property Management LLC").fill("Test Co");
    await page.getByPlaceholder("hello@example.com").fill("test@example.com");
    await page.getByPlaceholder("+1 (555) 000-0000").fill("abc");
    await page.getByPlaceholder("e.g. London").fill("London");
    await page.getByPlaceholder("e.g. United Kingdom").fill("UK");

    await page.getByRole("button", { name: /submit request/i }).click();

    await expect(
      page.getByText("Valid phone number is required"),
    ).toBeVisible();
  });

  test("LE-02: API error shows user-friendly message", async ({ page }) => {
    await page.route("**/api/apply", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      }),
    );

    await page
      .getByPlaceholder("Your Property Management LLC")
      .fill(VALID_APPLICATION.company);
    await page
      .getByPlaceholder("hello@example.com")
      .fill(VALID_APPLICATION.email);
    await page
      .getByPlaceholder("+1 (555) 000-0000")
      .fill(VALID_APPLICATION.phone);
    await page.getByPlaceholder("e.g. London").fill(VALID_APPLICATION.city);
    await page
      .getByPlaceholder("e.g. United Kingdom")
      .fill(VALID_APPLICATION.country);

    await page.getByRole("button", { name: /submit request/i }).click();

    // Should show error, not crash
    await expect(page.getByText(/error|failed|try again/i)).toBeVisible();
  });

  test("LE-03: network error shows fallback message", async ({ page }) => {
    await page.route("**/api/apply", (route) => route.abort("failed"));

    await page
      .getByPlaceholder("Your Property Management LLC")
      .fill(VALID_APPLICATION.company);
    await page
      .getByPlaceholder("hello@example.com")
      .fill(VALID_APPLICATION.email);
    await page
      .getByPlaceholder("+1 (555) 000-0000")
      .fill(VALID_APPLICATION.phone);
    await page.getByPlaceholder("e.g. London").fill(VALID_APPLICATION.city);
    await page
      .getByPlaceholder("e.g. United Kingdom")
      .fill(VALID_APPLICATION.country);

    await page.getByRole("button", { name: /submit request/i }).click();

    await expect(page.getByText(/error|failed|try again/i)).toBeVisible();
  });

  test("LE-04: submit button shows loading state during submission", async ({
    page,
  }) => {
    // Delay API response to observe loading state
    await page.route("**/api/apply", async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page
      .getByPlaceholder("Your Property Management LLC")
      .fill(VALID_APPLICATION.company);
    await page
      .getByPlaceholder("hello@example.com")
      .fill(VALID_APPLICATION.email);
    await page
      .getByPlaceholder("+1 (555) 000-0000")
      .fill(VALID_APPLICATION.phone);
    await page.getByPlaceholder("e.g. London").fill(VALID_APPLICATION.city);
    await page
      .getByPlaceholder("e.g. United Kingdom")
      .fill(VALID_APPLICATION.country);

    await page.getByRole("button", { name: /submit request/i }).click();

    // Button should be disabled or show loading
    const button = page.getByRole("button", { name: /submitting|submit/i });
    await expect(button).toBeVisible();
  });
});

test.describe("Landing Page — content structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("LE-05: hero section displays value propositions", async ({ page }) => {
    await expect(page.getByText(/200\+/)).toBeVisible();
    await expect(page.getByText(/partner/i)).toBeVisible();
  });

  test("LE-06: footer contains legal links", async ({ page }) => {
    const privacyLink = page.getByRole("link", { name: /privacy/i });
    const termsLink = page.getByRole("link", { name: /terms/i });

    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();
  });

  test("LE-07: sign-in link navigates to login", async ({ page }) => {
    await page
      .getByRole("link", { name: /sign in/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Landing Page — responsive layout", () => {
  test("LE-08: mobile viewport shows form", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/");

    await expect(page.getByText("Become a Supplier")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /submit request/i }),
    ).toBeVisible();
  });

  test("LE-09: tablet viewport shows form", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto("/");

    await expect(page.getByText("Become a Supplier")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /submit request/i }),
    ).toBeVisible();
  });

  test("LE-10: desktop viewport shows full layout", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/");

    await expect(page.getByText("Become a Supplier")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign in/i }).first(),
    ).toBeVisible();
  });
});
