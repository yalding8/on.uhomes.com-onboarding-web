/**
 * 供应商详情页 — 楼宇与合同子模块
 *
 * 从 page.tsx 拆出，保持单一职责与行数限制。
 */

import Link from "next/link";
import {
  Building2,
  FileText,
  CircleDot,
  Clock,
  CheckCircle2,
  Mail,
  AlertCircle,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BuildingInfo, ContractInfo } from "./supplier-detail-config";
import { CONTRACT_STATUS_LABELS, formatDate } from "./supplier-detail-config";
import { SignedContractDownload } from "@/components/contracts/SignedContractDownload";
import { ResendButton } from "@/components/admin/ResendButton";

const CONTRACT_ICONS: Record<string, LucideIcon> = {
  DRAFT: CircleDot,
  PENDING_REVIEW: Clock,
  CONFIRMED: CheckCircle2,
  SENT: Mail,
  SIGNED: CheckCircle2,
  CANCELED: XCircle,
};

export function BuildingsSection({ buildings }: { buildings: BuildingInfo[] }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        Buildings ({buildings.length})
      </h2>
      {buildings.length === 0 ? (
        <div className="flex flex-col items-center py-12 px-6 text-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)] mb-4">
            <Building2 className="h-6 w-6 text-[var(--color-primary)] opacity-60" />
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
            No Buildings Yet
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
            Properties will appear here once the supplier starts the onboarding
            setup flow.
          </p>
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
                  className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
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
        <div className="flex flex-col items-center py-12 px-6 text-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)] mb-4">
            <FileText className="h-6 w-6 text-[var(--color-primary)] opacity-60" />
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
            No Contracts Yet
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
            Contracts will be created when the supplier is ready for the signing
            stage.
          </p>
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
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      {(() => {
                        const CIcon = CONTRACT_ICONS[c.status] ?? AlertCircle;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${si.className}`}
                          >
                            <CIcon className="h-3.5 w-3.5" />
                            {si.label}
                          </span>
                        );
                      })()}
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
                        <SignedContractDownload
                          contractId={c.id}
                          variant="link"
                        />
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
