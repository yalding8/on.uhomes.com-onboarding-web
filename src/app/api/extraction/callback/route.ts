/**
 * Extraction Callback API — POST /api/extraction/callback
 *
 * 接收 External Worker 的提取结果回调。
 * 鉴权: SUPABASE_SERVICE_ROLE_KEY（仅 External Worker 调用）
 */

import { NextResponse } from "next/server";
import { FIELD_SCHEMA } from "@/lib/onboarding/field-schema";
import { calculateScore } from "@/lib/onboarding/scoring-engine";
import { resolveStatus } from "@/lib/onboarding/status-engine";
import type { BuildingStatus } from "@/lib/onboarding/status-engine";
import type { FieldValue, DataSource } from "@/lib/onboarding/field-value";
import {
  mergeExtractionResults,
  mergeWithProtection,
} from "@/lib/onboarding/data-merge";
import type { ExtractionFieldValue } from "@/lib/onboarding/data-merge";
import {
  getAdminClient,
  verifyServiceKey,
  areAllJobsDone,
  checkAndFinalizeExtraction,
  mergeOnboardingDataWithRetry,
} from "@/lib/extraction/job-helpers";

/** Worker 回调中的提取元数据（用于 extraction_logs 积累经验） */
interface ExtractionMeta {
  sourceUrl?: string;
  urlDomain?: string;
  siteType?: string;
  siteFramework?: string;
  siteComplexity?: string;
  strategyUsed?: string;
  hasJsonLd?: boolean;
  hasOpenGraph?: boolean;
  cloudflareLevel?: string;
  llmSkipped?: boolean;
  llmProvider?: string | null;
  fieldCoverageRatio?: number;
  confidenceHigh?: number;
  confidenceMedium?: number;
  confidenceLow?: number;
  validationIssues?: number;
  llmValidationQuality?: string;
  llmValidationAdjustments?: number;
  llmValidationRemovals?: number;
  probeDurationMs?: number;
  scrapeDurationMs?: number;
  llmDurationMs?: number;
  totalDurationMs?: number;
}

interface CallbackPayload {
  buildingId: string;
  source: DataSource;
  extractedFields: Record<string, ExtractionFieldValue>;
  status: "success" | "partial" | "failed";
  errorMessage?: string;
  jobId?: string;
  meta?: ExtractionMeta;
}

