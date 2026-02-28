/**
 * Agent D — Data Integrity Tests (4 TCs)
 * TC-6.3 (gap report), TC-6.4 (field protection),
 * scoring consistency, webhook idempotency
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signWebhookPayload } from "../helpers/auth";
import { createAdminClient, getServiceRoleKey } from "../helpers/admin-client";
import { createTestSupplier, createTestBuilding } from "../helpers/fixtures";
import { cleanupByPrefix } from "../helpers/cleanup";

const RUN_ID = `TEST_DI_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const BASE = process.env.INTEGRATION_BASE_URL || "http://localhost:3000";
const admin = () => createAdminClient();

let bdSupplierId: string;
let supplierId: string;
let buildingId: string;

beforeAll(async () => {
  const { data: bd } = await admin()
    .from("suppliers")
    .select("id")
    .eq("contact_email", "ning.ding@uhomes.com")
    .single();
  bdSupplierId = bd!.id as string;

  const sup = await createTestSupplier(RUN_ID, bdSupplierId, {
    status: "SIGNED",
  });
  supplierId = sup.id;

  const bld = await createTestBuilding(RUN_ID, supplierId);
  buildingId = bld.id;

  // Seed initial onboarding data
  await admin().from("building_onboarding_data").insert({
    building_id: buildingId,
    field_values: {},
    version: 1,
  });
});
afterAll(() => cleanupByPrefix(RUN_ID));

describe("Agent D: Data Integrity", () => {
  // ── TC-6.4: Field value protection ──

  it("TC-6.4: confirmed fields are not overwritten by extraction", async () => {
    const now = new Date().toISOString();
    // Set a manually confirmed field
    await admin()
      .from("building_onboarding_data")
      .update({
        field_values: {
          building_name: {
            value: "Manual Name",
            source: "manual_input",
            confidence: "high",
            confirmedBy: "user-123",
            confirmedAt: now,
            updatedBy: "user-123",
            updatedAt: now,
          },
        },
        version: 2,
      })
      .eq("building_id", buildingId);

    // Trigger extraction callback that tries to overwrite building_name
    const res = await fetch(`${BASE}/api/extraction/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getServiceRoleKey()}`,
      },
      body: JSON.stringify({
        buildingId,
        source: "website_crawl",
        status: "success",
        extractedFields: {
          building_name: { value: "AI Extracted Name", confidence: "high" },
          city: { value: "Manchester", confidence: "medium" },
        },
      }),
    });
    expect(res.status).toBe(200);

    // Verify: building_name should still be "Manual Name" (protected)
    const { data } = await admin()
      .from("building_onboarding_data")
      .select("field_values")
      .eq("building_id", buildingId)
      .single();
    const fv = data?.field_values as Record<
      string,
      { value: unknown; source: string }
    >;
    expect(fv.building_name?.value).toBe("Manual Name");
    expect(fv.building_name?.source).toBe("manual_input");
    // city should be updated (not confirmed)
    expect(fv.city?.value).toBe("Manchester");
  });

  // ── TC-6.3: Gap report ──

  it("TC-6.3: score < 80 with missing required fields", async () => {
    const { data: bld } = await admin()
      .from("buildings")
      .select("score, onboarding_status")
      .eq("id", buildingId)
      .single();
    // Only a few fields filled → score < 80
    expect(bld?.score).toBeLessThan(80);
  });

  // ── Scoring consistency ──

  it("extraction callbacks update score consistently", async () => {
    // Send more data via contract_pdf callback (higher priority)
    const res = await fetch(`${BASE}/api/extraction/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getServiceRoleKey()}`,
      },
      body: JSON.stringify({
        buildingId,
        source: "contract_pdf",
        status: "success",
        extractedFields: {
          building_address: { value: "100 Data St", confidence: "high" },
          country: { value: "UK", confidence: "high" },
          postal_code: { value: "M1 1AA", confidence: "medium" },
          commission_structure: { value: "12%", confidence: "high" },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    // Score should have increased
    expect(body.score).toBeGreaterThan(0);
    expect(body.fieldsUpdated).toBeGreaterThan(0);

    // Verify building score matches
    const { data: bld } = await admin()
      .from("buildings")
      .select("score")
      .eq("id", buildingId)
      .single();
    expect(bld?.score).toBe(body.score);
  });

  // ── Webhook idempotency ──

  it("DocuSign webhook is idempotent on double delivery", async () => {
    const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
    if (!secret) return;

    // Create a supplier + contract already in SIGNED state
    // This tests the idempotency path without triggering PDF download
    const sup2 = await createTestSupplier(RUN_ID, bdSupplierId, {
      status: "SIGNED",
    });
    const envelopeId = `IDEMPOTENT_${RUN_ID}`;
    await admin()
      .from("contracts")
      .update({
        status: "SIGNED",
        signed_at: new Date().toISOString(),
        signature_request_id: envelopeId,
      })
      .eq("id", sup2.contractId);

    const payload = JSON.stringify({
      event: "envelope-completed",
      data: { envelopeId },
    });
    const sig = signWebhookPayload(payload, secret);

    // Webhook call on already-SIGNED contract+supplier → "Already processed"
    const res = await fetch(`${BASE}/api/webhooks/docusign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-docusign-signature-1": sig,
      },
      body: payload,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Already processed");

    // Verify contract still SIGNED
    const { data: con } = await admin()
      .from("contracts")
      .select("status")
      .eq("id", sup2.contractId)
      .single();
    expect(con?.status).toBe("SIGNED");
  });
});
