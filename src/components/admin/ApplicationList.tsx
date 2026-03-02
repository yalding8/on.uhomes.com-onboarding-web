"use client";

/**
 * 申请列表 — Client Component
 *
 * 状态筛选 + 审批对话框集成。
 * 渲染逻辑委托给 ApplicationTable。
 */

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { ApplicationRow, BdOption } from "@/app/admin/applications/page";
import { ApplicationTable } from "./ApplicationTable";
import { ApproveDialog } from "./ApproveDialog";

export type StatusFilter = ApplicationRow["status"] | "ALL";

interface ApplicationListProps {
  applications: ApplicationRow[];
  bdUsers: BdOption[];
}

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONVERTED", label: "Converted" },
  { value: "REJECTED", label: "Rejected" },
];

/** 计算各状态的申请数量 */
export function getStatusCounts(
  applications: ApplicationRow[],
): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    ALL: applications.length,
    PENDING: 0,
    CONVERTED: 0,
    REJECTED: 0,
  };
  for (const app of applications) {
    counts[app.status]++;
  }
  return counts;
}

/** 按状态筛选申请列表 */
export function filterApplications(
  applications: ApplicationRow[],
  filter: StatusFilter,
): ApplicationRow[] {
  if (filter === "ALL") return applications;
  return applications.filter((app) => app.status === filter);
}

export function ApplicationList({
  applications,
  bdUsers,
}: ApplicationListProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("ALL");
  const [selectedApp, setSelectedApp] = useState<ApplicationRow | null>(null);

  const counts = useMemo(() => getStatusCounts(applications), [applications]);
  const filtered = useMemo(
    () => filterApplications(applications, activeFilter),
    [applications, activeFilter],
  );

  const handleApprove = useCallback((application: ApplicationRow) => {
    setSelectedApp(application);
  }, []);

  const handleConfirm = useCallback(
    async (contractType: string) => {
      if (!selectedApp) return;

      const response = await fetch("/api/admin/approve-supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: selectedApp.id,
          contract_type: contractType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Approval failed");
      }

      setSelectedApp(null);
      router.refresh();
    },
    [selectedApp, router],
  );

  const handleCancel = useCallback(() => {
    setSelectedApp(null);
  }, []);

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
        <div className="flex flex-col items-center py-12 px-6 text-center rounded-lg border border-[var(--color-border)]">
          <Search className="h-8 w-8 text-[var(--color-text-muted)] mb-3 opacity-60" />
          <p className="text-sm text-[var(--color-text-muted)]">
            No applications match this filter
          </p>
          <button
            onClick={() => setActiveFilter("ALL")}
            className="mt-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors"
          >
            Show all applications
          </button>
        </div>
      ) : (
        <ApplicationTable
          applications={filtered}
          onApprove={handleApprove}
          bdUsers={bdUsers}
        />
      )}

      {/* 审批确认对话框 */}
      {selectedApp && (
        <ApproveDialog
          application={selectedApp}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
