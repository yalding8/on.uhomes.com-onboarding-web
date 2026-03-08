"use client";

/**
 * Application List — Client Component
 *
 * Orchestrates: KPI stats, search/filter, table, drawer, approve dialog.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { ApplicationRow, BdOption } from "@/app/admin/applications/page";
import { ApplicationStats } from "./ApplicationStats";
import { ApplicationTable } from "./ApplicationTable";
import { ApplicationDrawer } from "./ApplicationDrawer";
import { ApproveDialog } from "./ApproveDialog";

export type StatusFilter = ApplicationRow["status"] | "ALL";

interface ApplicationListProps {
  applications: ApplicationRow[];
  bdUsers: BdOption[];
  isAdmin: boolean;
  currentBdId: string;
}

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "CONVERTED", label: "Converted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export function getStatusCounts(
  applications: ApplicationRow[],
): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    ALL: applications.length,
    PENDING: 0,
    CONVERTING: 0,
    CONVERTED: 0,
    REJECTED: 0,
  };
  for (const app of applications) {
    counts[app.status]++;
  }
  return counts;
}

export function filterApplications(
  applications: ApplicationRow[],
  filter: StatusFilter,
  search: string,
  bdFilter: string | null,
): ApplicationRow[] {
  let result = applications;
  if (filter !== "ALL") {
    result = result.filter((app) => app.status === filter);
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (app) =>
        app.company_name.toLowerCase().includes(q) ||
        app.contact_email.toLowerCase().includes(q),
    );
  }
  if (bdFilter) {
    if (bdFilter === "UNASSIGNED") {
      result = result.filter((app) => app.assigned_bd_id === null);
    } else {
      result = result.filter((app) => app.assigned_bd_id === bdFilter);
    }
  }
  return result;
}

export function ApplicationList({
  applications,
  bdUsers,
  isAdmin,
  currentBdId,
}: ApplicationListProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("PENDING");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [bdFilter, setBdFilter] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<ApplicationRow | null>(null);
  const [drawerApp, setDrawerApp] = useState<ApplicationRow | null>(null);

  // Debounce search input by 300ms
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearch(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const counts = useMemo(() => getStatusCounts(applications), [applications]);
  const filtered = useMemo(
    () => filterApplications(applications, activeFilter, search, bdFilter),
    [applications, activeFilter, search, bdFilter],
  );

  const handleApprove = useCallback((app: ApplicationRow) => {
    setSelectedApp(app);
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
      setDrawerApp(null);
      router.refresh();
    },
    [selectedApp, router],
  );

  const handleCancel = useCallback(() => {
    setSelectedApp(null);
  }, []);

  const handleRowClick = useCallback((app: ApplicationRow) => {
    setDrawerApp(app);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerApp(null);
  }, []);

  return (
    <>
      {/* KPI Stats */}
      <ApplicationStats isAdmin={isAdmin} />

      {/* Toolbar: Tabs + Search + BD filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* Status tabs */}
        <div
          className="flex flex-wrap gap-2"
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
                <span className="ms-1.5 text-xs opacity-80">
                  {counts[value]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + BD filter */}
        <div className="flex items-center gap-2 sm:ms-auto">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search company or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="ps-8 pe-8 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 w-full sm:w-56 transition-colors"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {isAdmin && (
            <select
              value={bdFilter ?? ""}
              onChange={(e) => setBdFilter(e.target.value || null)}
              className="text-sm border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-colors"
            >
              <option value="">All BDs</option>
              <option value="UNASSIGNED">Unassigned</option>
              {bdUsers.map((bd) => (
                <option key={bd.id} value={bd.id}>
                  {bd.company_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Application list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 px-6 text-center rounded-lg border border-[var(--color-border)]">
          <Search className="h-8 w-8 text-[var(--color-text-muted)] mb-3 opacity-60" />
          <p className="text-sm text-[var(--color-text-muted)]">
            {search
              ? "No applications match your search."
              : activeFilter === "PENDING"
                ? "All caught up! No pending applications."
                : "No applications match this filter."}
          </p>
          {(search || activeFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setActiveFilter("ALL");
                setBdFilter(null);
              }}
              className="mt-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <ApplicationTable
          applications={filtered}
          onApprove={handleApprove}
          onRowClick={handleRowClick}
          bdUsers={bdUsers}
          isAdmin={isAdmin}
          currentBdId={currentBdId}
        />
      )}

      {/* Drawer */}
      {drawerApp && (
        <ApplicationDrawer
          application={drawerApp}
          bdUsers={bdUsers}
          isAdmin={isAdmin}
          currentBdId={currentBdId}
          onClose={handleDrawerClose}
          onApprove={handleApprove}
        />
      )}

      {/* Approve dialog */}
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
