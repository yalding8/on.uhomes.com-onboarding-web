/**
 * Signed Contract Download API — GET /api/contracts/[contractId]/download
 *
 * Generates a short-lived signed URL for the signed contract PDF.
 * Only accessible to the supplier who owns the contract, or admin/BD users.
 *
 * Auth: Supabase Session
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ contractId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { contractId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // Fetch contract with supplier ownership info
    const { data: contract, error: contractErr } = await supabaseAdmin
      .from("contracts")
      .select("id, supplier_id, status, document_url")
      .eq("id", contractId)
      .single();

    if (contractErr || !contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // Verify access: supplier must own the contract, or user is BD/admin
    const { data: supplier } = await supabaseAdmin
      .from("suppliers")
      .select("id, user_id, role")
      .eq("id", contract.supplier_id)
      .single();

    const { data: callerSupplier } = await supabaseAdmin
      .from("suppliers")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const isOwner = supplier?.user_id === user.id;
    const isBdOrAdmin =
      callerSupplier?.role === "bd" || callerSupplier?.role === "admin";

    if (!isOwner && !isBdOrAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only signed contracts have downloadable documents
    if (!contract.document_url) {
      return NextResponse.json(
        { error: "No signed document available" },
        { status: 404 },
      );
    }

    // Generate a signed URL (valid for 5 minutes)
    const { data: signedUrlData, error: signedUrlErr } =
      await supabaseAdmin.storage
        .from("signed-contracts")
        .createSignedUrl(contract.document_url, 300);

    if (signedUrlErr || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: signedUrlData.signedUrl });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
