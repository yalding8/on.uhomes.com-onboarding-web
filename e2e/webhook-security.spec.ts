/**
 * E2E: Webhook Security Tests (WH-01 ~ WH-04)
 *
 * Verifies webhook endpoints reject requests without valid signatures.
 */

import { test, expect } from "@playwright/test";

test.describe("Webhook Security — DocuSign", () => {
  test("WH-01: POST /api/webhooks/docusign without HMAC → rejected", async ({
    request,
  }) => {
    const res = await request.post("/api/webhooks/docusign", {
      data: { event: "envelope-completed", data: {} },
    });
    // Should reject: 401 or 400 (no valid signature)
    expect([400, 401, 403]).toContain(res.status());
  });

  test("WH-02: POST /api/webhooks/docusign with invalid HMAC → rejected", async ({
    request,
  }) => {
    const res = await request.post("/api/webhooks/docusign", {
      headers: {
        "x-docusign-signature-1": "invalid-signature-value",
      },
      data: { event: "envelope-completed", data: {} },
    });
    expect([400, 401, 403]).toContain(res.status());
  });
});

test.describe("Webhook Security — OpenSign", () => {
  test("WH-03: POST /api/webhooks/opensign with empty body → rejected", async ({
    request,
  }) => {
    const res = await request.post("/api/webhooks/opensign", {
      data: {},
    });
    // Should return error status (not 200)
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("Webhook Security — Extraction callback", () => {
  test("WH-04: POST /api/extraction/callback without auth → rejected", async ({
    request,
  }) => {
    const res = await request.post("/api/extraction/callback", {
      data: { job_id: "fake", result: {} },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
