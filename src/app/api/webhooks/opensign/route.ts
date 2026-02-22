import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    // 1. Verify Webhook Signature (Security: Block unverified third-party spoofing)
    const signatureHeader = request.headers.get("x-opensign-signature");

    // In production, this would be crypto verification against process.env.OPENSIGN_WEBHOOK_SECRET
    // Since this is MVP Phase 3 Mock verification:
    if (
      !signatureHeader ||
      signatureHeader !== process.env.OPENSIGN_WEBHOOK_SECRET
    ) {
      return NextResponse.json(
        { error: "Invalid or missing signature." },
        { status: 401 },
      );
    }

    const payload = await request.json();
    const { event_type, request_id } = payload;

    if (!request_id || event_type !== "signature_request_signed") {
      return NextResponse.json(
        { message: "Irrelevant notification ignored" },
        { status: 200 },
      );
    }

    // 2. Init Admin-level Supabase to securely find & transition the user contract states
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // 3. Retrieve pending contract by mapped signature_request_id mapped in admin approve phase
    const { data: contract, error: findContractError } = await supabaseAdmin
      .from("contracts")
      .select("id, supplier_id, status")
      .eq("signature_request_id", request_id)
      .single();

    if (findContractError || !contract) {
      console.error(
        "Webhook error: Contract record not found for webhook request ID:",
        request_id,
      );
      return NextResponse.json(
        { error: "Contract link broken or not found" },
        { status: 404 },
      );
    }

    // Protect against double-trigger hooks
    if (contract.status === "SIGNED" || contract.status === "COMPLETED") {
      return NextResponse.json(
        { message: "Already processed" },
        { status: 200 },
      );
    }

    // 4. Atomic Transition Pipeline
    // Mark Contract Complete
    const { error: updateContractError } = await supabaseAdmin
      .from("contracts")
      .update({
        status: "SIGNED",
        signed_at: new Date().toISOString(),
      })
      .eq("id", contract.id);

    if (updateContractError) {
      throw new Error(
        `Failed to update contract: ${updateContractError.message}`,
      );
    }

    // Mark Provider Complete -> This will trigger middleware to push them over to pro.uhomes.com
    const { error: updateSupplierError } = await supabaseAdmin
      .from("suppliers")
      .update({ status: "SIGNED" })
      .eq("id", contract.supplier_id);

    if (updateSupplierError) {
      throw new Error(
        `Failed to update supplier state: ${updateSupplierError.message}`,
      );
    }

    // TODO Phase 4.1: Parallel launch data aggregation pipeline for auto-onboarding listing.

    return NextResponse.json({
      success: true,
      processed_contract_id: contract.id,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error processing webhook";
    console.error("Webhook processing failure:", message); // Service level crash is fine in logs
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
