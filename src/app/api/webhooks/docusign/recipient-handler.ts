/**
 * DocuSign recipient-completed handler.
 *
 * When the supplier (routing_order=1) signs:
 * 1. Record supplier_signed_at in provider_metadata
 * 2. Update supplier.status → SIGNED
 * 3. Trigger data extraction for supplier's buildings
 *
 * Does NOT change contract.status (stays SENT until envelope-completed).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface DocuSignRecipient {
  routingOrder?: string;
  email?: string;
  status?: string;
}

interface DocuSignEvent {
  data?: {
    recipientEvents?: DocuSignRecipient[];
  };
}

export async function handleRecipientCompleted(
  envelopeId: string,
  event: DocuSignEvent,
): Promise<NextResponse> {
  // Check if the recipient is the supplier (routing_order = 1)
  const recipients = event.data?.recipientEvents ?? [];
  const isSupplier = recipients.some(
    (r) => r.routingOrder === "1" && r.status === "completed",
  );
  if (!isSupplier) {
    return NextResponse.json({ message: "Non-supplier recipient" });
  }

  const adminClient = createAdminClient();

  const { data: contract } = await adminClient
    .from("contracts")
    .select("id, supplier_id, provider_metadata")
    .eq("signature_request_id", envelopeId)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const metadata =
    (contract.provider_metadata as Record<string, unknown>) ?? {};

  // Idempotency: skip if already processed
  if (metadata.supplier_signed_at) {
    return NextResponse.json({ message: "Already processed" });
  }

  // Record supplier_signed_at
  await adminClient
    .from("contracts")
    .update({
      provider_metadata: {
        ...metadata,
        supplier_signed_at: new Date().toISOString(),
      },
    })
    .eq("id", contract.id);

  // Update supplier status → SIGNED
  const { error: supplierErr } = await adminClient
    .from("suppliers")
    .update({ status: "SIGNED" })
    .eq("id", contract.supplier_id);

  if (supplierErr) {
    console.error("[docusign] supplier update failed", supplierErr);
  }

  // Trigger extraction for supplier's buildings (non-blocking)
  try {
    const { data: buildings } = await adminClient
      .from("buildings")
      .select("id")
      .eq("supplier_id", contract.supplier_id);

    if (buildings && buildings.length > 0) {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ?? "https://on.pylospay.com";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

      for (const building of buildings) {
        fetch(`${baseUrl}/api/extraction/trigger`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ building_id: building.id }),
        }).catch((err) =>
          console.error("[docusign] extraction trigger failed", err),
        );
      }
    }
  } catch (err) {
    console.error("[docusign] extraction trigger error", err);
  }

  return NextResponse.json({
    success: true,
    message: "Supplier signed, extraction triggered",
  });
}
