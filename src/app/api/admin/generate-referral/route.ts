import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST() {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const supabaseAdmin = createAdminClient();
    const bdSupplierId = authResult.supplier.id;

    // Check if BD already has a referral code
    const { data: existing } = await supabaseAdmin
      .from("suppliers")
      .select("referral_code")
      .eq("id", bdSupplierId)
      .single();

    if (existing?.referral_code) {
      return NextResponse.json({
        referral_code: existing.referral_code,
      });
    }

    // Generate 8-char alphanumeric code
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();

    const { error } = await supabaseAdmin
      .from("suppliers")
      .update({ referral_code: code })
      .eq("id", bdSupplierId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to generate referral code" },
        { status: 500 },
      );
    }

    return NextResponse.json({ referral_code: code });
  } catch (err) {
    console.error("[generate-referral]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
