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

interface BuildingInfo {
  id: string;
  building_name: string;
  building_address: string | null;
  onboarding_status: string | null;
  score: number | null;
}

interface ContractInfo {
  id: string;
  status: string;
  embedded_signing_url: string | null;
  created_at: string;
}

interface SupplierDetail {
  id: string;
  company_name: string;
  contact_email: string;
  role: string;
  status: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NEW: {
    label: "新建",
    className: "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
  },
  PENDING_CONTRACT: {
    label: "待签约",
    className: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  },
  SIGNED: {
    label: "已签约",
    className: "bg-[var(--color-success-light)] text-[var(--color-success)]",
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
      .select("id, status, embedded_signing_url, created_at")
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
  const statusConfig = STATUS_CONFIG[supplier.status] ?? {
    label: supplier.status,
    className: "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
  };

  return (
    <div>
      {/* 返回链接 */}
      <Link
        href="/admin/suppliers"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
      >
        ← 返回供应商列表
      </Link>

      {/* 基本信息 */}
      <div className="rounded-lg border border-[var(--color-border)] p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {supplier.company_name}
          </h1>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-[var(--color-text-muted)]">联系邮箱</dt>
            <dd className="text-[var(--color-text-primary)]">{supplier.contact_email}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)]">角色</dt>
            <dd className="text-[var(--color-text-primary)]">{supplier.role}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)]">创建时间</dt>
            <dd className="text-[var(--color-text-primary)]">{formatDate(supplier.created_at)}</dd>
          </div>
        </dl>
      </div>

      {/* 关联楼宇 */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          关联楼宇（{buildings.length}）
        </h2>
        {buildings.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)]">
            该供应商暂无关联楼宇
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                  <th className="text-left px-4 py-3 font-medium">楼宇名称</th>
                  <th className="text-left px-4 py-3 font-medium">地址</th>
                  <th className="text-left px-4 py-3 font-medium">入驻状态</th>
                  <th className="text-left px-4 py-3 font-medium">评分</th>
                </tr>
              </thead>
              <tbody>
                {buildings.map((b) => (
                  <tr key={b.id} className="border-t border-[var(--color-border)]">
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
                      {b.score != null ? `${b.score}分` : "—"}
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
          合同信息（{contracts.length}）
        </h2>
        {contracts.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)]">
            暂无合同记录
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                  <th className="text-left px-4 py-3 font-medium">合同状态</th>
                  <th className="text-left px-4 py-3 font-medium">签署链接</th>
                  <th className="text-left px-4 py-3 font-medium">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      {c.status}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {c.embedded_signing_url ? (
                        <a
                          href={c.embedded_signing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          查看签署链接
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
