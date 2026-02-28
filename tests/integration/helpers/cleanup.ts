/**
 * Cleanup helpers — delete all TEST_ prefixed data by RUN_ID or globally.
 * Deletion order respects FK constraints.
 */

import { createAdminClient } from "./admin-client";

export async function cleanupByPrefix(prefix: string): Promise<void> {
  const admin = createAdminClient();

  // 1. Find buildings by name prefix
  const { data: buildings } = await admin
    .from("buildings")
    .select("id")
    .like("building_name", `${prefix}%`);
  const buildingIds = (buildings ?? []).map((b) => b.id as string);

  if (buildingIds.length > 0) {
    await admin.from("extraction_jobs").delete().in("building_id", buildingIds);
    await admin
      .from("field_audit_logs")
      .delete()
      .in("building_id", buildingIds);
    await admin
      .from("building_onboarding_data")
      .delete()
      .in("building_id", buildingIds);
    await admin.from("buildings").delete().in("id", buildingIds);
  }

  // 2. Find suppliers by company_name prefix
  const { data: suppliers } = await admin
    .from("suppliers")
    .select("id, user_id")
    .like("company_name", `${prefix}%`);
  const supplierIds = (suppliers ?? []).map((s) => s.id as string);
  const userIds = (suppliers ?? [])
    .map((s) => s.user_id as string)
    .filter(Boolean);

  if (supplierIds.length > 0) {
    await admin.from("contracts").delete().in("supplier_id", supplierIds);
    await admin.from("suppliers").delete().in("id", supplierIds);
  }

  // 3. Delete auth users
  for (const uid of userIds) {
    await admin.auth.admin.deleteUser(uid);
  }

  // 4. Delete applications by company_name prefix
  await admin.from("applications").delete().like("company_name", `${prefix}%`);
}

export async function cleanupAllTestData(): Promise<void> {
  await cleanupByPrefix("TEST_");
}
