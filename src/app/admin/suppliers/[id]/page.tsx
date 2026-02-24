/**
 * 供应商详情页面 — Server Component
 *
 * 展示单个供应商的完整信息：基本信息、关联楼宇列表、合同信息。
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import type {
  BuildingInfo,
  ContractInfo,
  SupplierDetail,
} from "./supplier-detail-config";
import {
  CONTRACT_STATUS_LABELS,
  SUPPLIER_STATUS_CONFIG,
  formatDate,
} from "./supplier-detail-config";

async function getSupplierDetail(id: string) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: supplier, error: supplierError } = await supabaseAdmin
    .from("suppliers")
    .select("id, company_name, contact_email, role, status, created_at")
    .eq("id", id)
    .single();

  if (supplierError || !supplier) {
    return null;
  }

  const [{ data: buildings }, { data: contracts }] = await Promise.all([
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
  ]);

  return {
    supplier: supplier as SupplierDetail,
    buildings: (buildings ?? []) as BuildingInfo[],
    contracts: (contracts ?? []) as ContractInfo[],
  };
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSupplierDetail(id);

  if (!data) {
    notFound();
  }

  const { supplier, buildings, contracts } = data;
  const statusConfig = SUPPLIER_STATUS_CONFIG[supplier.status] ?? {
    label: supplier.status,
    className:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
  };

  return (
    <div>
      {/* 返回链接 */}
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
            <dt className="text-[var(--color-text-muted)]">Role</dt>
            <dd className="text-[var(--color-text-primary)]">
              {supplier.role}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)]">Created</dt>
            <dd className="text-[var(--color-text-primary)]">
              {formatDate(supplier.created_at)}
            </dd>
          </div>
        </dl>
      </div>

      {/* 关联楼宇 */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Buildings ({buildings.length})
        </h2>
        {buildings.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)]">
            No buildings associated with this supplier
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Address</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {buildings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                      {b.building_name}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {b.building_address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {b.onboarding_status ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {b.score != null ? `${b.score} pts` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 合同信息 */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Contracts ({contracts.length})
        </h2>
        {contracts.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)]">
            No contracts yet
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const statusInfo = CONTRACT_STATUS_LABELS[c.status] ?? {
                    label: c.status,
                    className:
                      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
                  };
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-[var(--color-border)]"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {c.status === "DRAFT" && (
                          <Link
                            href={`/admin/contracts/${c.id}/edit`}
                            className="text-[var(--color-primary)] hover:underline"
                          >
                            Edit Contract
                          </Link>
                        )}
                        {c.status === "SIGNED" && c.document_url && (
                          <a
                            href={c.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--color-primary)] hover:underline"
                          >
                            Download Signed Contract
                          </a>
                        )}
                        {c.status !== "DRAFT" &&
                          !(c.status === "SIGNED" && c.document_url) &&
                          "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">
                        {formatDate(c.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
