/**
 * Supplier detail page — Server Component
 *
 * Two-column layout on desktop (>=1024px), single column on mobile.
 * Left: timeline, contract, BD assignment. Right: building progress, notes.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Copy } from "lucide-react";
import { CONTRACT_STATUS_LABELS, formatDate } from "./supplier-detail-config";
import {
  computePipelineStage,
  getNextAction,
  PIPELINE_STAGES,
} from "@/lib/suppliers/pipeline";
import { BdAssignSelect } from "@/components/admin/BdAssignSelect";
import { SupplierTimeline } from "@/components/admin/SupplierTimeline";
import { BuildingProgressCard } from "@/components/admin/BuildingProgressCard";
import { SupplierNotes } from "@/components/admin/SupplierNotes";
import {
  getPageContext,
  checkBdAccess,
  fetchSupplierData,
  countFilledFields,
} from "./data";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let ctx: Awaited<ReturnType<typeof getPageContext>>;
  try {
    ctx = await getPageContext();
  } catch (err) {
    console.error("[supplier-detail] getPageContext failed", err);
    redirect("/login");
  }
  if (!ctx) redirect("/login");
  const { id } = await params;

  if (!ctx.isAdmin) {
    const hasAccess = await checkBdAccess(id, ctx.bdSupplierId);
    if (!hasAccess) notFound();
  }

  let data: Awaited<ReturnType<typeof fetchSupplierData>>;
  try {
    data = await fetchSupplierData(id, ctx.isAdmin);
  } catch (err) {
    console.error("[supplier-detail] fetchSupplierData failed", err);
    notFound();
  }
  if (!data) notFound();

  const { supplier, contract, buildings, onboardingData, bdUsers } = data;

  const pipelineBuildings = buildings.map((b) => ({
    onboarding_status: b.onboarding_status ?? "incomplete",
    score: b.score ?? 0,
  }));
  const stage = computePipelineStage(
    supplier.status,
    contract?.status ?? null,
    pipelineBuildings,
  );
  const nextAction = getNextAction(
    stage,
    contract?.status ?? null,
    pipelineBuildings,
  );
  const stageConfig = PIPELINE_STAGES.find((s) => s.value === stage);

  const onboardingMap = new Map(onboardingData.map((d) => [d.building_id, d]));
  const enrichedBuildings = buildings.map((b) => {
    const od = onboardingMap.get(b.id);
    const filled = countFilledFields(od?.field_values ?? null);
    return {
      id: b.id,
      building_name: b.building_name,
      building_address: b.building_address,
      onboarding_status: b.onboarding_status ?? "incomplete",
      score: b.score ?? 0,
      missing_count: 100 - filled,
      updated_at: od?.updated_at ?? null,
    };
  });

  const location = [supplier.city, supplier.country].filter(Boolean).join(", ");
  const contractType =
    (contract?.provider_metadata as { type?: string } | null)?.type ?? null;
  const contractStatusCfg = contract
    ? (CONTRACT_STATUS_LABELS[contract.status] ?? {
        label: contract.status,
        className:
          "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
      })
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/admin/suppliers"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Suppliers
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {supplier.ref_code && (
            <span className="text-sm text-[var(--color-text-muted)] font-normal me-2">
              {supplier.ref_code}
            </span>
          )}
          {supplier.company_name}
        </h1>
        {stageConfig && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: `color-mix(in srgb, ${stageConfig.color} 15%, transparent)`,
              color: stageConfig.color,
            }}
          >
            {stageConfig.label}
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {supplier.contact_email}
        {supplier.contact_phone && <> &middot; {supplier.contact_phone}</>}
        {location && <> &middot; {location}</>}
      </p>

      {/* Next action banner */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <FileText className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
          <span>{nextAction.text}</span>
        </div>
        {nextAction.actionType === "copy_email" && (
          <button
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline shrink-0"
            title="Copy supplier email"
            data-copy={supplier.contact_email}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Email
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="lg:grid lg:grid-cols-[1fr_1.5fr] lg:gap-6 space-y-6 lg:space-y-0">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          <SupplierTimeline supplierId={supplier.id} />
          <ContractSection
            contract={contract}
            statusCfg={contractStatusCfg}
            contractType={contractType}
          />
          {ctx.isAdmin && (
            <section className="rounded-lg border border-[var(--color-border)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                BD Assignment
              </h2>
              <BdAssignSelect
                supplierId={supplier.id}
                currentBdId={supplier.bd_user_id}
                bdUsers={bdUsers}
              />
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <BuildingProgressCard
            buildings={enrichedBuildings}
            supplierId={supplier.id}
          />
          <SupplierNotes supplierId={supplier.id} canEdit={true} />
        </div>
      </div>
    </div>
  );
}

/* ── Contract sub-section ── */

function ContractSection({
  contract,
  statusCfg,
  contractType,
}: {
  contract: {
    id: string;
    status: string;
    document_url: string | null;
    signed_at: string | null;
    provider_metadata?: {
      signing_expired?: boolean;
      expired_at?: string;
    } | null;
  } | null;
  statusCfg: { label: string; className: string } | null;
  contractType: string | null;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] p-4">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
        Contract
      </h2>
      {contract ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {statusCfg && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusCfg.className}`}
              >
                {statusCfg.label}
              </span>
            )}
            {contractType && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {contractType}
              </span>
            )}
            {contract.status === "SENT" &&
              contract.provider_metadata?.signing_expired && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-warning-light)] text-[var(--color-warning)]">
                  Signing Expired
                </span>
              )}
          </div>
          {contract.signed_at && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Signed {formatDate(contract.signed_at)}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            {contract.document_url && (
              <a
                href={contract.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </a>
            )}
            <Link
              href={`/admin/contracts/${contract.id}/edit`}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
            >
              <FileText className="w-3.5 h-3.5" />
              View Contract
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">
          No contract yet
        </p>
      )}
    </section>
  );
}
