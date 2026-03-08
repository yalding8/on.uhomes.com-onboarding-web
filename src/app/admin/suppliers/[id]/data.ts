/**
 * Supplier detail page — server-side data fetching.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin as checkAdmin } from "@/lib/admin/permissions";
import type {
  BuildingInfo,
  ContractInfo,
  SupplierDetail,
} from "./supplier-detail-config";

export interface BdUser {
  id: string;
  company_name: string;
  contact_email: string;
}

export interface OnboardingRow {
  building_id: string;
  updated_at: string | null;
  field_values: Record<string, unknown> | null;
}

export interface PageContext {
  bdSupplierId: string;
  isAdmin: boolean;
}

export async function getPageContext(): Promise<PageContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("suppliers")
    .select("id, contact_email, role")
    .eq("user_id", user.id)
    .eq("role", "bd")
    .single();
  if (!me) return null;
  return { bdSupplierId: me.id, isAdmin: checkAdmin(me.contact_email) };
}

export async function checkBdAccess(
  id: string,
  bdSupplierId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("suppliers")
    .select("bd_user_id")
    .eq("id", id)
    .single();
  return target?.bd_user_id === bdSupplierId;
}

export async function fetchSupplierData(id: string, isAdmin: boolean) {
  const admin = createAdminClient();

  const { data: supplier, error } = await admin
    .from("suppliers")
    .select(
      "id, company_name, contact_email, contact_phone, city, country, role, status, created_at, bd_user_id",
    )
    .eq("id", id)
    .single();
  if (error || !supplier) return null;

  const buildingIds =
    (
      await admin.from("buildings").select("id").eq("supplier_id", id)
    ).data?.map((b) => b.id) ?? [];

  const [{ data: contract }, { data: buildings }, { data: obData }, bdUsers] =
    await Promise.all([
      admin
        .from("contracts")
        .select(
          "id, status, embedded_signing_url, document_url, provider_metadata, signed_at, created_at",
        )
        .eq("supplier_id", id)
        .neq("status", "CANCELED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("buildings")
        .select("id, building_name, building_address, onboarding_status, score")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false }),
      buildingIds.length > 0
        ? admin
            .from("building_onboarding_data")
            .select("building_id, updated_at, field_values")
            .in("building_id", buildingIds)
        : Promise.resolve({ data: [] as OnboardingRow[] }),
      isAdmin
        ? admin
            .from("suppliers")
            .select("id, company_name, contact_email")
            .eq("role", "bd")
            .order("company_name")
            .then((r) => (r.data ?? []) as BdUser[])
        : Promise.resolve([] as BdUser[]),
    ]);

  return {
    supplier: supplier as SupplierDetail,
    contract: (contract as ContractInfo) ?? null,
    buildings: (buildings ?? []) as BuildingInfo[],
    onboardingData: (obData ?? []) as OnboardingRow[],
    bdUsers,
  };
}

export function countFilledFields(
  fieldValues: Record<string, unknown> | null,
): number {
  if (!fieldValues) return 0;
  return Object.values(fieldValues).filter(
    (v) => v !== null && v !== undefined && v !== "",
  ).length;
}
