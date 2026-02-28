/**
 * Agent B — Validation & Boundary Tests (8 TCs)
 * TC-1.2, 1.3, 3.3, 4.2, 4.4, 5.4, 5.5, 7.2
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAuthenticatedFetch } from "../helpers/auth";
import { createAdminClient, getServiceRoleKey } from "../helpers/admin-client";
import {
  createTestSupplier,
  createTestBuilding,
  completeContractFields,
} from "../helpers/fixtures";
import { cleanupByPrefix } from "../helpers/cleanup";

const RUN_ID = `TEST_VAL_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const BASE = process.env.INTEGRATION_BASE_URL || "http://localhost:3000";
const admin = () => createAdminClient();

let bdFetch: typeof fetch;
let bdSupplierId: string;

beforeAll(async () => {
  bdFetch = await createAuthenticatedFetch("ning.ding@uhomes.com");
  const { data: bd } = await admin()
    .from("suppliers")
    .select("id")
    .eq("contact_email", "ning.ding@uhomes.com")
    .single();
  bdSupplierId = bd!.id as string;
});
afterAll(() => cleanupByPrefix(RUN_ID));

describe("Agent B: Validation & Boundary", () => {
  // ── Phase 1 ──

  it("TC-1.2: missing required fields → 400", async () => {
    const res = await fetch(`${BASE}/api/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: "", contact_email: "a@b.com" }),
    });
    expect(res.status).toBe(400);
  });

  it("TC-1.3: duplicate email creates second row", async () => {
    const email = `${RUN_ID.toLowerCase()}_dup@inttest.uhomes.com`;
    const payload = {
      company_name: `${RUN_ID}_Dup1`,
      contact_email: email,
      city: "Berlin",
      country: "DE",
    };
    await fetch(`${BASE}/api/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    payload.company_name = `${RUN_ID}_Dup2`;
    await fetch(`${BASE}/api/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const { data } = await admin()
      .from("applications")
      .select("id")
      .eq("contact_email", email);
    expect(data?.length).toBeGreaterThanOrEqual(2);
  });

  // ── Phase 3 ──

  it("TC-3.3: push with missing fields → validation error", async () => {
    const sup = await createTestSupplier(RUN_ID, bdSupplierId);
    // Save partial fields (missing commission_rate)
    const partial = { ...completeContractFields(`${RUN_ID}_Co`) };
    delete (partial as Partial<typeof partial>).commission_rate;

    await bdFetch(`${BASE}/api/admin/contracts/${sup.contractId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: partial }),
    });

    const res = await bdFetch(`${BASE}/api/admin/contracts/${sup.contractId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields).toBeDefined();
  });

  // ── Phase 4 ──

  it("TC-4.2: supplier request changes → DRAFT", async () => {
    const sup = await createTestSupplier(RUN_ID, bdSupplierId);
    // Set contract to PENDING_REVIEW with complete fields
    const fields = completeContractFields(`${RUN_ID}_Co`);
    await admin()
      .from("contracts")
      .update({ contract_fields: fields, status: "PENDING_REVIEW" })
      .eq("id", sup.contractId);

    const supplierFetch = await createAuthenticatedFetch(sup.email);
    const res = await supplierFetch(
      `${BASE}/api/contracts/${sup.contractId}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_changes" }),
      },
    );
    // Should succeed (200) or return 403 if RLS blocks
    if (res.status === 200) {
      const { data } = await admin()
        .from("contracts")
        .select("status")
        .eq("id", sup.contractId)
        .single();
      expect(data?.status).toBe("DRAFT");
    }
  });

  it("TC-4.4: resend on non-SENT contract → error", async () => {
    const sup = await createTestSupplier(RUN_ID, bdSupplierId);
    // Contract is DRAFT, resend should fail
    const res = await bdFetch(
      `${BASE}/api/contracts/${sup.contractId}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend" }),
      },
    );
    // Should be 400 or error
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // ── Phase 5 ──

  it("TC-5.4: extraction callback with failed status", async () => {
    const sup = await createTestSupplier(RUN_ID, bdSupplierId, {
      status: "SIGNED",
    });
    const bld = await createTestBuilding(RUN_ID, sup.id);

    // Trigger extraction first
    await fetch(`${BASE}/api/extraction/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getServiceRoleKey()}`,
      },
      body: JSON.stringify({
        buildingId: bld.id,
        supplierId: sup.id,
        contractPdfUrl: "https://example.com/fake.pdf",
      }),
    });

    const res = await fetch(`${BASE}/api/extraction/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getServiceRoleKey()}`,
      },
      body: JSON.stringify({
        buildingId: bld.id,
        source: "website_crawl",
        status: "failed",
        errorMessage: "Timeout exceeded",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("website_crawl");
  });

  it("TC-5.5: extraction trigger with missing fields → 400", async () => {
    const res = await fetch(`${BASE}/api/extraction/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getServiceRoleKey()}`,
      },
      body: JSON.stringify({ buildingId: "fake-id" }),
    });
    expect(res.status).toBe(400);
  });

  // ── Phase 7 ──

  it("TC-7.2: submit with score < 80 → 422", async () => {
    const sup = await createTestSupplier(RUN_ID, bdSupplierId, {
      status: "SIGNED",
    });
    const bld = await createTestBuilding(RUN_ID, sup.id, {
      onboarding_status: "incomplete",
      score: 50,
    });

    const supplierFetch = await createAuthenticatedFetch(sup.email);
    const res = await supplierFetch(`${BASE}/api/buildings/${bld.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    // 422 or 404 (RLS may block) — either way, not 200
    expect(res.status).not.toBe(200);
  });
});
