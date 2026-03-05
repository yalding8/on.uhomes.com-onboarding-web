"use client";

import type { ApplicationRow, BdOption } from "@/app/admin/applications/page";
import { ApplicationBdSelect } from "./ApplicationBdSelect";

interface ApplicationExpandedRowProps {
  app: ApplicationRow;
  bdUsers: BdOption[];
  colSpan: number;
}

function getBdName(bdId: string | null, bdUsers: BdOption[]): string {
  if (!bdId) return "Unassigned";
  const bd = bdUsers.find((b) => b.id === bdId);
  return bd ? `${bd.company_name}` : "Unknown";
}

export function ApplicationExpandedRow({
  app,
  bdUsers,
  colSpan,
}: ApplicationExpandedRowProps) {
  return (
    <tr className="bg-[var(--color-bg-secondary)]">
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Details */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Contact Details
            </p>
            <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
              <p>
                <span className="text-[var(--color-text-muted)] font-medium">
                  Type:
                </span>{" "}
                {app.supplier_type ?? "—"}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)] font-medium">
                  Phone:
                </span>{" "}
                {app.contact_phone ?? "—"}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)] font-medium">
                  Website:
                </span>{" "}
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
              </p>
            </div>
          </div>

          {/* Assignment */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Assignment
            </p>
            <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
              <p>
                <span className="text-[var(--color-text-muted)] font-medium">
                  Current BD:
                </span>{" "}
                {getBdName(app.assigned_bd_id, bdUsers)}
              </p>
              <div className="mt-2">
                <ApplicationBdSelect
                  applicationId={app.id}
                  currentBdId={app.assigned_bd_id}
                  bdUsers={bdUsers}
                />
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
