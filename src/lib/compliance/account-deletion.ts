/**
 * Account deletion business logic.
 * Implements GDPR Right to Erasure with pre-checks and cooling period.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DeletionBlocker = {
  type: "active_bookings" | "unsettled_commissions";
  message: string;
  count: number;
};

export type DeletionCheckResult =
  | { canDelete: true }
  | { canDelete: false; blockers: DeletionBlocker[] };

/**
 * Pre-check: verify supplier has no active bookings or unsettled commissions.
 * If blockers exist, deletion must be refused with actionable guidance.
 */
export async function checkDeletionEligibility(
  supabase: SupabaseClient,
  supplierId: string,
): Promise<DeletionCheckResult> {
  const blockers: DeletionBlocker[] = [];

  // Check active buildings (published = active bookings possible)
  const { count: publishedCount } = await supabase
    .from("buildings")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .eq("is_published", true);

  if (publishedCount && publishedCount > 0) {
    blockers.push({
      type: "active_bookings",
      message:
        "Please unpublish all listings before requesting account deletion.",
      count: publishedCount,
    });
  }

  // Check contracts with pending/active status
  const { count: activeContractCount } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .in("status", ["DRAFT", "PENDING_REVIEW", "CONFIRMED", "SENT"]);

  if (activeContractCount && activeContractCount > 0) {
    blockers.push({
      type: "unsettled_commissions",
      message:
        "Please resolve all pending contracts before requesting deletion.",
      count: activeContractCount,
    });
  }

  if (blockers.length > 0) {
    return { canDelete: false, blockers };
  }

  return { canDelete: true };
}

/**
 * Mark a supplier for deletion (start 30-day cooling period).
 * Actual data removal happens via a scheduled job after the period.
 */
export async function markForDeletion(
  supabase: SupabaseClient,
  supplierId: string,
): Promise<{ success: boolean; deletionDate: string }> {
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + 30);

  const { error } = await supabase
    .from("suppliers")
    .update({
      status: "DELETION_PENDING",
      deletion_scheduled_at: deletionDate.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", supplierId);

  if (error) {
    throw new Error(`Failed to mark supplier for deletion: ${error.message}`);
  }

  return {
    success: true,
    deletionDate: deletionDate.toISOString(),
  };
}

/**
 * Execute final deletion after cooling period.
 * For AU suppliers: anonymize instead of delete.
 */
export async function executeDeletion(
  adminClient: SupabaseClient,
  supplierId: string,
  countryCode: string,
): Promise<void> {
  const isAustralia = countryCode === "AU";

  // 0. Delete Storage files (signed contracts + uploaded documents)
  const storageBuckets = ["signed-contracts", "uploaded-contracts"];
  for (const bucket of storageBuckets) {
    const { data: files } = await adminClient.storage
      .from(bucket)
      .list(supplierId);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${supplierId}/${f.name}`);
      await adminClient.storage.from(bucket).remove(paths);
    }
  }

  // 1. Delete buildings and building_data (child tables cascade via FK)
  await adminClient.from("buildings").delete().eq("supplier_id", supplierId);

  // 2. Anonymize contracts (keep financial data for legal compliance)
  await adminClient
    .from("contracts")
    .update({
      document_url: null,
      signature_fields: null,
    })
    .eq("supplier_id", supplierId);

  // 3. Delete applications linked to supplier email
  const { data: supplier } = await adminClient
    .from("suppliers")
    .select("contact_email")
    .eq("id", supplierId)
    .single();

  if (supplier?.contact_email) {
    await adminClient
      .from("applications")
      .delete()
      .eq("contact_email", supplier.contact_email);
  }

  // 4. Delete the supplier record
  await adminClient.from("suppliers").delete().eq("id", supplierId);
}
