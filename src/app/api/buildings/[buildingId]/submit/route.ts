/**
 * Building Submit API — POST /api/buildings/[buildingId]/submit
 *
 * 将 building 状态从 previewable 推进到 ready_to_publish。
 * 前置条件：
 *   1. 当前状态必须是 previewable（score ≥ 80）
 *   2. 所有 required 字段必须有值
 *
 * 鉴权: Supabase Session + RLS 自动过滤（supplier 只能提交自己的 building）
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequiredFields } from "@/lib/onboarding/field-schema";
import { hasValue } from "@/lib/onboarding/field-value";
import type { FieldValue } from "@/lib/onboarding/field-value";
import type { BuildingStatus } from "@/lib/onboarding/status-engine";

interface RouteParams {
  params: Promise<{ buildingId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { buildingId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS 自动过滤：supplier 只能提交自己的 building
    const { data: building, error: buildingErr } = await supabase
      .from("buildings")
      .select("id, onboarding_status")
      .eq("id", buildingId)
      .single();

    if (buildingErr || !building) {
      return NextResponse.json(
        { error: "Building not found" },
        { status: 404 },
      );
    }

    const currentStatus = building.onboarding_status as BuildingStatus;

    // 前置条件 1：只有 previewable 才能提交
    if (currentStatus !== "previewable") {
      const reason =
        currentStatus === "ready_to_publish" || currentStatus === "published"
          ? "Building has already been submitted"
          : "Building score must reach 80 before submitting";
      return NextResponse.json({ error: reason }, { status: 422 });
    }

    // 前置条件 2：检查所有 required 字段
    const { data: onboardingData } = await supabase
      .from("building_onboarding_data")
      .select("field_values")
      .eq("building_id", buildingId)
      .single();

    const fieldValues: Record<string, FieldValue> =
      (onboardingData?.field_values as Record<string, FieldValue>) ?? {};

    const missingRequired = getRequiredFields()
      .filter((f) => !hasValue(fieldValues[f.key]))
      .map((f) => ({ key: f.key, label: f.label }));

    if (missingRequired.length > 0) {
      return NextResponse.json(
        { error: "Missing required fields", missingFields: missingRequired },
        { status: 422 },
      );
    }

    // 更新状态 → ready_to_publish (atomic: WHERE guard prevents race condition)
    const { data: updated, error: updateErr } = await supabase
      .from("buildings")
      .update({ onboarding_status: "ready_to_publish" })
      .eq("id", buildingId)
      .eq("onboarding_status", "previewable")
      .select("id");

    if (updateErr) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "Building status has changed, please refresh and try again" },
        { status: 409 },
      );
    }

    return NextResponse.json({ status: "ready_to_publish" });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
