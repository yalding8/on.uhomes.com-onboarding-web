"use client";

/**
 * 申请列表渲染组件 — Client Component
 *
 * 桌面端紧凑表格（5 列 + 可展开详情行）和移动端卡片。
 * Requirements: 3.2, 4.1
 */

import { useState, Fragment } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ApplicationRow } from "@/app/admin/applications/page";

interface ApplicationTableProps {
  applications: ApplicationRow[];
  onApprove: (application: ApplicationRow) => void;
}

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

/** Format date in UTC with timezone label for global BD teams */
function formatDateUTC(iso: string): string {
  return (
    new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }) +
    " " +
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) +
    " UTC"
  );
}

function ApproveButton({
  application,
  onApprove,
}: {
  application: ApplicationRow;
  onApprove: (application: ApplicationRow) => void;
}) {
  const isPending = application.status === "PENDING";
  return (
    <button
      type="button"
      onClick={() => onApprove(application)}
      disabled={!isPending}
      className="px-3 py-1 rounded text-xs font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? "Approve" : STATUS_CONFIG[application.status].label}
    </button>
  );
}

function location(app: ApplicationRow): string {
  return [app.city, app.country].filter(Boolean).join(", ") || "—";
}

function ExpandedDetails({ app }: { app: ApplicationRow }) {
  return (
    <tr className="bg-[var(--color-bg-secondary)]">
      <td colSpan={7} className="px-4 py-3">
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-[var(--color-text-secondary)]">
          <span>
            <strong className="text-[var(--color-text-muted)]">Phone:</strong>{" "}
            {app.contact_phone ?? "—"}
          </span>
          <span>
            <strong className="text-[var(--color-text-muted)]">Website:</strong>{" "}
            {app.website_url ? (
              <a
                href={app.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-primary)] hover:underline"
              >
                {app.website_url}
              </a>
            ) : (
              "—"
            )}
          </span>
        </div>
      </td>
    </tr>
  );
}

export function ApplicationTable({
  applications,
  onApprove,
}: ApplicationTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      {/* 桌面端表格 — >=768px */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
              <th className="text-start px-4 py-3 font-medium w-8" />
              <th className="text-start px-4 py-3 font-medium">Company</th>
              <th className="text-start px-4 py-3 font-medium">Email</th>
              <th className="text-start px-4 py-3 font-medium">Location</th>
              <th className="text-start px-4 py-3 font-medium">Applied</th>
              <th className="text-start px-4 py-3 font-medium">Status</th>
              <th className="text-start px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const isExpanded = expandedId === app.id;
              return (
                <Fragment key={app.id}>
                  <tr
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
                    onClick={() => toggle(app.id)}
                  >
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                      {app.company_name}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[200px] truncate">
                      {app.contact_email}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {location(app)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap text-xs">
                      {formatDateUTC(app.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ApproveButton application={app} onApprove={onApprove} />
                    </td>
                  </tr>
                  {isExpanded && <ExpandedDetails app={app} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 移动端卡片 — <768px */}
      <div className="md:hidden flex flex-col gap-3">
        {applications.map((app) => (
          <div
            key={app.id}
            className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[var(--color-text-primary)]">
                {app.company_name}
              </span>
              <StatusBadge status={app.status} />
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
              <p>{app.contact_email}</p>
              {app.contact_phone && <p>{app.contact_phone}</p>}
              <p>{location(app)}</p>
              {app.website_url && (
                <a
                  href={app.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] hover:underline block truncate"
                >
                  {app.website_url}
                </a>
              )}
              <p className="text-[var(--color-text-muted)] text-xs">
                {formatDateUTC(app.created_at)}
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <ApproveButton application={app} onApprove={onApprove} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
