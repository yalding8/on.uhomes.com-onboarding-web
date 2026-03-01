/**
 * Dashboard — 供应商控制台。
 * PENDING_CONTRACT: 显示合同签署入口。
 * SIGNED: 显示 building 卡片列表 + 合同已签状态。
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApplicationUnderReview } from "@/components/form/ApplicationUnderReview";
import { ContractPreview } from "@/components/signing/ContractPreview";
import type { ContractStatus, ContractFields } from "@/lib/contracts/types";
import { BuildingCard } from "@/components/onboarding/BuildingCard";
import { Building2, Clock } from "lucide-react";
import { FIELD_SCHEMA } from "@/lib/onboarding/field-schema";
import { calculateScore } from "@/lib/onboarding/scoring-engine";
import type { FieldValue } from "@/lib/onboarding/field-value";
import type { BuildingStatus } from "@/lib/onboarding/status-engine";
import { PlatformOverview } from "@/components/dashboard/PlatformOverview";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: supplier, error: supplierError } = await supabase
    .from("suppliers")
    .select("id, company_name, status")
    .eq("user_id", user.id)
    .single();

  // 无 supplier 记录：检查是否已提交申请
  if (supplierError || !supplier) {
    const admin = createAdminClient();
    const { data: apps } = await admin
      .from("applications")
      .select("id")
      .eq("contact_email", user.email ?? "")
      .limit(1);
    const hasApplication = (apps?.length ?? 0) > 0;
    if (!hasApplication) redirect("/");

    return (
      <div className="max-w-4xl mx-auto">
        <ApplicationUnderReview />
      </div>
    );
  }

  // 获取合同（PENDING_CONTRACT 或新状态流程中的供应商都需要）
  let contract: {
    id: string;
    status: string;
    contract_fields: ContractFields | null;
    document_url: string | null;
  } | null = null;

  if (supplier.status === "PENDING_CONTRACT") {
    const { data } = await supabase
      .from("contracts")
      .select("id, status, contract_fields, document_url")
      .eq("supplier_id", supplier.id)
      .not("status", "eq", "CANCELED")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    contract = data;
  }

  // 判断合同是否处于新状态流程中
  const contractInProgress =
    contract &&
    ["DRAFT", "PENDING_REVIEW", "CONFIRMED", "SENT"].includes(contract.status);

  // SIGNED 用户：查询名下所有 buildings + onboarding 数据
  let buildings: Array<{
    id: string;
    name: string;
    address: string;
    score: number;
    missingCount: number;
    status: BuildingStatus;
  }> = [];

  if (supplier.status === "SIGNED") {
    const { data: rawBuildings } = await supabase
      .from("buildings")
      .select("id, building_name, building_address, score, onboarding_status")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });

    if (rawBuildings && rawBuildings.length > 0) {
      const buildingIds = rawBuildings.map((b) => b.id);
      const { data: onboardingRows } = await supabase
        .from("building_onboarding_data")
        .select("building_id, field_values")
        .in("building_id", buildingIds);

      const onboardingMap = new Map<string, Record<string, FieldValue>>();
      for (const row of onboardingRows ?? []) {
        onboardingMap.set(
          row.building_id,
          (row.field_values ?? {}) as Record<string, FieldValue>,
        );
      }

      buildings = rawBuildings.map((b) => {
        const fv = onboardingMap.get(b.id) ?? {};
        const result = calculateScore(FIELD_SCHEMA, fv);
        return {
          id: b.id,
          name: b.building_name ?? "Unnamed Building",
          address: b.building_address ?? "",
          score: result.score,
          missingCount: result.missingFields.length,
          status: (b.onboarding_status ?? "incomplete") as BuildingStatus,
        };
      });
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Welcome, {supplier.company_name || user.email}
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Your onboarding portal
        </p>
      </div>

      {/* 合同区域 — 新状态流程 */}
      {supplier.status === "PENDING_CONTRACT" && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
            Pending Actions
          </h2>
          {contract && contractInProgress ? (
            <ContractPreview
              contractId={contract.id}
              status={contract.status as ContractStatus}
              fields={contract.contract_fields}
              documentUrl={contract.document_url}
            />
          ) : contract && contract.status === "SIGNED" ? (
            <ContractPreview
              contractId={contract.id}
              status={contract.status as ContractStatus}
              fields={contract.contract_fields}
              documentUrl={contract.document_url}
            />
          ) : (
            <div className="p-4 bg-[var(--color-primary-light)] rounded-xl border border-[var(--color-border)] flex items-start gap-3">
              <Clock className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-[var(--color-primary)] font-medium">
                  Your partnership agreement is being prepared by our BD team.
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  You will receive an email notification once it is available.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 平台介绍 — PENDING_CONTRACT */}
      {supplier.status === "PENDING_CONTRACT" && <PlatformOverview />}

      {/* Building 列表 — SIGNED */}
      {supplier.status === "SIGNED" && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
            Your Properties
          </h2>
          {buildings.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {buildings.map((b) => (
                <BuildingCard
                  key={b.id}
                  buildingId={b.id}
                  buildingName={b.name}
                  address={b.address}
                  score={b.score}
                  missingCount={b.missingCount}
                  status={b.status}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 px-6 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)] mb-6">
                <Building2 className="h-8 w-8 text-[var(--color-primary)] opacity-60" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                Setting Up Your Properties
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-4">
                We&apos;re importing your building data. This usually takes 1–2
                business days.
              </p>
              <a
                href="mailto:contact@uhomes.com"
                className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors"
              >
                Questions? Contact your BD Manager
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