export async function POST(request: Request) {
  try {
    if (!verifyServiceKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CallbackPayload;
    const {
      buildingId,
      source,
      extractedFields,
      status,
      errorMessage,
      jobId,
      meta,
    } = body;

    if (!buildingId || !source || !status) {
      return NextResponse.json(
        { error: "Missing required fields: buildingId, source, status" },
        { status: 400 },
      );
    }

    const admin = getAdminClient();
    const now = new Date().toISOString();

    // ── 1. 更新 extraction_job 状态 ──
    const jobStatus = status === "failed" ? "failed" : "completed";
    const jobUpdate = {
      status: jobStatus,
      extracted_data: extractedFields ?? {},
      error_message: errorMessage ?? null,
      completed_at: now,
    } as Record<string, unknown>;

    if (jobId) {
      // Verify job belongs to this building
      const { data: jobCheck } = (await admin
        .from("extraction_jobs")
        .select("building_id")
        .eq("id", jobId)
        .single()) as { data: { building_id: string } | null };

      if (jobCheck && jobCheck.building_id === buildingId) {
        await admin
          .from("extraction_jobs")
          .update(jobUpdate as never)
          .eq("id", jobId);
      } else {
        return NextResponse.json(
          { error: "Job does not belong to this building" },
          { status: 400 },
        );
      }
    } else {
      // Fallback: match by building + source, try running first, then pending
      const { data: updated } = (await admin
        .from("extraction_jobs")
        .update(jobUpdate as never)
        .eq("building_id", buildingId)
        .eq("source", source)
        .eq("status", "running")
        .select("id")) as { data: Array<{ id: string }> | null };

      if (!updated || updated.length === 0) {
        await admin
          .from("extraction_jobs")
          .update(jobUpdate as never)
          .eq("building_id", buildingId)
          .eq("source", source)
          .eq("status", "pending");
      }
    }

    // ── 2. 如果提取失败，只更新 job 状态，不合并数据 ──
    if (status === "failed") {
      await checkAndFinalizeExtraction(admin, buildingId);
      return NextResponse.json({
        message: "Extraction failed, job updated",
        buildingId,
        source,
      });
    }

    // ── 3. 融合提取数据到 building_onboarding_data ──
    const { data: onboardingData } = (await admin
      .from("building_onboarding_data")
      .select("field_values, version")
      .eq("building_id", buildingId)
      .single()) as {
      data: {
        field_values: Record<string, FieldValue>;
        version: number;
      } | null;
    };

    const existingValues: Record<string, FieldValue> =
      onboardingData?.field_values ?? {};

    const incomingValues = mergeExtractionResults([
      { source, fields: extractedFields },
    ]);
    const mergedValues = mergeWithProtection(existingValues, incomingValues);

    // ── 4. 写入合并后的数据（乐观锁 + 重试） ──
    await mergeOnboardingDataWithRetry(
      admin,
      buildingId,
      incomingValues,
      onboardingData,
      mergedValues,
    );

    // ── 5. 写入审计日志 ──
    const auditLogs = Object.entries(incomingValues)
      .filter(([key]) => mergedValues[key]?.source === source)
      .map(([key, newVal]) => ({
        building_id: buildingId,
        user_id: "system",
        user_role: "system",
        field_key: key,
        old_value: existingValues[key] ?? null,
        new_value: newVal,
      }));

    if (auditLogs.length > 0) {
      await admin.from("field_audit_logs").insert(auditLogs as never);
    }

    // ── 6. 重新计算评分 + 状态转换 ──
    const oldScore = calculateScore(FIELD_SCHEMA, existingValues);
    const newScore = calculateScore(FIELD_SCHEMA, mergedValues);

    const { data: building } = (await admin
      .from("buildings")
      .select("onboarding_status")
      .eq("id", buildingId)
      .single()) as { data: { onboarding_status: string } | null };

    const currentStatus = (building?.onboarding_status ??
      "extracting") as BuildingStatus;
    const allDone = await areAllJobsDone(admin, buildingId);

    let baseStatus = currentStatus;
    if (currentStatus === "extracting" && allDone) {
      baseStatus = "incomplete";
    }

    const newStatus = resolveStatus(baseStatus, oldScore.score, newScore.score);

    const { error: statusUpdateError } = await admin
      .from("buildings")
      .update({
        score: newScore.score,
        onboarding_status: newStatus,
      } as never)
      .eq("id", buildingId);

    if (statusUpdateError) {
      console.error(
        "[extraction/callback] Failed to update building status",
        statusUpdateError,
      );
    }

    // ── 7. 写入 extraction_logs（积累经验，为自适应进化铺路） ──
    if (meta) {
      const logEntry = {
        extraction_job_id: jobId ?? null,
        building_id: buildingId,
        source_url: meta.sourceUrl ?? "",
        url_domain: meta.urlDomain ?? "",
        site_type: meta.siteType ?? null,
        site_framework: meta.siteFramework ?? null,
        site_complexity: meta.siteComplexity ?? null,
        strategy_used: meta.strategyUsed ?? source,
        has_json_ld: meta.hasJsonLd ?? false,
        has_open_graph: meta.hasOpenGraph ?? false,
        llm_skipped: meta.llmSkipped ?? false,
        llm_provider: meta.llmProvider ?? null,
        field_coverage_ratio: meta.fieldCoverageRatio ?? 0,
        confidence_high_count: meta.confidenceHigh ?? 0,
        confidence_medium_count: meta.confidenceMedium ?? 0,
        confidence_low_count: meta.confidenceLow ?? 0,
        validation_issues_count: meta.validationIssues ?? 0,
        llm_validation_quality: meta.llmValidationQuality ?? null,
        llm_validation_adjustments: meta.llmValidationAdjustments ?? 0,
        llm_validation_removals: meta.llmValidationRemovals ?? 0,
        probe_duration_ms: meta.probeDurationMs ?? null,
        scrape_duration_ms: meta.scrapeDurationMs ?? null,
        llm_duration_ms: meta.llmDurationMs ?? null,
        total_duration_ms: meta.totalDurationMs ?? null,
      };
      const { error: logErr } = await admin
        .from("extraction_logs")
        .insert(logEntry as never);
      if (logErr) {
        console.error("[extraction/callback] Failed to write log", logErr);
      }
    }

    return NextResponse.json({
      message: "Extraction callback processed",
      buildingId,
      source,
      score: newScore.score,
      status: newStatus,
      fieldsUpdated: auditLogs.length,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
