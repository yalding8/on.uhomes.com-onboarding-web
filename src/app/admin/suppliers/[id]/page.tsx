/**
 * 供应商详情页面 — Server Component
 *
 * 展示单个供应商的完整信息：基本信息、关联楼宇列表、合同信息。
 * Admin 可分配 BD，普通 BD 只能查看自己被分配的供应商。
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin as checkAdmin } from "@/lib/admin/permissions";
import Link from "next/link";
import type {
  BuildingInfo,
  ContractInfo,
  SupplierDetail,
} from "./supplier-detail-config";
import { SUPPLIER_STATUS_CONFIG, formatDate } from "./supplier-detail-config";
import { BdAssignSelect } from "@/components/admin/BdAssignSelect";
import { BuildingsSection, ContractsSection } from "./sections";

interface BdUser {
  id: string;
  company_name: string;
  contact_email: string;
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

async function getSupplierDetail(id: string, isAdmin: boolean) {
  const supabaseAdmin = createAdminClient();
  const { data: supplier, error: supplierError } = await supabaseAdmin
    .from("suppliers")
    .select(
      "id, company_name, contact_email, role, status, created_at, bd_user_id",
    )
    .eq("id", id)
    .single();
  if (supplierError || !supplier) return null;

  const [{ data: buildings }, { data: contracts }, bdUsers] = await Promise.all(
    [
      supabaseAdmin
        .from("buildings")
        .select("id, building_name, building_address, onboarding_status, score")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("contracts")
        .select("id, status, embedded_signing_url, document_url, created_at")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false }),
      isAdmin
        ? supabaseAdmin
            .from("suppliers")
            .select("id, company_name, contact_email")
            .eq("role", "bd")
            .order("company_name")
            .then((r) => (r.data ?? []) as BdUser[])
        : Promise.resolve([] as BdUser[]),
    ],
  );

  return {
    supplier: supplier as SupplierDetail,
    buildings: (buildings ?? []) as BuildingInfo[],
    contracts: (contracts ?? []) as ContractInfo[],
    bdUsers,
  };
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getPageContext();
  if (!ctx) redirect("/login");
  const { id } = await params;

  // BD scoping: non-admin BD can only view assigned suppliers
  if (!ctx.isAdmin) {
    const supabaseAdmin = createAdminClient();
    const { data: target } = await supabaseAdmin
      .from("suppliers")
      .select("bd_user_id")
      .eq("id", id)
      .single();
    if (target?.bd_user_id !== ctx.bdSupplierId) notFound();
  }

  const data = await getSupplierDetail(id, ctx.isAdmin);
  if (!data) notFound();

  const { supplier, buildings, contracts, bdUsers } = data;
  const statusConfig = SUPPLIER_STATUS_CONFIG[supplier.status] ?? {
    label: supplier.status,
    className:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
  };

  return (
    <div>
      <Link
        href="/admin/suppliers"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
      >
        ← Back to Suppliers
      </Link>

      {/* 基本信息 */}
      <div className="rounded-lg border border-[var(--color-border)] p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {supplier.company_name}
          </h1>
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusConfig.className}`}
          >
            {statusConfig.label}
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-[var(--color-text-muted)]">Email</dt>
            <dd className="text-[var(--color-text-primary)]">
              {supplier.contact_email}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)]">Created</dt>
            <dd className="text-[var(--color-text-primary)]">
              {formatDate(supplier.created_at)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--color-text-muted)] mb-1">Assigned BD</dt>
            <dd>
              {ctx.isAdmin ? (
                <BdAssignSelect
                  supplierId={supplier.id}
                  currentBdId={supplier.bd_user_id}
                  bdUsers={bdUsers}
                />
              ) : (
                <span className="text-[var(--color-text-primary)]">
                  {bdUsers.find((b) => b.id === supplier.bd_user_id)
                    ?.company_name ?? "—"}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* 关联楼宇 */}
      <BuildingsSection buildings={buildings} />

      {/* 合同信息 */}
      <ContractsSection contracts={contracts} />
    </div>
  );
}
