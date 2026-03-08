/**
 * Assign a supplier to a BD — POST /api/admin/assign-bd
 *
 * Admin-only: sets suppliers.bd_user_id to the target BD's supplier id.
 * Body: { supplier_id: string, bd_id: string | null }
 */

import { NextResponse } from "next/server";
import { verifyAdminRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminRole();
    if (isBdAuthError(authResult)) return authResult;

    const body = (await request.json()) as {
      supplier_id?: string;
      bd_id?: string | null;
    };

    if (!body.supplier_id) {
      return NextResponse.json(
        { error: "supplier_id is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();

    // Validate supplier exists and is a supplier role
    const { data: supplier } = await supabaseAdmin
      .from("suppliers")
      .select("id, role")
      .eq("id", body.supplier_id)
      .eq("role", "supplier")
      .single();

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
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
      .from("suppliers")
      .update({ bd_user_id: body.bd_id ?? null })
      .eq("id", body.supplier_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update assignment" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[assign-bd]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
