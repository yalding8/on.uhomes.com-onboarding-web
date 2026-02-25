/**
 * 供应商列表页面 — Server Component
 *
 * 使用 Supabase Admin Client 查询 suppliers 表（role='supplier'），
 * 聚合每个供应商关联的楼宇数量，按 created_at 倒序排列。
 *
 * Requirements: 5.1, 5.2, 5.4
 */

import { SupplierList } from "@/components/admin/SupplierList";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SupplierRow {
  id: string;
  company_name: string;
  contact_email: string;
  status: "NEW" | "PENDING_CONTRACT" | "SIGNED";
  building_count: number;
  created_at: string;
}

async function getSuppliers(): Promise<SupplierRow[]> {
  const supabaseAdmin = createAdminClient();

  // 步骤 1：查询所有 supplier 角色的供应商
  const { data: suppliers, error: suppliersError } = await supabaseAdmin
    .from("suppliers")
    .select("id, company_name, contact_email, status, created_at")
    .eq("role", "supplier")
    .order("created_at", { ascending: false });

  if (suppliersError) {
    throw new Error(`Failed to fetch suppliers: ${suppliersError.message}`);
  }

  if (!suppliers || suppliers.length === 0) {
    return [];
  }

  // 步骤 2：查询楼宇数量
  const supplierIds = suppliers.map((s) => s.id);
  const { data: buildings } = await supabaseAdmin
    .from("buildings")
    .select("supplier_id")
    .in("supplier_id", supplierIds);

  // 步骤 3：内存聚合楼宇计数
  const countMap = new Map<string, number>();
  buildings?.forEach((b) => {
    countMap.set(b.supplier_id, (countMap.get(b.supplier_id) || 0) + 1);
  });

  return suppliers.map((s) => ({
    ...s,
    building_count: countMap.get(s.id) || 0,
  })) as SupplierRow[];
}

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div>
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
        Suppliers
      </h1>

      {suppliers.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          No suppliers yet
        </div>
      ) : (
        <SupplierList suppliers={suppliers} />
      )}
    </div>
  );
}
