/**
 * GDPR Data Portability — export all personal data for a supplier.
 * Generates a JSON package containing all data associated with the account.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type DataExportPackage = {
  exportedAt: string;
  authUser: Record<string, unknown> | null;
  supplier: Record<string, unknown> | null;
  buildings: Record<string, unknown>[];
  buildingOnboardingData: Record<string, unknown>[];
  buildingImages: Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  applications: Record<string, unknown>[];
  applicationNotes: Record<string, unknown>[];
  supplierNotes: Record<string, unknown>[];
  supplierBadges: Record<string, unknown>[];
  fieldAuditLogs: Record<string, unknown>[];
  extractionJobs: Record<string, unknown>[];
  extractionFeedback: Record<string, unknown>[];
  storageFiles: Record<string, string[]>;
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

  // Fetch auth user data (BUG-NEW-04 fix)
  let authUser: Record<string, unknown> | null = null;
  const { data: supplierForUid } = await admin
    .from("suppliers")
    .select("user_id")
    .eq("id", supplierId)
    .single();

  if (supplierForUid) {
    const { data: authData } = await admin.auth.admin.getUserById(
      (supplierForUid as { user_id: string }).user_id,
    );
    if (authData?.user) {
      const u = authData.user;
      authUser = {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
      };
    }
  }

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
  let buildingImages: Record<string, unknown>[] = [];
  if (buildingIds.length > 0) {
    const { data } = await admin
      .from("building_onboarding_data")
      .select("building_id, field_values, version, created_at, updated_at")
      .in("building_id", buildingIds);
    buildingOnboardingData = (data ?? []) as Record<string, unknown>[];

    // C-03 fix: export building images metadata
    const { data: imgData } = await admin
      .from("building_images")
      .select("id, building_id, url, category, created_at")
      .in("building_id", buildingIds);
    buildingImages = (imgData ?? []) as Record<string, unknown>[];
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

  // C-03 fix: export application notes
  const applicationIds = (applications ?? []).map(
    (a) => (a as { id: string }).id,
  );
  let applicationNotes: Record<string, unknown>[] = [];
  if (applicationIds.length > 0) {
    const { data: notesData } = await admin
      .from("application_notes")
      .select("id, application_id, content, author_id, created_at")
      .in("application_id", applicationIds);
    applicationNotes = (notesData ?? []) as Record<string, unknown>[];
  }

  // C-03 fix: export supplier notes
  let supplierNotes: Record<string, unknown>[] = [];
  const { data: sNotesData } = await admin
    .from("supplier_notes")
    .select("id, supplier_id, content, author_id, created_at")
    .eq("supplier_id", supplierId);
  supplierNotes = (sNotesData ?? []) as Record<string, unknown>[];

  // C-03 fix: export supplier badges
  let supplierBadges: Record<string, unknown>[] = [];
  const { data: badgesData } = await admin
    .from("supplier_badges")
    .select("id, supplier_id, badge_type, granted_at")
    .eq("supplier_id", supplierId);
  supplierBadges = (badgesData ?? []) as Record<string, unknown>[];

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

  // C-03 fix: export extraction feedback
  let extractionFeedback: Record<string, unknown>[] = [];
  if (buildingIds.length > 0) {
    const { data: fbData } = await admin
      .from("extraction_feedback")
      .select("id, building_id, field_key, feedback, created_at")
      .in("building_id", buildingIds);
    extractionFeedback = (fbData ?? []) as Record<string, unknown>[];
  }

  // Fetch storage file inventory (BUG-NEW-05 fix)
  const storageFiles: Record<string, string[]> = {};
  const storageBuckets = ["signed-contracts", "uploaded-contracts"];
  for (const bucket of storageBuckets) {
    const { data: files } = await admin.storage.from(bucket).list(supplierId);
    if (files && files.length > 0) {
      storageFiles[bucket] = files.map((f) => `${supplierId}/${f.name}`);
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    authUser,
    supplier: (supplier as Record<string, unknown>) ?? null,
    buildings: (buildings ?? []) as Record<string, unknown>[],
    buildingOnboardingData,
    buildingImages,
    contracts: (contracts ?? []) as Record<string, unknown>[],
    applications: (applications ?? []) as Record<string, unknown>[],
    applicationNotes,
    supplierNotes,
    supplierBadges,
    fieldAuditLogs,
    extractionJobs,
    extractionFeedback,
    storageFiles,
  };
}
