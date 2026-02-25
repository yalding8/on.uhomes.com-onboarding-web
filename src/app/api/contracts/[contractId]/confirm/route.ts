/**
 * Supplier confirm/request changes API — POST /api/contracts/[contractId]/confirm
 *
 * action=confirm:  PENDING_REVIEW → CONFIRMED → DocuSign create envelope → SENT
 * action=request_changes: PENDING_REVIEW → DRAFT
 *
 * Auth: Supabase Session + contract ownership verification | Requirements: 5.2, 5.3, 6.1, 6.4, 6.5, 6.6
 */

import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTransition } from "@/lib/contracts/status-machine";
import { createEnvelope } from "@/lib/docusign/client";
import type { ContractFields, ContractStatus } from "@/lib/contracts/types";

type Action = "confirm" | "request_changes";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

interface ContractRow {
  id: string;
  supplier_id: string;
  status: ContractStatus;
  contract_fields: ContractFields | null;
}

interface SupplierRow {
  id: string;
  contact_email: string;
  company_name: string;
}


/**
 * Authenticate current user and return their associated supplier record.
 * Returns an error Response on failure.
 */
async function authenticateSupplier(): Promise<
  | { supplier: SupplierRow; error: null }
  | { supplier: null; error: NextResponse }
> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supplier: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const adminClient = createAdminClient();
  const { data: supplier, error: dbError } = await adminClient
    .from("suppliers")
    .select("id, contact_email, company_name")
    .eq("user_id", user.id)
    .single();

  if (dbError || !supplier) {
    return {
      supplier: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { supplier: supplier as SupplierRow, error: null };
}

/**
 * Fetch contract record and verify ownership
 */
async function fetchAndVerifyContract(
  contractId: string,
  supplierId: string,
): Promise<
  | { contract: ContractRow; error: null }
  | { contract: null; error: NextResponse }
> {
  const adminClient = createAdminClient();
  const { data, error: dbError } = await adminClient
    .from("contracts")
    .select("id, supplier_id, status, contract_fields")
    .eq("id", contractId)
    .single();

  if (dbError || !data) {
    return {
      contract: null,
      error: NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      ),
    };
  }

  const contract = data as ContractRow;

  if (contract.supplier_id !== supplierId) {
    return {
      contract: null,
      error: NextResponse.json(
        { error: "Contract does not belong to current user" },
        { status: 403 },
      ),
    };
  }

  return { contract, error: null };
}

/**
 * Handle action=confirm: PENDING_REVIEW → CONFIRMED → DocuSign create envelope → SENT
 */
async function handleConfirm(
  contract: ContractRow,
  supplier: SupplierRow,
): Promise<NextResponse> {
  const adminClient = createAdminClient();

  // 1. Validate state transition PENDING_REVIEW → CONFIRMED
  const toConfirmed = validateTransition(contract.status, "CONFIRMED");
  if (!toConfirmed.valid) {
    return NextResponse.json(
      {
        error: `Cannot perform action on contract with status: ${contract.status}`,
      },
      { status: 400 },
    );
  }

  // 2. Update status to CONFIRMED
  const { error: confirmError } = await adminClient
    .from("contracts")
    .update({ status: "CONFIRMED" })
    .eq("id", contract.id);

  if (confirmError) {
    return NextResponse.json(
      { error: "Failed to update contract status" },
      { status: 500 },
    );
  }

  // 3. Call DocuSign to create envelope
  const fields = contract.contract_fields;
  if (!fields) {
    return NextResponse.json(
      { error: "Contract fields are missing" },
      { status: 400 },
    );
  }

  try {
    const { envelopeId } = await createEnvelope(
      supplier.contact_email,
      supplier.company_name,
      fields,
    );

    // 4. Success: update status to SENT, store envelope_id, set signature_provider
    const { error: sentError } = await adminClient
      .from("contracts")
      .update({
        status: "SENT",
        signature_request_id: envelopeId,
        signature_provider: "DOCUSIGN",
      })
      .eq("id", contract.id);

    if (sentError) {
      return NextResponse.json(
        { error: "Failed to update contract after envelope creation" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contract confirmed. Signing email has been sent",
      status: "SENT",
      envelopeId,
    });
  } catch (err: unknown) {
    // 5. Failure: keep CONFIRMED status, record error to provider_metadata
    const detail =
      err instanceof Error ? err.message : "Unknown DocuSign error";
    await adminClient
      .from("contracts")
      .update({
        provider_metadata: {
          docusign_error: detail,
          docusign_error_at: new Date().toISOString(),
        },
      })
      .eq("id", contract.id);

    return NextResponse.json(
      { error: "DocuSign API error", details: detail },
      { status: 502 },
    );
  }
}

/**
 * Handle action=request_changes: PENDING_REVIEW → DRAFT
 */
async function handleRequestChanges(
  contract: ContractRow,
): Promise<NextResponse> {
  const transition = validateTransition(contract.status, "DRAFT");
  if (!transition.valid) {
    return NextResponse.json(
      {
        error: `Cannot perform action on contract with status: ${contract.status}`,
      },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from("contracts")
    .update({ status: "DRAFT" })
    .eq("id", contract.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update contract status" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Changes requested. Contract has been returned to BD for editing",
    status: "DRAFT",
  });
}

/**
 * POST /api/contracts/[contractId]/confirm
 *
 * Body: { action: "confirm" | "request_changes" }
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    // 1. Supplier authentication
    const authResult = await authenticateSupplier();
    if (authResult.error) return authResult.error;
    const { supplier } = authResult;

    // 2. Parse action
    const body = (await request.json()) as { action?: string };
    const action = body.action as Action | undefined;

    if (!action || !["confirm", "request_changes"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'confirm' or 'request_changes'" },
        { status: 400 },
      );
    }

    // 3. Fetch contract and verify ownership
    const { contractId } = await context.params;
    const contractResult = await fetchAndVerifyContract(
      contractId,
      supplier.id,
    );
    if (contractResult.error) return contractResult.error;
    const { contract } = contractResult;

    // 4. Dispatch handler
    if (action === "confirm") {
      return handleConfirm(contract, supplier);
    }

    return handleRequestChanges(contract);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
