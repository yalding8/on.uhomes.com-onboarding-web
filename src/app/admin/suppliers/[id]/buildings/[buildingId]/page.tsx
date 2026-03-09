/**
 * Admin Building Detail page — Server Component.
 * Shows building fields, gap report, and extraction jobs.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPageContext, checkBdAccess } from "../../data";
import { FIELD_SCHEMA } from "@/lib/onboarding/field-schema";
import { calculateScore } from "@/lib/onboarding/scoring-engine";
import { generateGapReport } from "@/lib/onboarding/gap-report";
import type { FieldValue } from "@/lib/onboarding/field-value";
import { GapReportPanel } from "@/components/onboarding/GapReportPanel";
import { BuildingFieldsView } from "@/components/admin/BuildingFieldsView";
import { ExtractionJobsCard } from "@/components/admin/ExtractionJobsCard";

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  extracting: {
    bg: "var(--color-info-bg, #EFF6FF)",
    text: "var(--color-info, #2563EB)",
  },
  incomplete: {
    bg: "var(--color-warning-bg, #FFF7ED)",
    text: "var(--color-warning, #EA580C)",
  },
  previewable: {
    bg: "var(--color-primary-bg, #FFF1F2)",
    text: "var(--color-primary)",
  },
  ready_to_publish: {
    bg: "var(--color-primary-bg, #FFF1F2)",
    text: "var(--color-primary)",
  },
  published: {
    bg: "var(--color-success-bg, #F0FDF4)",
    text: "var(--color-success, #16A34A)",
  },
};

function scoreToHue(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped <= 50) return (clamped / 50) * 30;
  return 30 + ((clamped - 50) / 50) * 90;
}

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function BuildingDetailPage({
  params,
}: {
  params: Promise<{ id: string; buildingId: string }>;
}) {
  let ctx: Awaited<ReturnType<typeof getPageContext>>;
  try {
    ctx = await getPageContext();
  } catch (err) {
    console.error("[building-detail] getPageContext failed", err);
    redirect("/login");
  }
  if (!ctx) redirect("/login");

  const { id: supplierId, buildingId } = await params;

  if (!ctx.isAdmin) {
    const hasAccess = await checkBdAccess(supplierId, ctx.bdSupplierId);
    if (!hasAccess) notFound();
  }

  const admin = createAdminClient();

  const [buildingRes, onboardingRes, jobsRes, supplierRes] = await Promise.all([
    admin
      .from("buildings")
      .select(
        "id, supplier_id, building_name, building_address, city, country, postal_code, onboarding_status, score",
      )
      .eq("id", buildingId)
      .single(),
    admin
      .from("building_onboarding_data")
      .select("field_values, version, updated_at")
      .eq("building_id", buildingId)
      .single(),
    admin
      .from("extraction_jobs")
      .select(
        "id, source, status, extracted_data, error_message, started_at, completed_at, created_at",
      )
      .eq("building_id", buildingId)
      .order("created_at", { ascending: true }),
    admin
      .from("suppliers")
      .select("id, company_name")
      .eq("id", supplierId)
      .single(),
  ]);

  const building = buildingRes.data;
  if (!building || building.supplier_id !== supplierId) notFound();

  const supplier = supplierRes.data;
  if (!supplier) notFound();

  const fieldValues = (onboardingRes.data?.field_values ?? {}) as Record<
    string,
    FieldValue
  >;
  const scoreResult = calculateScore(FIELD_SCHEMA, fieldValues);
  const gapReport = generateGapReport(FIELD_SCHEMA, fieldValues, buildingId);

  const status = building.onboarding_status ?? "incomplete";
  const style = STATUS_STYLES[status] ?? {
    bg: "var(--color-bg-secondary)",
    text: "var(--color-text-muted)",
  };
  const hue = scoreToHue(scoreResult.score);
  const barColor = `hsl(${hue}, 80%, 45%)`;

  const jobs = (jobsRes.data ?? []) as Array<{
    id: string;
    source: string;
    status: string;
    extracted_data: Record<string, unknown> | null;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
  }>;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back link */}
      <Link
        href={`/admin/suppliers/${supplierId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {supplier.company_name}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {building.building_name}
        </h1>
        <span
          className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: style.bg, color: style.text }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: style.text }}
          />
          {formatStatusLabel(status)}
        </span>
      </div>

      {building.building_address && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {building.building_address}
          {building.city && `, ${building.city}`}
          {building.country && `, ${building.country}`}
          {building.postal_code && ` ${building.postal_code}`}
        </p>
      )}

      {/* Score bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-3 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(2, scoreResult.score)}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
        <span
          className="shrink-0 text-sm font-bold tabular-nums"
          style={{ color: barColor }}
        >
          {scoreResult.score}/100
        </span>
      </div>

      {/* Two-column layout */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 space-y-6 lg:space-y-0">
        {/* Left: fields */}
        <BuildingFieldsView
          fieldValues={fieldValues}
          scoreResult={scoreResult}
        />

        {/* Right: gap report + extraction jobs */}
        <div className="space-y-6">
          <GapReportPanel gapReport={gapReport} />
          {jobs.length > 0 && <ExtractionJobsCard jobs={jobs} />}
        </div>
      </div>
    </div>
  );
}
