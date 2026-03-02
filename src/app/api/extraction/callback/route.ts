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
} from "@/lib/extraction/job-helpers";

interface CallbackPayload {
  buildingId: string;
  source: DataSource;
  extractedFields: Record<string, ExtractionFieldValue>;
  status: "success" | "partial" | "failed";
  errorMessage?: string;
  jobId?: string;
}

export async function POST(request: Request) {
  try {
    if (!verifyServiceKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CallbackPayload;
    const { buildingId, source, extractedFields, status, errorMessage, jobId } =
      body;

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
    const jobFilter = jobId
      ? admin
          .from("extraction_jobs")
          .update({
            status: jobStatus,
            extracted_data: extractedFields ?? {},
            error_message: errorMessage ?? null,
            completed_at: now,
          })
          .eq("id", jobId)
      : admin
          .from("extraction_jobs")
          .update({
            status: jobStatus,
            extracted_data: extractedFields ?? {},
            error_message: errorMessage ?? null,
            completed_at: now,
          })
          .eq("building_id", buildingId)
          .eq("source", source)
          .eq("status", "running");

    const { error: jobUpdateError } = await jobFilter;
    if (jobUpdateError && !jobId) {
      await admin
        .from("extraction_jobs")
        .update({
          status: jobStatus,
          extracted_data: extractedFields ?? {},
          error_message: errorMessage ?? null,
          completed_at: now,
        })
        .eq("building_id", buildingId)
        .eq("source", source)
        .eq("status", "pending");
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
    const { data: onboardingData } = await admin
      .from("building_onboarding_data")
      .select("field_values, version")
      .eq("building_id", buildingId)
      .single();

    const existingValues: Record<string, FieldValue> =
      onboardingData?.field_values ?? {};
    const currentVersion: number = onboardingData?.version ?? 1;

    const incomingValues = mergeExtractionResults([
      { source, fields: extractedFields },
    ]);
    const mergedValues = mergeWithProtection(existingValues, incomingValues);

    // ── 4. 写入合并后的数据 ──
    const newVersion = currentVersion + 1;
    if (onboardingData) {
      await admin
        .from("building_onboarding_data")
        .update({ field_values: mergedValues, version: newVersion })
        .eq("building_id", buildingId);
    } else {
      await admin.from("building_onboarding_data").insert({
        building_id: buildingId,
        field_values: mergedValues,
        version: 1,
      });
    }

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
      await admin.from("field_audit_logs").insert(auditLogs);
    }

    // ── 6. 重新计算评分 + 状态转换 ──
    const oldScore = calculateScore(FIELD_SCHEMA, existingValues);
    const newScore = calculateScore(FIELD_SCHEMA, mergedValues);

    const { data: building } = await admin
      .from("buildings")
      .select("onboarding_status")
      .eq("id", buildingId)
      .single();

    const currentStatus = (building?.onboarding_status ??
      "extracting") as BuildingStatus;
    const allDone = await areAllJobsDone(admin, buildingId);

    let baseStatus = currentStatus;
    if (currentStatus === "extracting" && allDone) {
      baseStatus = "incomplete";
    }

    const newStatus = resolveStatus(baseStatus, oldScore.score, newScore.score);

    await admin
      .from("buildings")
      .update({ score: newScore.score, onboarding_status: newStatus })
      .eq("id", buildingId);

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
