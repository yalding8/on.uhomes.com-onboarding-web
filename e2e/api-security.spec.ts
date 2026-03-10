/**
 * E2E: API Security Boundary Tests (SEC-01 ~ SEC-14)
 *
 * Verifies all protected API endpoints reject unauthenticated requests.
 * Uses Playwright request context (no browser needed).
 */

import { test, expect } from "@playwright/test";

test.describe("API Security — unauthenticated requests", () => {
  // --- Admin endpoints require BD role ---

  test("SEC-01: POST /api/admin/approve-supplier → 401", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/approve-supplier", {
      data: { application_id: "fake-id" },
    });
    expect(res.status()).toBe(401);
  });

  test("SEC-02: POST /api/admin/assign-bd → 401", async ({ request }) => {
    const res = await request.post("/api/admin/assign-bd", {
      data: { supplier_id: "fake", bd_id: "fake" },
    });
    expect(res.status()).toBe(401);
  });

  test("SEC-03: POST /api/admin/assign-application-bd → 401", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/assign-application-bd", {
      data: { application_id: "fake", bd_id: "fake" },
    });
    expect(res.status()).toBe(401);
  });

  test("SEC-04: POST /api/admin/invite-supplier → 401", async ({ request }) => {
    const res = await request.post("/api/admin/invite-supplier", {
      data: {
        email: "test@example.com",
        company_name: "Test",
        supplier_type: "PBSA",
      },
    });
    expect(res.status()).toBe(401);
  });

  test("SEC-05: POST /api/admin/generate-referral → 401", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/generate-referral", {
      data: { supplier_id: "fake" },
    });
    expect(res.status()).toBe(401);
  });

  test("SEC-06: GET /api/admin/applications/stats → 401", async ({
    request,
  }) => {
    const res = await request.get("/api/admin/applications/stats");
    expect(res.status()).toBe(401);
  });

  test("SEC-07: GET /api/admin/suppliers/stats → 401", async ({ request }) => {
    const res = await request.get("/api/admin/suppliers/stats");
    expect(res.status()).toBe(401);
  });

  test("SEC-08: POST /api/admin/applications/fake-id/claim → 401", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/applications/fake-id/claim");
    expect(res.status()).toBe(401);
  });

  test("SEC-09: GET /api/admin/suppliers/fake-id/notes → 401", async ({
    request,
  }) => {
    const res = await request.get("/api/admin/suppliers/fake-id/notes");
    expect(res.status()).toBe(401);
  });

  test("SEC-10: GET /api/admin/suppliers/fake-id/timeline → 401", async ({
    request,
  }) => {
    const res = await request.get("/api/admin/suppliers/fake-id/timeline");
    expect(res.status()).toBe(401);
  });

  // --- Contract endpoints ---

  test("SEC-11: GET /api/admin/contracts → 401", async ({ request }) => {
    const res = await request.get("/api/admin/contracts");
    expect(res.status()).toBe(401);
  });

  test("SEC-12: PATCH /api/admin/contracts/fake-id/status → 401", async ({
    request,
  }) => {
    const res = await request.patch("/api/admin/contracts/fake-id/status", {
      data: { status: "CONFIRMED" },
    });
    expect(res.status()).toBe(401);
  });

  // --- Account endpoints ---

  test("SEC-13: POST /api/account/delete → 401", async ({ request }) => {
    const res = await request.post("/api/account/delete");
    expect(res.status()).toBe(401);
  });

  test("SEC-14: GET /api/account/export → 401", async ({ request }) => {
    const res = await request.get("/api/account/export");
    expect(res.status()).toBe(401);
  });
});

test.describe("API Security — public endpoints accept valid requests", () => {
  test("SEC-15: POST /api/apply accepts valid payload", async ({ request }) => {
    // Mock: even without DB, should get past input validation
    const res = await request.post("/api/apply", {
      data: {
        company_name: "Test Corp",
        contact_email: "valid@example.com",
        contact_phone: "+1 555 1234",
        city: "London",
        country: "United Kingdom",
      },
    });
    // Should not be 401 — it's a public endpoint
    expect(res.status()).not.toBe(401);
  });
});
