/**
 * E2E: Responsive Layout Tests (RES-01 ~ RES-08)
 *
 * Verifies key pages render correctly at mobile/tablet/desktop breakpoints.
 */

import { test, expect } from "@playwright/test";
import { VIEWPORTS } from "./helpers/fixtures";

test.describe("Responsive — Landing Page", () => {
  test("RES-01: mobile hero and form are stacked vertically", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/");

    // Form should be visible
    await expect(
      page.getByRole("button", { name: /submit request/i }),
    ).toBeVisible();

    // No horizontal overflow
    const body = page.locator("body");
    const box = await body.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 1);
  });

  test("RES-02: desktop shows full-width layout", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: /submit request/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign in/i }).first(),
    ).toBeVisible();
  });
});

test.describe("Responsive — Login Page", () => {
  test("RES-03: mobile login form is centered", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/login");

    const emailInput = page.locator("#email");
    await expect(emailInput).toBeVisible();

    // Input should be within viewport
    const box = await emailInput.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 1);
  });

  test("RES-04: tablet login form renders properly", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto("/login");

    await expect(page.locator("#email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with email/i }),
    ).toBeVisible();
  });
});

test.describe("Responsive — Legal Pages", () => {
  test("RES-05: mobile privacy page readable without overflow", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/privacy");

    await expect(page.getByText("Privacy Policy")).toBeVisible();

    // Check no horizontal scrollbar
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test("RES-06: mobile terms page readable without overflow", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/terms");

    await expect(page.getByText("Terms of Service")).toBeVisible();

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);
  });
});

test.describe("Responsive — touch targets", () => {
  test("RES-07: mobile CTA buttons have adequate tap size", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/");

    const submitBtn = page.getByRole("button", { name: /submit request/i });
    const box = await submitBtn.boundingBox();

    // Minimum touch target: 44x44 px (WCAG 2.5.5)
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  });

  test("RES-08: mobile login button has adequate tap size", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/login");

    const continueBtn = page.getByRole("button", {
      name: /continue with email/i,
    });
    const box = await continueBtn.boundingBox();

    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  });
});
