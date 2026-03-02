/**
 * BD Contract Field Save & Push for Review API
 *
 * PUT  /api/admin/contracts/[contractId] — Save contract fields (DRAFT status only)
 * POST /api/admin/contracts/[contractId] — Push for review (DRAFT → PENDING_REVIEW)
 *
 * Auth: Session-based, verify role='bd'
 *
 * Requirements: 3.4, 4.1, 4.2, 4.3
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { validateContractFields } from "@/lib/contracts/field-validation";
import { validateTransition } from "@/lib/contracts/status-machine";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractFields, ContractStatus } from "@/lib/contracts/types";
import type { BdAuthResult } from "@/lib/admin/auth";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

interface ContractData {
  id: string;
  supplier_id: string;
  status: ContractStatus;
  contract_fields: Partial<ContractFields> | null;
  updated_at: string;
}

type FetchContractResult =
  | { contract: ContractData; errorResponse: null }
  | { contract: null; errorResponse: NextResponse };

async function verifyBdAccess(
  auth: BdAuthResult,
  supplierId: string,
): Promise<NextResponse | null> {
  if (auth.isAdmin) return null;
  const supabaseAdmin = createAdminClient();
  const { data: target } = await supabaseAdmin
    .from("suppliers")
    .select("bd_user_id")
    .eq("id", supplierId)
    .single();
  if (target?.bd_user_id !== auth.supplier.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function fetchContract(
  supabase: { from: ReturnType<typeof createAdminClient>["from"] },
  contractId: string,
): Promise<FetchContractResult> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, supplier_id, status, contract_fields, updated_at")
    .eq("id", contractId)
    .single();

  if (error || !data) {
    return {
      contract: null,
      errorResponse: NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      ),
    };
  }

  return { contract: data as ContractData, errorResponse: null };
}

/**
 * PUT: Save contract fields to contract_fields (DRAFT status only)
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    // 1. BD auth
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const { contractId } = await context.params;
    const supabaseAdmin = createAdminClient();

    // 2. Fetch contract
    const { contract, errorResponse } = await fetchContract(
      supabaseAdmin,
      contractId,
    );
    if (errorResponse) return errorResponse;

    // 2b. BD scoping
    const accessDenied = await verifyBdAccess(authResult, contract.supplier_id);
    if (accessDenied) return accessDenied;

    // 3. Verify status is DRAFT
    if (contract.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Cannot perform action on contract with status: ${contract.status}`,
        },
        { status: 400 },
      );
    }

    // 4. Parse and save field data
    const body = (await request.json()) as {
      fields: Partial<ContractFields>;
      updated_at?: string;
    };
    const fields = body.fields;

    if (!fields || typeof fields !== "object") {
      return NextResponse.json(
        { error: "Request body must contain a 'fields' object" },
        { status: 400 },
      );
    }

    // 5. Optimistic concurrency check via updated_at
    // If client provides updated_at, ensure it matches the current value
    if (body.updated_at && body.updated_at !== contract.updated_at) {
      return NextResponse.json(
        {
          error:
            "Contract was modified by another user. Please refresh and try again.",
          current_updated_at: contract.updated_at,
        },
        { status: 409 },
      );
    }

    // 6. Update contract_fields
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("contracts")
      .update({ contract_fields: fields })
      .eq("id", contractId)
      .select("updated_at")
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to save contract fields",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contract fields saved",
      updated_at: updated?.updated_at,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: Push for review (DRAFT → PENDING_REVIEW)
 * Validate all required fields are complete before updating status
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    // 1. BD auth
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const { contractId } = await context.params;
    const supabaseAdmin = createAdminClient();

    // 2. Fetch contract
    const { contract, errorResponse } = await fetchContract(
      supabaseAdmin,
      contractId,
    );
    if (errorResponse) return errorResponse;

    // 2b. BD scoping
    const accessDenied = await verifyBdAccess(authResult, contract.supplier_id);
    if (accessDenied) return accessDenied;

    // 3. Validate state transition
    const transition = validateTransition(contract.status, "PENDING_REVIEW");
    if (!transition.valid) {
      return NextResponse.json(
        {
          error: `Cannot perform action on contract with status: ${contract.status}`,
        },
        { status: 400 },
      );
    }

    // 4. Validate all required fields are filled
    const fields = (contract.contract_fields ?? {}) as Partial<ContractFields>;
    const validation = validateContractFields(fields);

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", fields: validation.errors },
        { status: 400 },
      );
    }

    // 5. Update status to PENDING_REVIEW
    const { error: updateError } = await supabaseAdmin
      .from("contracts")
      .update({ status: "PENDING_REVIEW" })
      .eq("id", contractId);

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to update contract status",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contract pushed for review",
      status: "PENDING_REVIEW",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
