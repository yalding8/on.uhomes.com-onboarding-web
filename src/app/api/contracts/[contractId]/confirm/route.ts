/**
 * Supplier confirm/request changes API — POST /api/contracts/[contractId]/confirm
 *
 * action=confirm:  PENDING_REVIEW → CONFIRMED → DocuSign create envelope → SENT
 * action=request_changes: PENDING_REVIEW → DRAFT
 * action=resend: SENT → create new DocuSign envelope → SENT
 *
 * Auth: Supabase Session + contract ownership verification | Requirements: 5.2, 5.3, 6.1, 6.4, 6.5, 6.6
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTransition } from "@/lib/contracts/status-machine";
import { createEnvelope } from "@/lib/docusign/client";
import {
  authenticateUser,
  fetchContract,
  type ContractRow,
  type SupplierRow,
} from "./auth";

type Action = "confirm" | "request_changes" | "resend";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

/**
 * Handle action=confirm: PENDING_REVIEW → CONFIRMED → DocuSign create envelope → SENT
 */
async function handleConfirm(
  contract: ContractRow,
  supplier: SupplierRow,
): Promise<NextResponse> {
  const adminClient = createAdminClient();

  const toConfirmed = validateTransition(contract.status, "CONFIRMED");
  if (!toConfirmed.valid) {
    return NextResponse.json(
      {
        error: `Cannot perform action on contract with status: ${contract.status}`,
      },
      { status: 400 },
    );
  }

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

  return sendEnvelope(contract, supplier);
}

/**
 * Handle action=resend: SENT → create new DocuSign envelope → SENT
 */
async function handleResend(
  contract: ContractRow,
  supplier: SupplierRow,
): Promise<NextResponse> {
  if (contract.status !== "SENT") {
    return NextResponse.json(
      { error: "Can only resend contracts in SENT status" },
      { status: 400 },
    );
  }
  return sendEnvelope(contract, supplier);
}

/**
 * Shared: create DocuSign envelope and update contract to SENT
 */
async function sendEnvelope(
  contract: ContractRow,
  supplier: SupplierRow,
): Promise<NextResponse> {
  const adminClient = createAdminClient();
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
      message: "Signing email has been sent",
      status: "SENT",
      envelopeId,
    });
  } catch (err: unknown) {
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
 * Body: { action: "confirm" | "request_changes" | "resend" }
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const authResult = await authenticateUser();
    if (authResult.error) return authResult.error;
    const { auth } = authResult;

    const body = (await request.json()) as { action?: string };
    const action = body.action as Action | undefined;

    if (!action || !["confirm", "request_changes", "resend"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // BD can only resend, not confirm or request_changes on behalf
    if (auth.isBd && action !== "resend") {
      return NextResponse.json(
        { error: "BD can only resend signing emails" },
        { status: 403 },
      );
    }

    const { contractId } = await context.params;
    const contractResult = await fetchContract(contractId, auth);
    if (contractResult.error) return contractResult.error;
    const { contract, contractSupplier } = contractResult;

    if (action === "confirm") {
      return handleConfirm(contract, contractSupplier);
    }
    if (action === "resend") {
      return handleResend(contract, contractSupplier);
    }

    return handleRequestChanges(contract);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
