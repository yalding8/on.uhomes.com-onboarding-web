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
import { createClient } from "@supabase/supabase-js";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { validateContractFields } from "@/lib/contracts/field-validation";
import { validateTransition } from "@/lib/contracts/status-machine";
import type { ContractFields, ContractStatus } from "@/lib/contracts/types";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

/** Create service-role Supabase client */
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface ContractData {
  id: string;
  supplier_id: string;
  status: ContractStatus;
  contract_fields: Partial<ContractFields> | null;
}

type FetchContractResult =
  | { contract: ContractData; errorResponse: null }
  | { contract: null; errorResponse: NextResponse };

/**
 * Fetch contract record, return contract data or error Response
 */
async function fetchContract(
  supabase: { from: ReturnType<typeof createClient>["from"] },
  contractId: string,
): Promise<FetchContractResult> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, supplier_id, status, contract_fields")
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
    const body = (await request.json()) as { fields: Partial<ContractFields> };
    const fields = body.fields;

    if (!fields || typeof fields !== "object") {
      return NextResponse.json(
        { error: "Request body must contain a 'fields' object" },
        { status: 400 },
      );
    }

    // 5. Update contract_fields
    const { error: updateError } = await supabaseAdmin
      .from("contracts")
      .update({ contract_fields: fields })
      .eq("id", contractId);

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
