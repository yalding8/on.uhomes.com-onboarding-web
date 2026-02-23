"use client";

/**
 * 供应商列表渲染组件 — Client Component
 *
 * 桌面端表格 + 移动端卡片，行可点击导航到详情页。
 * 从 SupplierList 拆分，保持 300 行限制。
 *
 * Requirements: 5.2, 5.4
 */

import type { SupplierRow } from "@/app/admin/suppliers/page";

interface SupplierTableProps {
  suppliers: SupplierRow[];
  onRowClick: (supplier: SupplierRow) => void;
}

const STATUS_CONFIG: Record<
  SupplierRow["status"],
  { label: string; className: string }
> = {
  NEW: {
    label: "新建",
    className:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
  },
  PENDING_CONTRACT: {
    label: "待签约",
    className:
      "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  },
  SIGNED: {
    label: "已签约",
    className:
      "bg-[var(--color-success-light)] text-[var(--color-success)]",
  },
};

function StatusBadge({ status }: { status: SupplierRow["status"] }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SupplierTable({ suppliers, onRowClick }: SupplierTableProps) {
  return (
    <>
      {/* 桌面端表格 — >=768px */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
              <th className="text-left px-4 py-3 font-medium">公司名称</th>
              <th className="text-left px-4 py-3 font-medium">联系邮箱</th>
              <th className="text-left px-4 py-3 font-medium">入驻状态</th>
              <th className="text-left px-4 py-3 font-medium">楼宇数量</th>
              <th className="text-left px-4 py-3 font-medium">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr
                key={s.id}
                onClick={() => onRowClick(s)}
                className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                  {s.company_name}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {s.contact_email}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {s.building_count}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">
                  {formatDate(s.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 移动端卡片 — <768px */}
      <div className="md:hidden flex flex-col gap-3">
        {suppliers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onRowClick(s)}
            className="w-full text-left rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[var(--color-text-primary)]">
                {s.company_name}
              </span>
              <StatusBadge status={s.status} />
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
              <p>{s.contact_email}</p>
              <p>楼宇：{s.building_count} 个</p>
              <p className="text-[var(--color-text-muted)] text-xs">
                {formatDate(s.created_at)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
