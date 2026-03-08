/**
 * Assign a BD to an application — POST /api/admin/assign-application-bd
 *
 * Admin-only: sets applications.assigned_bd_id to the target BD's supplier id.
 * Body: { application_id: string, bd_id: string | null }
 */

import { NextResponse } from "next/server";
import { verifyAdminRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminRole();
    if (isBdAuthError(authResult)) return authResult;

    const body = (await request.json()) as {
      application_id?: string;
      bd_id?: string | null;
    };

    if (!body.application_id) {
      return NextResponse.json(
        { error: "application_id is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();

    // Validate application exists
    const { data: application } = await supabaseAdmin
      .from("applications")
      .select("id")
      .eq("id", body.application_id)
      .single();

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    // If bd_id provided, validate the BD exists
    if (body.bd_id) {
      const { data: bd } = await supabaseAdmin
        .from("suppliers")
        .select("id")
        .eq("id", body.bd_id)
        .eq("role", "bd")
        .single();

      if (!bd) {
        return NextResponse.json(
          { error: "BD user not found" },
          { status: 404 },
        );
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("applications")
      .update({ assigned_bd_id: body.bd_id ?? null })
      .eq("id", body.application_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update assignment" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[assign-application-bd]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
