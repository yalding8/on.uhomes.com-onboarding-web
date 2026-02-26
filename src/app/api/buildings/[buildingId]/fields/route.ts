/**
 * Building Fields CRUD API
 *
 * GET  — 获取 building 的所有字段数据 + 评分 + gap report
 * PATCH — 更新字段值（带乐观锁 + 审计日志）
 *
 * 鉴权: 通过 Supabase Auth session + RLS 自动过滤
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FIELD_SCHEMA } from "@/lib/onboarding/field-schema";
import { calculateScore } from "@/lib/onboarding/scoring-engine";
import { generateGapReport } from "@/lib/onboarding/gap-report";
import { resolveStatus } from "@/lib/onboarding/status-engine";
import { validateFields } from "@/lib/onboarding/field-validator";
import type { FieldValue } from "@/lib/onboarding/field-value";
import type { BuildingStatus } from "@/lib/onboarding/status-engine";

interface RouteParams {
  params: Promise<{ buildingId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { buildingId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS 自动过滤：supplier 只能看自己的，BD/data_team 看全部
    const { data: onboardingData, error } = await supabase
      .from("building_onboarding_data")
      .select("field_values, version")
      .eq("building_id", buildingId)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const fieldValues: Record<string, FieldValue> =
      onboardingData?.field_values ?? {};
    const version = onboardingData?.version ?? 0;

    const score = calculateScore(FIELD_SCHEMA, fieldValues);
    const gapReport = generateGapReport(FIELD_SCHEMA, fieldValues, buildingId);

    // 获取 building 状态
    const { data: building } = await supabase
      .from("buildings")
      .select("onboarding_status")
      .eq("id", buildingId)
      .single();

    return NextResponse.json({
      buildingId,
      fields: fieldValues,
      score,
      gapReport,
      version,
      status: building?.onboarding_status ?? "incomplete",
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { buildingId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fields, version: clientVersion } = body as {
      fields: Record<string, unknown>;
      version: number;
    };

    if (!fields || typeof fields !== "object") {
      return NextResponse.json(
        { error: "Invalid payload: fields required" },
        { status: 400 },
      );
    }

    // 字段值类型校验
    const validation = validateFields(fields);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Invalid field values", fieldErrors: validation.errors },
        { status: 400 },
      );
    }

    // 获取当前数据（RLS 自动过滤权限）
    const { data: existing, error: fetchErr } = await supabase
      .from("building_onboarding_data")
      .select("field_values, version")
      .eq("building_id", buildingId)
      .single();

    if (fetchErr && fetchErr.code !== "PGRST116") {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const currentValues: Record<string, FieldValue> =
      existing?.field_values ?? {};
    const currentVersion = existing?.version ?? 0;

    // 乐观锁快速拦截：客户端持有明显过期的 version，省去后续 DB 写入
    if (clientVersion !== undefined && clientVersion !== currentVersion) {
      return NextResponse.json(
        { error: "数据已被其他用户修改，请刷新页面" },
        { status: 409 },
      );
    }

    // 获取用户角色
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const userRole = supplier?.role ?? "supplier";
    const now = new Date().toISOString();

    // 构建更新后的 field_values + 审计日志
    const updatedValues = { ...currentValues };
    const auditLogs: Array<{
      building_id: string;
      user_id: string;
      user_role: string;
      field_key: string;
      old_value: unknown;
      new_value: unknown;
    }> = [];

    for (const [key, value] of Object.entries(fields)) {
      const oldFV = currentValues[key];

      updatedValues[key] = {
        value,
        source: "manual_input",
        confidence: "high" as const,
        confirmedBy: user.id,
        confirmedAt: now,
        updatedBy: user.id,
        updatedAt: now,
      };

      auditLogs.push({
        building_id: buildingId,
        user_id: user.id,
        user_role: userRole,
        field_key: key,
        old_value: oldFV ?? null,
        new_value: updatedValues[key],
      });
    }

    // Upsert building_onboarding_data
    const newVersion = currentVersion + 1;

    if (existing) {
      // DB 层乐观锁：WHERE version = currentVersion 确保只有持有正确 version
      // 的请求能写入。.select("version") 返回被更新的行；空数组 = 0 行受影响
      // = 并发请求已先一步修改了 version，返回 409 让客户端刷新重试。
      const { data: updated, error: updateErr } = await supabase
        .from("building_onboarding_data")
        .update({
          field_values: updatedValues,
          version: newVersion,
        })
        .eq("building_id", buildingId)
        .eq("version", currentVersion)
        .select("version");

      if (updateErr) {
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }

      // 0 行受影响：并发请求已在此期间修改了 version
      if (!updated || updated.length === 0) {
        return NextResponse.json(
          { error: "数据已被其他用户修改，请刷新页面" },
          { status: 409 },
        );
      }
    } else {
      const { error: insertErr } = await supabase
        .from("building_onboarding_data")
        .insert({
          building_id: buildingId,
          field_values: updatedValues,
          version: 1,
        });

      if (insertErr) {
        return NextResponse.json({ error: "Insert failed" }, { status: 500 });
      }
    }

    // 写入审计日志
    if (auditLogs.length > 0) {
      await supabase.from("field_audit_logs").insert(auditLogs);
    }

    // 重新计算评分并更新 building 状态
    const newScore = calculateScore(FIELD_SCHEMA, updatedValues);
    const oldScore = calculateScore(FIELD_SCHEMA, currentValues);

    const { data: building } = await supabase
      .from("buildings")
      .select("onboarding_status, score")
      .eq("id", buildingId)
      .single();

    const currentStatus = (building?.onboarding_status ??
      "incomplete") as BuildingStatus;
    const newStatus = resolveStatus(
      currentStatus,
      oldScore.score,
      newScore.score,
    );

    await supabase
      .from("buildings")
      .update({ score: newScore.score, onboarding_status: newStatus })
      .eq("id", buildingId);

    const gapReport = generateGapReport(
      FIELD_SCHEMA,
      updatedValues,
      buildingId,
    );

    return NextResponse.json({
      buildingId,
      fields: updatedValues,
      score: newScore,
      gapReport,
      version: existing ? newVersion : 1,
      status: newStatus,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
