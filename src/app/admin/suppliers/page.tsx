/**
 * 供应商列表页面 — Server Component
 *
 * Admin: 查询所有供应商。BD: 只查询自己被分配的供应商。
 *
 * Requirements: 5.1, 5.2, 5.4
 */

import { redirect } from "next/navigation";
import { SupplierList } from "@/components/admin/SupplierList";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin as checkAdmin } from "@/lib/admin/permissions";

export interface SupplierRow {
  id: string;
  company_name: string;
  contact_email: string;
  status: "NEW" | "PENDING_CONTRACT" | "SIGNED";
  building_count: number;
  created_at: string;
  bd_display_name?: string;
}

async function getPageContext() {
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

async function getSuppliers(
  isAdmin: boolean,
  bdSupplierId: string,
): Promise<SupplierRow[]> {
  const supabaseAdmin = createAdminClient();

  let query = supabaseAdmin
    .from("suppliers")
    .select("id, company_name, contact_email, status, created_at, bd_user_id")
    .eq("role", "supplier")
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.eq("bd_user_id", bdSupplierId);
  }

  const { data: suppliers, error: suppliersError } = await query;
  if (suppliersError) {
    throw new Error(`Failed to fetch suppliers: ${suppliersError.message}`);
  }
  if (!suppliers || suppliers.length === 0) return [];

  // Building count
  const supplierIds = suppliers.map((s) => s.id);
  const { data: buildings } = await supabaseAdmin
    .from("buildings")
    .select("supplier_id")
    .in("supplier_id", supplierIds);
  const countMap = new Map<string, number>();
  buildings?.forEach((b) => {
    countMap.set(b.supplier_id, (countMap.get(b.supplier_id) || 0) + 1);
  });

  // BD names for admin view
  const bdNameMap = new Map<string, string>();
  if (isAdmin) {
    const bdIds = [
      ...new Set(suppliers.map((s) => s.bd_user_id).filter(Boolean)),
    ] as string[];
    if (bdIds.length > 0) {
      const { data: bds } = await supabaseAdmin
        .from("suppliers")
        .select("id, company_name")
        .in("id", bdIds);
      bds?.forEach((b) => bdNameMap.set(b.id, b.company_name));
    }
  }

  return suppliers.map((s) => ({
    id: s.id,
    company_name: s.company_name,
    contact_email: s.contact_email,
    status: s.status,
    building_count: countMap.get(s.id) || 0,
    created_at: s.created_at,
    bd_display_name: s.bd_user_id ? bdNameMap.get(s.bd_user_id) : undefined,
  })) as SupplierRow[];
}

export default async function SuppliersPage() {
  const ctx = await getPageContext();
  if (!ctx) redirect("/login");

  const suppliers = await getSuppliers(ctx.isAdmin, ctx.bdSupplierId);
  const title = ctx.isAdmin ? "Suppliers" : "My Suppliers";

  return (
    <div>
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
        {title}
      </h1>
      {suppliers.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          {ctx.isAdmin
            ? "No suppliers yet"
            : "No suppliers assigned to you yet"}
        </div>
      ) : (
        <SupplierList suppliers={suppliers} isAdmin={ctx.isAdmin} />
      )}
    </div>
  );
}
