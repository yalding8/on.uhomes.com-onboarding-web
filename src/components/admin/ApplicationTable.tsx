"use client";

/**
 * 申请列表渲染组件 — Client Component
 *
 * 负责桌面端表格和移动端卡片的渲染，
 * 包含审批按钮（仅 PENDING 状态可用）。
 *
 * 从 ApplicationList 拆分而来，保持 300 行限制。
 * Requirements: 3.2, 4.1
 */

import type { ApplicationRow } from "@/app/admin/applications/page";

interface ApplicationTableProps {
  applications: ApplicationRow[];
  onApprove: (application: ApplicationRow) => void;
}

const STATUS_CONFIG: Record<
  ApplicationRow["status"],
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  },
  CONVERTED: {
    label: "Converted",
    className: "bg-[var(--color-success-light)] text-[var(--color-success)]",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
  },
};

function StatusBadge({ status }: { status: ApplicationRow["status"] }) {
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
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      className="px-3 py-1 rounded text-xs font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? "Approve" : STATUS_CONFIG[application.status].label}
    </button>
  );
}

export function ApplicationTable({
  applications,
  onApprove,
}: ApplicationTableProps) {
  return (
    <>
      {/* 桌面端表格 — >=768px */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">City</th>
              <th className="text-left px-4 py-3 font-medium">Country</th>
              <th className="text-left px-4 py-3 font-medium">Website</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Submitted</th>
              <th className="text-left px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr
                key={app.id}
                className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                  {app.company_name}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {app.contact_email}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {app.contact_phone ?? "—"}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {app.city ?? "—"}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {app.country ?? "—"}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
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
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">
                  {formatDate(app.created_at)}
                </td>
                <td className="px-4 py-3">
                  <ApproveButton application={app} onApprove={onApprove} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 移动端卡片 — <768px */}
      <div className="md:hidden flex flex-col gap-3">
        {applications.map((app) => (
          <div
            key={app.id}
            className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-primary)]"
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
              {(app.city || app.country) && (
                <p>{[app.city, app.country].filter(Boolean).join(", ")}</p>
              )}
              {app.website_url && (
                <a
                  href={app.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] hover:underline block"
                >
                  {app.website_url}
                </a>
              )}
              <p className="text-[var(--color-text-muted)] text-xs">
                {formatDate(app.created_at)}
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
