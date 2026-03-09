/**
 * Application Claim API
 *
 * POST /api/admin/applications/[applicationId]/claim
 *   — BD claims an unassigned application
 *
 * Auth: Session-based, BD role required.
 * Atomic: only succeeds if assigned_bd_id IS NULL (race-safe).
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ applicationId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const { applicationId } = await context.params;
    const admin = createAdminClient();

    // Verify application exists and is PENDING
    const { data: app, error: fetchErr } = await admin
      .from("applications")
      .select("id, status, assigned_bd_id")
      .eq("id", applicationId)
      .single();

    if (fetchErr || !app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    if (app.status !== "PENDING") {
      return NextResponse.json(
        { error: "Can only claim pending applications" },
        { status: 400 },
      );
    }

    if (app.assigned_bd_id !== null) {
      return NextResponse.json(
        { error: "Application already assigned" },
        { status: 409 },
      );
    }

    // Atomic claim with WHERE guard
    const { data: updated, error: updateErr } = await admin
      .from("applications")
      .update({ assigned_bd_id: authResult.supplier.id })
      .eq("id", applicationId)
      .is("assigned_bd_id", null)
      .eq("status", "PENDING")
      .select("id");

    if (updateErr) {
      console.error("[application-claim] update error", updateErr);
      return NextResponse.json(
        { error: "Failed to claim application" },
        { status: 500 },
      );
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "Application already assigned" },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      application_id: applicationId,
    });
  } catch (error) {
    console.error("[application-claim]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
