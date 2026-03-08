"use client";

/**
 * Application table — 5-column design with visual status hierarchy.
 *
 * Desktop: compact table with left border color coding.
 * Mobile: card layout.
 */

import { Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ApplicationRow, BdOption } from "@/app/admin/applications/page";
import { formatRelativeTime } from "@/lib/utils/relative-time";

interface ApplicationTableProps {
  applications: ApplicationRow[];
  onApprove: (application: ApplicationRow) => void;
  onRowClick: (application: ApplicationRow) => void;
  bdUsers: BdOption[];
  isAdmin: boolean;
  currentBdId: string;
}

/** Supplier type abbreviation map */
const TYPE_SHORT: Record<string, string> = {
  "Purpose Built Student Accommodation Provider": "PBSA",
  "Property Management Company": "PMC",
  "Lettings Agent/Broker": "Agent",
  "Hotel Provider": "Hotel",
  "New homes developer": "Developer",
  Sublessor: "Sublessor",
  "Individual landlord": "Landlord",
  "Built to Rent Accommodation Provider": "BTR",
  "Co-living Provider": "Co-living",
};

const STATUS_CONFIG: Record<
  ApplicationRow["status"],
  { label: string; icon: LucideIcon; className: string }
> = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    className: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  },
  CONVERTED: {
    label: "Converted",
    icon: CheckCircle2,
    className: "bg-[var(--color-success-light)] text-[var(--color-success)]",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]",
  },
};

function StatusBadge({ status }: { status: ApplicationRow["status"] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function getBdLabel(bdId: string | null, bdUsers: BdOption[]): string {
  if (!bdId) return "Unassigned";
  const bd = bdUsers.find((b) => b.id === bdId);
  return bd ? bd.company_name : "—";
}

function getRowBorderClass(app: ApplicationRow): string {
  if (app.status !== "PENDING") return "border-s-2 border-s-transparent";
  if (app.assigned_bd_id === null) {
    return "border-s-2 border-s-[var(--color-warning)]";
  }
  return "border-s-2 border-s-[var(--color-primary)]";
}

function getRowOpacity(app: ApplicationRow): string {
  if (app.status === "REJECTED") return "opacity-60";
  return "";
}

export function ApplicationTable({
  applications,
  onApprove,
  onRowClick,
  bdUsers,
  isAdmin,
  currentBdId,
}: ApplicationTableProps) {
  // Sort: PENDING oldest first (urgency), others newest first
  const sorted = [...applications].sort((a, b) => {
    if (a.status === "PENDING" && b.status === "PENDING") {
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
              <th className="text-start px-4 py-3 font-medium">Company</th>
              <th className="text-start px-4 py-3 font-medium lg:table-cell hidden">
                Type
              </th>
              <th className="text-start px-4 py-3 font-medium">Country</th>
              <th className="text-start px-4 py-3 font-medium">Applied</th>
              <th className="text-start px-4 py-3 font-medium w-24">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((app) => {
              const isPending = app.status === "PENDING";
              const isUnassigned = app.assigned_bd_id === null;
              const bdLabel = getBdLabel(app.assigned_bd_id, bdUsers);
              const canApprove =
                isPending && (isAdmin || app.assigned_bd_id === currentBdId);

              return (
                <tr
                  key={app.id}
                  className={`border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer ${getRowBorderClass(app)} ${getRowOpacity(app)}`}
                  onClick={() => onRowClick(app)}
                >
                  {/* Company + BD sub-line */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isPending && isUnassigned && (
                        <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] shrink-0" />
                      )}
                      {isPending && !isUnassigned && (
                        <Clock className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
                      )}
                      {!isPending && <StatusBadge status={app.status} />}
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-text-primary)] truncate">
                          {app.company_name}
                        </p>
                        <p
                          className={`text-xs truncate ${
                            isUnassigned && isPending
                              ? "text-[var(--color-warning)] font-medium"
                              : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {isPending
                            ? isUnassigned
                              ? "Unassigned"
                              : bdLabel
                            : bdLabel}
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* Type (hidden on md, shown on lg) */}
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs lg:table-cell hidden">
                    {app.supplier_type
                      ? (TYPE_SHORT[app.supplier_type] ?? app.supplier_type)
                      : "—"}
                  </td>
                  {/* Country */}
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {app.country ?? "—"}
                  </td>
                  {/* Relative time */}
                  <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap text-xs">
                    {app.status === "PENDING"
                      ? formatRelativeTime(app.created_at)
                      : "—"}
                  </td>
                  {/* Action */}
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canApprove && (
                      <button
                        type="button"
                        onClick={() => onApprove(app)}
                        className="px-3 py-1 rounded text-xs font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all"
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {sorted.map((app) => {
          const isPending = app.status === "PENDING";
          const isUnassigned = app.assigned_bd_id === null;
          const bdLabel = getBdLabel(app.assigned_bd_id, bdUsers);
          const canApprove =
            isPending && (isAdmin || app.assigned_bd_id === currentBdId);

          return (
            <div
              key={app.id}
              onClick={() => onRowClick(app)}
              className={`rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer ${getRowBorderClass(app)} ${getRowOpacity(app)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-[var(--color-text-primary)] truncate">
                  {app.company_name}
                </span>
                <StatusBadge status={app.status} />
              </div>
              <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
                {app.supplier_type && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {TYPE_SHORT[app.supplier_type] ?? app.supplier_type}
                  </p>
                )}
                <p>{app.country ?? "—"}</p>
                <p
                  className={`text-xs ${
                    isUnassigned && isPending
                      ? "text-[var(--color-warning)] font-medium"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {isUnassigned ? "Unassigned" : bdLabel}
                </p>
                {isPending && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatRelativeTime(app.created_at)}
                  </p>
                )}
              </div>
              {canApprove && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onApprove(app);
                    }}
                    className="px-3 py-1 rounded text-xs font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
