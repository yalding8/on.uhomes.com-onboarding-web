"use client";

/**
 * Supplier List — Client Component
 *
 * Orchestrates: KPI stats, pipeline tabs, search/filter, table, drawer.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/suppliers/pipeline";
import type { SupplierTableRow } from "./SupplierTable";
import type { BdOption } from "@/app/admin/applications/page";
import { SupplierStats } from "./SupplierStats";
import { SupplierTable } from "./SupplierTable";
import { SupplierDrawer } from "./SupplierDrawer";

type StageFilter = PipelineStage | "ALL";

interface SupplierListProps {
  suppliers: SupplierTableRow[];
  bdUsers: BdOption[];
  isAdmin: boolean;
}

const FILTER_TABS: { value: StageFilter; label: string }[] = [
  ...PIPELINE_STAGES.map((s) => ({
    value: s.value as StageFilter,
    label: s.label,
  })),
  { value: "ALL", label: "All" },
];

export function getStageCounts(
  suppliers: SupplierTableRow[],
): Record<StageFilter, number> {
  const counts: Record<StageFilter, number> = {
    NEW_CONTRACT: 0,
    CONTRACT_IN_PROGRESS: 0,
    AWAITING_SIGNATURE: 0,
    SIGNED: 0,
    LIVE: 0,
    ALL: suppliers.length,
  };
  for (const s of suppliers) {
    counts[s.pipeline_stage]++;
  }
  return counts;
}

export function filterSuppliers(
  suppliers: SupplierTableRow[],
  stage: StageFilter,
  search: string,
  bdFilter: string | null,
): SupplierTableRow[] {
  let result = suppliers;
  if (stage !== "ALL") {
    result = result.filter((s) => s.pipeline_stage === stage);
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (s) =>
        s.company_name.toLowerCase().includes(q) ||
        s.contact_email.toLowerCase().includes(q) ||
        (s.city?.toLowerCase().includes(q) ?? false) ||
        (s.country?.toLowerCase().includes(q) ?? false),
    );
  }
  if (bdFilter) {
    result = result.filter((s) => s.bd_display_name === bdFilter);
  }
  return result;
}

export function SupplierList({
  suppliers,
  bdUsers,
  isAdmin,
}: SupplierListProps) {
  const [activeTab, setActiveTab] = useState<StageFilter>("NEW_CONTRACT");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [bdFilter, setBdFilter] = useState<string | null>(null);
  const [drawerSupplier, setDrawerSupplier] = useState<SupplierTableRow | null>(
    null,
  );

  // Debounce search input by 300ms
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearch(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const counts = useMemo(() => getStageCounts(suppliers), [suppliers]);
  const filtered = useMemo(
    () => filterSuppliers(suppliers, activeTab, search, bdFilter),
    [suppliers, activeTab, search, bdFilter],
  );

  const handleRowClick = useCallback((s: SupplierTableRow) => {
    setDrawerSupplier(s);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerSupplier(null);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setActiveTab("ALL");
    setBdFilter(null);
  }, []);

  return (
    <>
      {/* KPI Stats */}
      <SupplierStats />

      {/* Toolbar: Tabs + Search + BD filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* Pipeline stage tabs */}
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filter by pipeline stage"
        >
          {FILTER_TABS.map(({ value, label }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(value)}
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
              placeholder="Search company, email, city..."
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
              {bdUsers.map((bd) => (
                <option key={bd.id} value={bd.company_name}>
                  {bd.company_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Supplier table or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 px-6 text-center rounded-lg border border-[var(--color-border)]">
          <Search className="h-8 w-8 text-[var(--color-text-muted)] mb-3 opacity-60" />
          <p className="text-sm text-[var(--color-text-muted)]">
            {search
              ? "No suppliers match your search."
              : activeTab === "NEW_CONTRACT"
                ? "No new suppliers awaiting contract."
                : "No suppliers match this filter."}
          </p>
          {(search || activeTab !== "ALL" || bdFilter) && (
            <button
              onClick={clearAllFilters}
              className="mt-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <SupplierTable
          suppliers={filtered}
          onRowClick={handleRowClick}
          isAdmin={isAdmin}
        />
      )}

      {/* Drawer */}
      {drawerSupplier && (
        <SupplierDrawer supplier={drawerSupplier} onClose={handleDrawerClose} />
      )}
    </>
  );
}
