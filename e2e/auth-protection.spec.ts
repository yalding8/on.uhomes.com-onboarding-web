/**
 * E2E: Auth Protection — 未登录保护 (AUTH-01 ~ AUTH-04)
 *
 * 验证未登录用户访问受保护页面时被正确重定向。
 */

import { test, expect } from "@playwright/test";

test.describe("Auth Protection — unauthenticated redirects", () => {
  // AUTH-01: Dashboard 未登录
  test("AUTH-01: /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  // AUTH-02: Onboarding 未登录
  test("AUTH-02: /onboarding/xxx redirects to /login", async ({ page }) => {
    await page.goto("/onboarding/some-building-id");
    await expect(page).toHaveURL(/\/login/);
  });

  // AUTH-03: Admin 未登录
  test("AUTH-03: /admin/suppliers redirects to /login", async ({ page }) => {
    await page.goto("/admin/suppliers");
    await expect(page).toHaveURL(/\/login/);
  });

  // AUTH-04: API 未登录
  test("AUTH-04: POST /api/admin/assign-bd returns 401", async ({
    request,
  }) => {
    const response = await request.post("/api/admin/assign-bd", {
      data: { supplier_id: "test", bd_id: "test" },
    });
    expect(response.status()).toBe(401);
  });
});
