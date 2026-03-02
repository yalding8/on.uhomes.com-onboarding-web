/**
 * Create New Contract API — POST /api/admin/contracts
 *
 * Creates a new DRAFT contract for an existing supplier.
 * Used when a previous contract was CANCELED and BD needs to restart.
 *
 * Auth: Session-based, requires role='bd'
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const { supplier_id, contract_type } = await request.json();

    if (!supplier_id) {
      return NextResponse.json(
        { error: "supplier_id is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();

    // Verify supplier exists and is in PENDING_CONTRACT status
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from("suppliers")
      .select("id, status")
      .eq("id", supplier_id)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }

    if (supplier.status !== "PENDING_CONTRACT") {
      return NextResponse.json(
        {
          error: `Cannot create contract for supplier with status: ${supplier.status}`,
        },
        { status: 400 },
      );
    }

    // Ensure no active (non-canceled) contract already exists
    const { data: existingContracts } = await supabaseAdmin
      .from("contracts")
      .select("id, status")
      .eq("supplier_id", supplier_id)
      .neq("status", "CANCELED");

    if (existingContracts && existingContracts.length > 0) {
      return NextResponse.json(
        { error: "Supplier already has an active contract" },
        { status: 409 },
      );
    }

    // Create new DRAFT contract
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("contracts")
      .insert({
        supplier_id,
        status: "DRAFT",
        signature_provider: "DOCUSIGN",
        contract_fields: {},
        provider_metadata: {
          type: contract_type || "STANDARD_PROMOTION_2026",
          source: "replacement_after_cancel",
        },
      })
      .select("id")
      .single();

    if (contractError || !contract) {
      console.error("[create-contract]", contractError);
      return NextResponse.json(
        { error: "Failed to create contract" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "New contract created",
      contract_id: contract.id,
    });
  } catch (error) {
    console.error("[create-contract]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
