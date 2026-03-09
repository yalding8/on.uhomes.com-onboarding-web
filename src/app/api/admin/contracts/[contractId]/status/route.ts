/**
 * Admin Contract Status Change API
 *
 * PATCH /api/admin/contracts/[contractId]/status
 *   — Change contract status (cancel, rollback, etc.)
 *
 * Auth: Session-based, verify role='bd' + BD scoping or admin
 *
 * Allowed actions:
 *   - cancel: any non-terminal → CANCELED (admin only)
 *   - rollback: CONFIRMED → PENDING_REVIEW (admin only, for stuck contracts)
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { validateTransition } from "@/lib/contracts/status-machine";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractStatus } from "@/lib/contracts/types";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

const ADMIN_ONLY_TARGETS: ContractStatus[] = ["CANCELED"];

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const { contractId } = await context.params;
    const body = (await request.json()) as {
      status: ContractStatus;
      reason?: string;
    };

    if (!body.status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 },
      );
    }

    // Admin-only targets
    if (ADMIN_ONLY_TARGETS.includes(body.status) && !authResult.isAdmin) {
      return NextResponse.json(
        { error: "Only admins can perform this action" },
        { status: 403 },
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: contract, error: fetchErr } = await supabaseAdmin
      .from("contracts")
      .select("id, supplier_id, status")
      .eq("id", contractId)
      .single();

    if (fetchErr || !contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // BD scoping
    if (!authResult.isAdmin) {
      const { data: supplier } = await supabaseAdmin
        .from("suppliers")
        .select("bd_user_id")
        .eq("id", contract.supplier_id)
        .single();
      if (supplier?.bd_user_id !== authResult.supplier.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Validate transition
    const currentStatus = contract.status as ContractStatus;
    const transition = validateTransition(currentStatus, body.status);
    if (!transition.valid) {
      return NextResponse.json(
        { error: transition.reason ?? "Invalid transition" },
        { status: 400 },
      );
    }

    // Atomic update with WHERE guard
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("contracts")
      .update({ status: body.status })
      .eq("id", contractId)
      .eq("status", currentStatus)
      .select("id");

    if (updateErr) {
      console.error("[contract-status]", updateErr);
      return NextResponse.json(
        { error: "Failed to update status" },
        { status: 500 },
      );
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "Contract status has changed. Please refresh." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      previousStatus: currentStatus,
      status: body.status,
    });
  } catch (error) {
    console.error("[contract-status]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
