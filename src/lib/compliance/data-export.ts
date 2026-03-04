/**
 * GDPR Data Portability — export all personal data for a supplier.
 * Generates a JSON package containing all data associated with the account.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DataExportPackage = {
  exportedAt: string;
  supplier: Record<string, unknown> | null;
  buildings: Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  applications: Record<string, unknown>[];
};

/**
 * Collect all personal data for a supplier into a portable JSON package.
 */
export async function exportSupplierData(
  supabase: SupabaseClient,
  supplierId: string,
  contactEmail: string,
): Promise<DataExportPackage> {
  // Fetch supplier profile
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .single();

  // Fetch all buildings
  const { data: buildings } = await supabase
    .from("buildings")
    .select("*")
    .eq("supplier_id", supplierId);

  // Fetch all contracts
  const { data: contracts } = await supabase
    .from("contracts")
    .select("*")
    .eq("supplier_id", supplierId);

  // Fetch applications by email
  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("contact_email", contactEmail);

  return {
    exportedAt: new Date().toISOString(),
    supplier: supplier ?? null,
    buildings: buildings ?? [],
    contracts: contracts ?? [],
    applications: applications ?? [],
  };
}
