/**
 * Contract confirm/resend/request_changes business logic.
 *
 * Extracted from the API route to keep route.ts thin (HTTP only)
 * and make business logic independently testable.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { validateTransition } from "./status-machine";
import { createEnvelope } from "@/lib/docusign/client";
import type { ContractFields, ContractStatus } from "./types";

export interface ContractRow {
  id: string;
  supplier_id: string;
  status: ContractStatus;
  contract_fields: ContractFields | null;
}

export interface SupplierRow {
  id: string;
  contact_email: string;
  company_name: string;
}

interface SuccessResult {
  success: true;
  message: string;
  status: ContractStatus;
  envelopeId?: string;
}

interface ErrorResult {
  success: false;
  error: string;
  httpStatus: number;
}

export type HandlerResult = SuccessResult | ErrorResult;

/**
 * Confirm: PENDING_REVIEW → CONFIRMED → DocuSign → SENT
 */
export async function handleConfirm(
  contract: ContractRow,
  supplier: SupplierRow,
): Promise<HandlerResult> {
  const toConfirmed = validateTransition(contract.status, "CONFIRMED");
  if (!toConfirmed.valid) {
    return {
      success: false,
      error: `Cannot perform action on contract with status: ${contract.status}`,
      httpStatus: 400,
    };
  }

  const adminClient = createAdminClient();
  const { error: confirmError } = await adminClient
    .from("contracts")
    .update({ status: "CONFIRMED" })
    .eq("id", contract.id);

  if (confirmError) {
    return {
      success: false,
      error: "Failed to update contract status",
      httpStatus: 500,
    };
  }

  return sendEnvelope(contract, supplier);
}

/**
 * Resend: SENT → create new DocuSign envelope → SENT
 */
export async function handleResend(
  contract: ContractRow,
  supplier: SupplierRow,
): Promise<HandlerResult> {
  if (contract.status !== "SENT") {
    return {
      success: false,
      error: "Can only resend contracts in SENT status",
      httpStatus: 400,
    };
  }
  return sendEnvelope(contract, supplier);
}

/**
 * Request changes: PENDING_REVIEW → DRAFT
 */
export async function handleRequestChanges(
  contract: ContractRow,
): Promise<HandlerResult> {
  const transition = validateTransition(contract.status, "DRAFT");
  if (!transition.valid) {
    return {
      success: false,
      error: `Cannot perform action on contract with status: ${contract.status}`,
      httpStatus: 400,
    };
  }

  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from("contracts")
    .update({ status: "DRAFT" })
    .eq("id", contract.id);

  if (updateError) {
    return {
      success: false,
      error: "Failed to update contract status",
      httpStatus: 500,
    };
  }

  return {
    success: true,
    message: "Changes requested. Contract has been returned to BD for editing",
    status: "DRAFT",
  };
}

/**
 * Shared: create DocuSign envelope and update contract to SENT
 */
async function sendEnvelope(
  contract: ContractRow,
  supplier: SupplierRow,
): Promise<HandlerResult> {
  const fields = contract.contract_fields;
  if (!fields) {
    return {
      success: false,
      error: "Contract fields are missing",
      httpStatus: 400,
    };
  }

  const adminClient = createAdminClient();

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
      return {
        success: false,
        error: "Failed to update contract after envelope creation",
        httpStatus: 500,
      };
    }

    return {
      success: true,
      message: "Signing email has been sent",
      status: "SENT",
      envelopeId,
    };
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

    return {
      success: false,
      error: `DocuSign API error: ${detail}`,
      httpStatus: 502,
    };
  }
}
