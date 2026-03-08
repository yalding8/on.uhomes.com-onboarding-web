/**
 * Building Status Manual Rollback API
 *
 * PATCH /api/admin/buildings/[buildingId]/status
 *   — Manually change building onboarding status (BD admin only)
 *
 * Auth: Session-based, verify role='bd' via verifyBdRole()
 *
 * Allowed transitions (manual rollback only):
 *   ready_to_publish → previewable   (rollback to editing)
 *   ready_to_publish → incomplete    (rollback for major issues)
 *   published        → ready_to_publish (unpublish)
 *   previewable      → incomplete    (force back to editing)
 *
 * Rejects any transition involving 'extracting' (system-controlled).
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BuildingStatus } from "@/lib/onboarding/status-engine";

interface RouteContext {
  params: Promise<{ buildingId: string }>;
}

interface StatusChangeBody {
  status: BuildingStatus;
  reason?: string;
}

/** Allowed manual transitions: [from, to] */
const ALLOWED_TRANSITIONS: ReadonlyArray<[BuildingStatus, BuildingStatus]> = [
  ["ready_to_publish", "previewable"],
  ["ready_to_publish", "incomplete"],
  ["published", "ready_to_publish"],
  ["previewable", "incomplete"],
];

function isAllowedTransition(
  from: BuildingStatus,
  to: BuildingStatus,
): boolean {
  return ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

const VALID_STATUSES: ReadonlyArray<BuildingStatus> = [
  "extracting",
  "incomplete",
  "previewable",
  "ready_to_publish",
  "published",
];

function isValidStatus(value: string): value is BuildingStatus {
  return VALID_STATUSES.includes(value as BuildingStatus);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. BD auth
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const { buildingId } = await context.params;

    // 2. Parse and validate request body
    const body = (await request.json()) as StatusChangeBody;
    const { status: targetStatus, reason } = body;

    if (!targetStatus || typeof targetStatus !== "string") {
      return NextResponse.json(
        { error: "Invalid payload: status is required" },
        { status: 400 },
      );
    }

    if (!isValidStatus(targetStatus)) {
      return NextResponse.json(
        { error: `Invalid status: ${targetStatus}` },
        { status: 400 },
      );
    }

    // 3. Reject transitions to/from extracting
    if (targetStatus === "extracting") {
      return NextResponse.json(
        {
          error:
            "Cannot manually transition to 'extracting' (system-controlled)",
        },
        { status: 400 },
      );
    }

    // 4. Fetch current building status with supplier ownership
    const supabaseAdmin = createAdminClient();

    const { data: building, error: fetchError } = await supabaseAdmin
      .from("buildings")
      .select("id, onboarding_status, supplier_id")
      .eq("id", buildingId)
      .single();

    if (fetchError || !building) {
      return NextResponse.json(
        { error: "Building not found" },
        { status: 404 },
      );
    }

    // H-04 fix: BD scoping — verify ownership via supplier's bd_user_id
    if (!authResult.isAdmin) {
      const { data: supplier } = await supabaseAdmin
        .from("suppliers")
        .select("bd_user_id")
        .eq("id", building.supplier_id)
        .single();
      if (supplier?.bd_user_id !== authResult.supplier.id) {
        return NextResponse.json(
          { error: "Forbidden: building is not assigned to you" },
          { status: 403 },
        );
      }
    }

    const currentStatus = (building.onboarding_status ??
      "incomplete") as BuildingStatus;

    // 5. Reject transitions from extracting
    if (currentStatus === "extracting") {
      return NextResponse.json(
        {
          error:
            "Cannot manually transition from 'extracting' (system-controlled)",
        },
        { status: 400 },
      );
    }

    // 6. Validate the transition is allowed
    if (!isAllowedTransition(currentStatus, targetStatus)) {
      return NextResponse.json(
        {
          error: `Transition from '${currentStatus}' to '${targetStatus}' is not allowed`,
          allowed: ALLOWED_TRANSITIONS.filter(([f]) => f === currentStatus).map(
            ([, t]) => t,
          ),
        },
        { status: 400 },
      );
    }

    // 7. Update building status
    const { error: updateError } = await supabaseAdmin
      .from("buildings")
      .update({ onboarding_status: targetStatus })
      .eq("id", buildingId);

    if (updateError) {
      console.error("[admin/buildings/status]", updateError);
      return NextResponse.json(
        { error: "Failed to update building status" },
        { status: 500 },
      );
    }

    // 8. Write audit log
    const { error: auditError } = await supabaseAdmin
      .from("field_audit_logs")
      .insert({
        building_id: buildingId,
        user_id: authResult.user.id,
        user_role: "bd",
        field_key: "onboarding_status",
        old_value: currentStatus,
        new_value: targetStatus,
        ...(reason ? { reason } : {}),
      });

    if (auditError) {
      console.error("[admin/buildings/status] audit log failed", auditError);
      // Non-blocking: status update succeeded, log failure is not fatal
    }

    return NextResponse.json({
      success: true,
      buildingId,
      previousStatus: currentStatus,
      status: targetStatus,
      ...(reason ? { reason } : {}),
    });
  } catch (error) {
    console.error("[admin/buildings/status]", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
