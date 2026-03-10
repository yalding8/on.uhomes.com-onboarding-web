/**
 * E2E: Legal Pages — Privacy Policy & Terms of Service (LP-01 ~ LP-06)
 *
 * Verifies legal pages render correctly and have proper structure.
 */

import { test, expect } from "@playwright/test";

test.describe("Privacy Policy Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/privacy");
  });

  test("LP-01: page loads with title and sections", async ({ page }) => {
    await expect(page.getByText("Privacy Policy")).toBeVisible();
    await expect(page.getByText("Data Controller")).toBeVisible();
    await expect(page.getByText("Your Rights")).toBeVisible();
  });

  test("LP-02: has navigation links to other legal pages", async ({ page }) => {
    const termsLink = page.getByRole("link", { name: /terms/i });
    await expect(termsLink).toBeVisible();
  });

  test("LP-03: contact information is visible", async ({ page }) => {
    await expect(page.getByText(/uhomes\.com/)).toBeVisible();
  });
});

test.describe("Terms of Service Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/terms");
  });

  test("LP-04: page loads with title and sections", async ({ page }) => {
    await expect(page.getByText("Terms of Service")).toBeVisible();
    await expect(page.getByText("Service Description")).toBeVisible();
    await expect(page.getByText("Governing Law")).toBeVisible();
  });

  test("LP-05: has navigation links to other legal pages", async ({ page }) => {
    const privacyLink = page.getByRole("link", { name: /privacy/i });
    await expect(privacyLink).toBeVisible();
  });

  test("LP-06: acceptance section exists", async ({ page }) => {
    await expect(page.getByText(/acceptance/i)).toBeVisible();
  });
});
