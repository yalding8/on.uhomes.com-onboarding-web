"use client";

/**
 * Supplier pipeline table — desktop table + mobile cards.
 *
 * Left border color-coded by urgency / stage.
 * Sorted by pipeline priority (NEW_CONTRACT first, oldest = most urgent).
 */

import {
  PIPELINE_STAGES,
  computeStageDays,
  type PipelineStage,
} from "@/lib/suppliers/pipeline";
import { formatRelativeTime } from "@/lib/utils/relative-time";

export interface SupplierTableRow {
  id: string;
  ref_code: string | null;
  company_name: string;
  contact_email: string;
  contact_phone: string | null;
  city: string | null;
  country: string | null;
  website_url: string | null;
  status: string;
  created_at: string;
  bd_display_name: string | null;
  pipeline_stage: PipelineStage;
  contract_status: string | null;
  contract_created_at: string | null;
  contract_updated_at: string | null;
  contract_signed_at: string | null;
  building_count: number;
  avg_score: number | null;
  published_count: number;
  next_action: { text: string; actionType?: "copy_email" | "link" };
}

interface SupplierTableProps {
  suppliers: SupplierTableRow[];
  onRowClick: (supplier: SupplierTableRow) => void;
  isAdmin: boolean;
}

const STAGE_ORDER: Record<PipelineStage, number> = {
  NEW_CONTRACT: 0,
  CONTRACT_IN_PROGRESS: 1,
  AWAITING_SIGNATURE: 2,
  SIGNED: 3,
  LIVE: 4,
};

function getStageMeta(stage: PipelineStage) {
  return PIPELINE_STAGES.find((s) => s.value === stage) ?? PIPELINE_STAGES[0];
}

function getDays(s: SupplierTableRow): number {
  return computeStageDays(
    s.pipeline_stage,
    s.created_at,
    s.contract_created_at,
    s.contract_updated_at,
    s.contract_signed_at,
  );
}

function getBorderClass(s: SupplierTableRow): string {
  const days = getDays(s);
  if (s.pipeline_stage === "AWAITING_SIGNATURE")
    return "border-s-2 border-s-[var(--color-primary)]";
  if (s.pipeline_stage === "SIGNED" || s.pipeline_stage === "LIVE")
    return "border-s-2 border-s-[var(--color-success)]";
  if (days > 14) return "border-s-2 border-s-red-500";
  if (days > 7) return "border-s-2 border-s-[var(--color-warning)]";
  return "border-s-2 border-s-transparent";
}

function StageBadge({ stage }: { stage: PipelineStage }) {
  const meta = getStageMeta(stage);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

function ContractBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[var(--color-text-muted)]">—</span>;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

function DaysCell({ s }: { s: SupplierTableRow }) {
  if (s.pipeline_stage === "LIVE") return null;
  const days = getDays(s);
  const color =
    days > 14
      ? "text-red-500 font-medium"
      : days > 7
        ? "text-[var(--color-warning)] font-medium"
        : "text-[var(--color-text-muted)]";
  return <span className={color}>{days}d</span>;
}

function BuildingsCell({ s }: { s: SupplierTableRow }) {
  if (s.pipeline_stage === "LIVE") {
    return (
      <span className="text-[var(--color-text-secondary)]">
        {s.published_count}/{s.building_count} published
      </span>
    );
  }
  const score = s.avg_score !== null ? ` (${Math.round(s.avg_score)}%)` : "";
  return (
    <span className="text-[var(--color-text-secondary)]">
      {s.building_count}
      {score}
    </span>
  );
}

function sortSuppliers(list: SupplierTableRow[]): SupplierTableRow[] {
  return [...list].sort((a, b) => {
    const oa = STAGE_ORDER[a.pipeline_stage];
    const ob = STAGE_ORDER[b.pipeline_stage];
    if (oa !== ob) return oa - ob;
    // Within same stage: oldest first for urgency
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function SupplierTable({
  suppliers,
  onRowClick,
  isAdmin,
}: SupplierTableProps) {
  const sorted = sortSuppliers(suppliers);

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
              <th className="text-start px-4 py-3 font-medium">Company</th>
              <th className="text-start px-4 py-3 font-medium">Stage</th>
              <th className="text-start px-4 py-3 font-medium">Contract</th>
              <th className="text-start px-4 py-3 font-medium">Buildings</th>
              <th className="text-start px-4 py-3 font-medium">Days</th>
              <th className="text-start px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr
                key={s.id}
                onClick={() => onRowClick(s)}
                className={`border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer ${getBorderClass(s)}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-text-primary)] truncate">
                    {s.ref_code && (
                      <span className="text-xs text-[var(--color-text-muted)] font-normal me-1.5">
                        {s.ref_code}
                      </span>
                    )}
                    {s.company_name}
                  </p>
                  {isAdmin && s.bd_display_name && (
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {s.bd_display_name}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={s.pipeline_stage} />
                </td>
                <td className="px-4 py-3">
                  {s.pipeline_stage === "NEW_CONTRACT" ? (
                    <span className="text-[var(--color-text-muted)]">—</span>
                  ) : (
                    <ContractBadge status={s.contract_status} />
                  )}
                </td>
                <td className="px-4 py-3">
                  <BuildingsCell s={s} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <DaysCell s={s} />
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap text-xs">
                  {formatRelativeTime(s.contract_updated_at ?? s.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {sorted.map((s) => {
          return (
            <div
              key={s.id}
              onClick={() => onRowClick(s)}
              className={`rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer ${getBorderClass(s)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-[var(--color-text-primary)] truncate">
                  {s.ref_code && (
                    <span className="text-xs text-[var(--color-text-muted)] font-normal me-1.5">
                      {s.ref_code}
                    </span>
                  )}
                  {s.company_name}
                </span>
                <StageBadge stage={s.pipeline_stage} />
              </div>
              <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
                {isAdmin && s.bd_display_name && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {s.bd_display_name}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <BuildingsCell s={s} />
                  {s.pipeline_stage !== "LIVE" && <DaysCell s={s} />}
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {formatRelativeTime(s.contract_updated_at ?? s.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
