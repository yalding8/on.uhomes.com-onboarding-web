"use client";

/**
 * 供应商列表 — Client Component
 *
 * 状态筛选 + 行点击导航到详情页。
 * 渲染逻辑委托给 SupplierTable。
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { SupplierRow } from "@/app/admin/suppliers/page";
import { SupplierTable } from "./SupplierTable";

export type SupplierStatusFilter = SupplierRow["status"] | "ALL";

interface SupplierListProps {
  suppliers: SupplierRow[];
  isAdmin?: boolean;
}

const FILTER_OPTIONS: { value: SupplierStatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "PENDING_CONTRACT", label: "Pending Contract" },
  { value: "SIGNED", label: "Signed" },
];

/** 计算各状态的供应商数量 */
export function getStatusCounts(
  suppliers: SupplierRow[],
): Record<SupplierStatusFilter, number> {
  const counts: Record<SupplierStatusFilter, number> = {
    ALL: suppliers.length,
    NEW: 0,
    PENDING_CONTRACT: 0,
    SIGNED: 0,
  };
  for (const s of suppliers) {
    counts[s.status]++;
  }
  return counts;
}

/** 按状态筛选供应商列表 */
export function filterSuppliers(
  suppliers: SupplierRow[],
  filter: SupplierStatusFilter,
): SupplierRow[] {
  if (filter === "ALL") return suppliers;
  return suppliers.filter((s) => s.status === filter);
}

export function SupplierList({
  suppliers,
  isAdmin = false,
}: SupplierListProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<SupplierStatusFilter>("ALL");

  const counts = useMemo(() => getStatusCounts(suppliers), [suppliers]);
  const filtered = useMemo(
    () => filterSuppliers(suppliers, activeFilter),
    [suppliers, activeFilter],
  );

  const handleRowClick = (supplier: SupplierRow) => {
    router.push(`/admin/suppliers/${supplier.id}`);
  };

  return (
    <>
      {/* 状态筛选栏 */}
      <div
        className="flex flex-wrap gap-2 mb-4"
        role="tablist"
        aria-label="Filter by status"
      >
        {FILTER_OPTIONS.map(({ value, label }) => {
          const isActive = activeFilter === value;
          return (
            <button
              key={value}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
              }`}
            >
              {label}
              <span className="ms-1.5 text-xs opacity-80">{counts[value]}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          No suppliers found for this status
        </div>
      ) : (
        <SupplierTable
          suppliers={filtered}
          onRowClick={handleRowClick}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
