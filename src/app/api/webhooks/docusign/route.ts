/**
 * DocuSign Webhook — POST /api/webhooks/docusign
 *
 * Handles two event types:
 * 1. recipient-completed: supplier signed → trigger extraction immediately
 * 2. envelope-completed: all signers done → contract SIGNED + download PDF
 */

import { NextResponse } from "next/server";
import { verifyDocuSignHmac } from "@/lib/docusign/hmac";
import { downloadSignedDocument } from "@/lib/docusign/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleRecipientCompleted } from "./recipient-handler";

interface DocuSignEvent {
  event: string;
  data?: {
    envelopeId?: string;
    recipientEvents?: { routingOrder?: string; status?: string }[];
  };
}

interface ContractRow {
  id: string;
  supplier_id: string;
  status: string;
  document_url: string | null;
  provider_metadata: Record<string, unknown> | null;
}

async function downloadAndStorePdf(
  envelopeId: string,
  contractId: string,
  supplierId: string,
): Promise<void> {
  const adminClient = createAdminClient();
  const storagePath = `${supplierId}/${contractId}.pdf`;
  const pdfBuffer = await downloadSignedDocument(envelopeId);

  const { error: uploadError } = await adminClient.storage
    .from("signed-contracts")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  await adminClient
    .from("contracts")
    .update({ document_url: storagePath })
    .eq("id", contractId);
}

async function savePdfError(row: ContractRow, detail: string): Promise<void> {
  const adminClient = createAdminClient();
  const metadata = row.provider_metadata ?? {};
  await adminClient
    .from("contracts")
    .update({
      provider_metadata: {
        ...metadata,
        pdf_download_error: detail,
        pdf_download_error_at: new Date().toISOString(),
      },
    })
    .eq("id", row.id);
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-docusign-signature-1");
  const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;

  if (
    !signature ||
    !secret ||
    !verifyDocuSignHmac(payload, signature, secret)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event: DocuSignEvent = JSON.parse(payload);
  const envelopeId = event.data?.envelopeId;

  // Handle recipient-completed (supplier signed → extraction)
  if (event.event === "recipient-completed") {
    if (!envelopeId) {
      return NextResponse.json({ message: "No envelope" });
    }
    return handleRecipientCompleted(envelopeId, event);
  }

  // Only process envelope-completed
  if (event.event !== "envelope-completed") {
    return NextResponse.json({ message: "Event ignored" });
  }

  if (!envelopeId) {
    return NextResponse.json({ error: "Missing envelopeId" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: contract, error: findError } = await adminClient
    .from("contracts")
    .select("id, supplier_id, status, document_url, provider_metadata")
    .eq("signature_request_id", envelopeId)
    .single();

  if (findError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const row = contract as ContractRow;

  // Idempotency: both tables already SIGNED
  if (row.status === "SIGNED") {
    const { data: supplier } = await adminClient
      .from("suppliers")
      .select("status")
      .eq("id", row.supplier_id)
      .single();

    if (supplier?.status === "SIGNED") {
      if (row.document_url) {
        return NextResponse.json({ message: "Already processed" });
      }
      try {
        await downloadAndStorePdf(envelopeId, row.id, row.supplier_id);
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : "Unknown PDF error";
        await savePdfError(row, detail);
      }
      return NextResponse.json({ success: true });
    }
  }

  // Update contract → SIGNED
  if (row.status !== "SIGNED") {
    const { error: updateErr } = await adminClient
      .from("contracts")
      .update({ status: "SIGNED", signed_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "SENT");

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to update contract" },
        { status: 500 },
      );
    }
  }

  // Update supplier → SIGNED (with rollback on failure)
  const { error: supplierErr } = await adminClient
    .from("suppliers")
    .update({ status: "SIGNED" })
    .eq("id", row.supplier_id);

  if (supplierErr) {
    await adminClient
      .from("contracts")
      .update({ status: "SENT" })
      .eq("id", row.id);
    return NextResponse.json(
      { error: "Failed to update supplier" },
      { status: 500 },
    );
  }

  // Download signed PDF (non-critical)
  try {
    await downloadAndStorePdf(envelopeId, row.id, row.supplier_id);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown PDF error";
    await savePdfError(row, detail);
  }

  return NextResponse.json({ success: true, processed_contract_id: row.id });
}
