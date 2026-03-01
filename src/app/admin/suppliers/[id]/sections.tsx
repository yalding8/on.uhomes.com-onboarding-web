/**
 * 供应商详情页 — 楼宇与合同子模块
 *
 * 从 page.tsx 拆出，保持单一职责与行数限制。
 */

import Link from "next/link";
import type { BuildingInfo, ContractInfo } from "./supplier-detail-config";
import { CONTRACT_STATUS_LABELS, formatDate } from "./supplier-detail-config";
import { ResendButton } from "@/components/admin/ResendButton";

export function BuildingsSection({ buildings }: { buildings: BuildingInfo[] }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        Buildings ({buildings.length})
      </h2>
      {buildings.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)]">
          No buildings associated with this supplier
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                <th className="text-start px-4 py-3 font-medium">Name</th>
                <th className="text-start px-4 py-3 font-medium">Address</th>
                <th className="text-start px-4 py-3 font-medium">Status</th>
                <th className="text-start px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b) => (
                <tr
                  key={b.id}
                  className="border-t border-[var(--color-border)]"
                >
                  <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                    {b.building_name}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {b.building_address ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {b.onboarding_status ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {b.score != null ? `${b.score} pts` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ContractsSection({ contracts }: { contracts: ContractInfo[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        Contracts ({contracts.length})
      </h2>
      {contracts.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)]">
          No contracts yet
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                <th className="text-start px-4 py-3 font-medium">Status</th>
                <th className="text-start px-4 py-3 font-medium">Action</th>
                <th className="text-start px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const si = CONTRACT_STATUS_LABELS[c.status] ?? {
                  label: c.status,
                  className:
                    "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
                };
                return (
                  <tr
                    key={c.id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${si.className}`}
                      >
                        {si.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {c.status === "DRAFT" && (
                        <Link
                          href={`/admin/contracts/${c.id}/edit`}
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          Edit Contract
                        </Link>
                      )}
                      {c.status === "SIGNED" && c.document_url && (
                        <a
                          href={c.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          Download Signed Contract
                        </a>
                      )}
                      {c.status === "SENT" && (
                        <ResendButton contractId={c.id} />
                      )}
                      {c.status !== "DRAFT" &&
                        c.status !== "SENT" &&
                        !(c.status === "SIGNED" && c.document_url) &&
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
