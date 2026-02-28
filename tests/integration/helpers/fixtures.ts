/**
 * Test data factory functions.
 * All data uses TEST_ prefix for easy cleanup.
 */

import { createAdminClient } from "./admin-client";
import type { ContractFields } from "@/lib/contracts/types";

const rand = () => Math.random().toString(36).slice(2, 8);

// ── Application ──

export interface TestApplication {
  id: string;
  company_name: string;
  contact_email: string;
}

export async function createTestApplication(
  runId: string,
  overrides?: Partial<Record<string, unknown>>,
): Promise<TestApplication> {
  const admin = createAdminClient();
  const suffix = rand();
  const companyName = `${runId}_Co_${suffix}`;
  const email = `test_apply_${suffix}@integration-test.uhomes.com`;

  const { data, error } = await admin
    .from("applications")
    .insert({
      company_name: companyName,
      contact_email: email,
      contact_phone: "+1234567890",
      city: "London",
      country: "UK",
      status: "PENDING",
      ...overrides,
    })
    .select("id, company_name, contact_email")
    .single();

  if (error || !data) {
    throw new Error(`createTestApplication failed: ${error?.message}`);
  }
  return data as TestApplication;
}

// ── Supplier + Auth User + Contract ──

export interface TestSupplier {
  id: string;
  userId: string;
  email: string;
  companyName: string;
  contractId: string;
}

export async function createTestSupplier(
  runId: string,
  _bdSupplierId: string,
  overrides?: { role?: string; status?: string },
): Promise<TestSupplier> {
  const admin = createAdminClient();
  const suffix = rand();
  const companyName = `${runId}_Supplier_${suffix}`;
  const email = `test_supplier_${suffix}@integration-test.uhomes.com`;

  // Create auth user (with retry for transient network errors)
  let authUser: { user: { id: string } | null } | null = null;
  let authErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (!result.error && result.data?.user) {
      authUser = result.data;
      authErr = null;
      break;
    }
    authErr = result.error;
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  if (authErr || !authUser?.user) {
    throw new Error(`createUser failed: ${authErr?.message}`);
  }

  // Create supplier
  const { data: supplier, error: supErr } = await admin
    .from("suppliers")
    .insert({
      user_id: authUser.user.id,
      company_name: companyName,
      contact_email: email,
      status: overrides?.status ?? "PENDING_CONTRACT",
      role: overrides?.role ?? "supplier",
    })
    .select("id")
    .single();

  if (supErr || !supplier) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(`createSupplier failed: ${supErr?.message}`);
  }

  // Create contract
  const { data: contract, error: conErr } = await admin
    .from("contracts")
    .insert({
      supplier_id: supplier.id,
      status: "DRAFT",
      signature_provider: "DOCUSIGN",
      contract_fields: {},
      provider_metadata: { type: "TEST", source: "integration_test" },
    })
    .select("id")
    .single();

  if (conErr || !contract) {
    throw new Error(`createContract failed: ${conErr?.message}`);
  }

  return {
    id: supplier.id as string,
    userId: authUser.user.id,
    email,
    companyName,
    contractId: contract.id as string,
  };
}

// ── Contract Fields (complete set) ──

export function completeContractFields(companyName: string): ContractFields {
  return {
    partner_company_name: companyName,
    partner_contact_name: "Test Contact",
    partner_address: "123 Test Street",
    partner_city: "London",
    partner_country: "United Kingdom",
    commission_rate: "15",
    contract_start_date: "2026-03-01",
    contract_end_date: "2027-02-28",
    covered_properties: "All student accommodations",
  };
}

// ── Building ──

export interface TestBuilding {
  id: string;
  building_name: string;
}

export async function createTestBuilding(
  runId: string,
  supplierId: string,
  overrides?: Partial<Record<string, unknown>>,
): Promise<TestBuilding> {
  const admin = createAdminClient();
  const suffix = rand();
  const buildingName = `${runId}_Building_${suffix}`;

  const { data, error } = await admin
    .from("buildings")
    .insert({
      building_name: buildingName,
      building_address: "123 Integration Test Street",
      supplier_id: supplierId,
      onboarding_status: "incomplete",
      score: 0,
      ...overrides,
    })
    .select("id, building_name")
    .single();

  if (error || !data) {
    throw new Error(`createTestBuilding failed: ${error?.message}`);
  }
  return data as TestBuilding;
}

// ── Fill All Required Fields ──

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/**
 * Fill all required onboarding fields for a building (for submission tests).
 */
export async function fillAllRequiredFields(
  adminClient: SupabaseAdmin,
  buildingId: string,
  runId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const mk = (v: unknown) => ({
    value: v,
    source: "manual_input",
    confidence: "high",
    confirmedBy: "test",
    confirmedAt: now,
    updatedBy: "test",
    updatedAt: now,
  });

  const fields = {
    building_name: mk(`${runId}_Building`),
    building_address: mk("123 Test St"),
    city: mk("London"),
    country: mk("UK"),
    postal_code: mk("SW1A 1AA"),
    commission_structure: mk("15%"),
    primary_contact_name: mk("Test Contact"),
    primary_contact_email: mk("test@test.com"),
    availability_method: mk(["Google Sheet"]),
    application_method: mk(["Online"]),
    cover_image: mk("https://example.com/img.jpg"),
    key_amenities: mk(["Gym", "WiFi"]),
    unit_types_summary: mk("Studio, 1BR"),
    price_min: mk(800),
    price_max: mk(1500),
    currency: mk("GBP"),
  };

  const { data: existing } = await adminClient
    .from("building_onboarding_data")
    .select("id")
    .eq("building_id", buildingId)
    .single();

  if (existing) {
    await adminClient
      .from("building_onboarding_data")
      .update({ field_values: fields, version: 99 })
      .eq("building_id", buildingId);
  } else {
    await adminClient.from("building_onboarding_data").insert({
      building_id: buildingId,
      field_values: fields,
      version: 1,
    });
  }
}
