/**
 * Contract confirm/resend/request_changes business logic.
 *
 * Extracted from the API route to keep route.ts thin (HTTP only)
 * and make business logic independently testable.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { validateTransition } from "./status-machine";
import { createEnvelope } from "@/lib/docusign/client";
import { triggerExtractionAfterConfirm } from "./extraction-trigger";
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

  // H-02 fix: atomic WHERE guard prevents double-click race condition
  const { data: updated } = await adminClient
    .from("contracts")
    .update({ status: "CONFIRMED" })
    .eq("id", contract.id)
    .eq("status", "PENDING_REVIEW")
    .select("id");

  if (!updated || updated.length === 0) {
    return {
      success: false,
      error: "Contract is already being processed",
      httpStatus: 409,
    };
  }

  const result = await sendEnvelope(contract, supplier);

  // P0-G3: Trigger extraction immediately after successful confirm
  if (result.success) {
    // Non-blocking: errors captured via Sentry, do not affect response
    triggerExtractionAfterConfirm(contract.supplier_id).catch(() => {});
  }

  return result;
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
  // Atomic WHERE guard: prevent race with concurrent confirm
  const { data: updated, error: updateError } = await adminClient
    .from("contracts")
    .update({ status: "DRAFT" })
    .eq("id", contract.id)
    .eq("status", "PENDING_REVIEW")
    .select("id");

  if (updateError) {
    return {
      success: false,
      error: "Failed to update contract status",
      httpStatus: 500,
    };
  }

  if (!updated || updated.length === 0) {
    return {
      success: false,
      error: "Contract status has already changed. Please refresh.",
      httpStatus: 409,
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

    // C-01 fix: rollback to PENDING_REVIEW so admin can retry
    await adminClient
      .from("contracts")
      .update({
        status: "PENDING_REVIEW",
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
