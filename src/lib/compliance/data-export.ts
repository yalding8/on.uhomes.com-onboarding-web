/**
 * GDPR Data Portability — export all personal data for a supplier.
 * Generates a JSON package containing all data associated with the account.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type DataExportPackage = {
  exportedAt: string;
  supplier: Record<string, unknown> | null;
  buildings: Record<string, unknown>[];
  buildingOnboardingData: Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  applications: Record<string, unknown>[];
  fieldAuditLogs: Record<string, unknown>[];
  extractionJobs: Record<string, unknown>[];
};

/**
 * Collect all personal data for a supplier into a portable JSON package.
 * Uses admin client to ensure access to all tables regardless of RLS.
 */
export async function exportSupplierData(
  _supabase: unknown,
  supplierId: string,
  contactEmail: string,
): Promise<DataExportPackage> {
  const admin = createAdminClient();

  // Fetch supplier profile
  const { data: supplier } = await admin
    .from("suppliers")
    .select(
      "id, user_id, company_name, supplier_type, contact_email, status, role, created_at, updated_at",
    )
    .eq("id", supplierId)
    .single();

  // Fetch all buildings
  const { data: buildings } = await admin
    .from("buildings")
    .select(
      "id, name, address, onboarding_status, score, created_at, updated_at",
    )
    .eq("supplier_id", supplierId);

  const buildingIds = (buildings ?? []).map((b) => (b as { id: string }).id);

  // Fetch building onboarding data (via building IDs)
  let buildingOnboardingData: Record<string, unknown>[] = [];
  if (buildingIds.length > 0) {
    const { data } = await admin
      .from("building_onboarding_data")
      .select("building_id, field_values, version, created_at, updated_at")
      .in("building_id", buildingIds);
    buildingOnboardingData = (data ?? []) as Record<string, unknown>[];
  }

  // Fetch all contracts
  const { data: contracts } = await admin
    .from("contracts")
    .select(
      "id, status, contract_type, contract_fields, signed_at, created_at, updated_at",
    )
    .eq("supplier_id", supplierId);

  // Fetch applications by email
  const { data: applications } = await admin
    .from("applications")
    .select(
      "id, company_name, supplier_type, contact_email, contact_phone, country, status, created_at",
    )
    .eq("contact_email", contactEmail);

  // Fetch field audit logs (by user_id from supplier)
  let fieldAuditLogs: Record<string, unknown>[] = [];
  if (supplier) {
    const userId = (supplier as { user_id: string }).user_id;
    const { data } = await admin
      .from("field_audit_logs")
      .select(
        "id, building_id, field_key, old_value, new_value, user_id, created_at",
      )
      .eq("user_id", userId);
    fieldAuditLogs = (data ?? []) as Record<string, unknown>[];
  }

  // Fetch extraction jobs (via building IDs)
  let extractionJobs: Record<string, unknown>[] = [];
  if (buildingIds.length > 0) {
    const { data } = await admin
      .from("extraction_jobs")
      .select("id, building_id, status, created_at, completed_at")
      .in("building_id", buildingIds);
    extractionJobs = (data ?? []) as Record<string, unknown>[];
  }

  return {
    exportedAt: new Date().toISOString(),
    supplier: (supplier as Record<string, unknown>) ?? null,
    buildings: (buildings ?? []) as Record<string, unknown>[],
    buildingOnboardingData,
    contracts: (contracts ?? []) as Record<string, unknown>[],
    applications: (applications ?? []) as Record<string, unknown>[],
    fieldAuditLogs,
    extractionJobs,
  };
}
