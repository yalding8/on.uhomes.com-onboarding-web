/**
 * Extraction Callback API — POST /api/extraction/callback
 *
 * 接收 External Worker 的提取结果回调。
 *
 * 流程:
 * 1. 验证请求签名（service_role key）
 * 2. 更新 extraction_job 状态和 extracted_data
 * 3. 调用 mergeWithProtection 合并数据到 building_onboarding_data
 * 4. 重新计算 Quality Score 并更新 building 状态
 * 5. 写入 field_audit_logs
 * 6. 检查所有 jobs 是否完成，如是则退出 extracting 状态
 *
 * 鉴权: SUPABASE_SERVICE_ROLE_KEY（仅 External Worker 调用）
 *
 * Requirements: 1.5, 1.7, 8.2
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, getServiceRoleKey } from "@/lib/env";
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

// ── Types ──

interface CallbackPayload {
  buildingId: string;
  source: DataSource;
  extractedFields: Record<string, ExtractionFieldValue>;
  status: "success" | "partial" | "failed";
  errorMessage?: string;
  jobId?: string;
}

// ── Helpers ──

function getAdminClient() {
  return createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function verifyServiceKey(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  return token === getServiceRoleKey();
}

// ── Route Handler ──

export async function POST(request: Request) {
  try {
    if (!verifyServiceKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CallbackPayload;
    const { buildingId, source, extractedFields, status, errorMessage, jobId } = body;

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
      ? admin.from("extraction_jobs").update({
          status: jobStatus,
          extracted_data: extractedFields ?? {},
          error_message: errorMessage ?? null,
          completed_at: now,
        }).eq("id", jobId)
      : admin.from("extraction_jobs").update({
          status: jobStatus,
          extracted_data: extractedFields ?? {},
          error_message: errorMessage ?? null,
          completed_at: now,
        }).eq("building_id", buildingId).eq("source", source).eq("status", "running");

    const { error: jobUpdateError } = await jobFilter;
    if (jobUpdateError) {
      // 如果 running 匹配不到，尝试 pending
      if (!jobId) {
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
    }

    // ── 2. 如果提取失败，只更新 job 状态，不合并数据 ──

    if (status === "failed") {
      // 检查是否所有 jobs 都已终态，决定是否退出 extracting
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

    // 将提取结果转换为 FieldValue 格式
    const incomingValues = mergeExtractionResults([
      { source, fields: extractedFields },
    ]);

    // 合并并保护已确认字段
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
      .filter(([key]) => {
        // 只记录实际写入的字段（未被保护跳过的）
        const merged = mergedValues[key];
        return merged && merged.source === source;
      })
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
      .select("onboarding_status, score")
      .eq("id", buildingId)
      .single();

    const currentStatus = (building?.onboarding_status ??
      "extracting") as BuildingStatus;

    // 检查所有 jobs 是否都已完成
    const allDone = await areAllJobsDone(admin, buildingId);

    // 如果还在 extracting 且所有 jobs 完成，先转为 incomplete 再应用阈值
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

// ── Internal Helpers ──

async function areAllJobsDone(
  admin: ReturnType<typeof getAdminClient>,
  buildingId: string,
): Promise<boolean> {
  const { data: jobs } = await admin
    .from("extraction_jobs")
    .select("status")
    .eq("building_id", buildingId);

  if (!jobs || jobs.length === 0) return true;

  const terminalStatuses = ["completed", "failed", "timeout"];
  return jobs.every((j) => terminalStatuses.includes(j.status as string));
}

/**
 * 检查所有 extraction_jobs 是否已终态。
 * 如果全部完成/失败/超时，将 building 从 extracting 转为 incomplete。
 */
async function checkAndFinalizeExtraction(
  admin: ReturnType<typeof getAdminClient>,
  buildingId: string,
): Promise<void> {
  const allDone = await areAllJobsDone(admin, buildingId);
  if (!allDone) return;

  const { data: building } = await admin
    .from("buildings")
    .select("onboarding_status, score")
    .eq("id", buildingId)
    .single();

  if (building?.onboarding_status !== "extracting") return;

  // 获取当前分数来决定状态
  const { data: onboardingData } = await admin
    .from("building_onboarding_data")
    .select("field_values")
    .eq("building_id", buildingId)
    .single();

  const fieldValues: Record<string, FieldValue> =
    onboardingData?.field_values ?? {};
  const score = calculateScore(FIELD_SCHEMA, fieldValues);

  const newStatus = score.score >= 80 ? "previewable" : "incomplete";

  await admin
    .from("buildings")
    .update({ score: score.score, onboarding_status: newStatus })
    .eq("id", buildingId);
}
