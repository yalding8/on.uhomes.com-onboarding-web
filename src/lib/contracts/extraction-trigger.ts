/**
 * Extraction trigger helper — fires extraction after contract Confirm.
 *
 * Non-blocking: errors are captured via Sentry, never thrown.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/security/sentry";

interface TriggerResult {
  triggered: number;
  skipped: boolean;
}

/**
 * Trigger extraction for all buildings belonging to a supplier.
 * Called after Confirm action succeeds (contract SENT).
 *
 * At this stage we do NOT have a signed PDF yet — only website_crawl
 * and other sources are triggered. The contract_pdf source is
 * triggered later by recipient-handler after DocuSign signing.
 */
export async function triggerExtractionAfterConfirm(
  supplierId: string,
): Promise<TriggerResult> {
  try {
    const admin = createAdminClient();

    const { data: buildings } = await admin
      .from("buildings")
      .select("id")
      .eq("supplier_id", supplierId);

    if (!buildings || buildings.length === 0) {
      return { triggered: 0, skipped: true };
    }

    const { data: supplierRow } = await admin
      .from("suppliers")
      .select("website_url")
      .eq("id", supplierId)
      .single();

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? "https://on.pylospay.com";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    let triggered = 0;
    for (const b of buildings) {
      try {
        await fetch(`${baseUrl}/api/extraction/trigger`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            buildingId: b.id,
            supplierId,
            websiteUrl: (supplierRow?.website_url as string) ?? undefined,
          }),
        });
        triggered++;
      } catch (err) {
        captureError("confirm.extraction_trigger", err);
      }
    }

    return { triggered, skipped: false };
  } catch (err) {
    captureError("confirm.extraction_trigger", err);
    return { triggered: 0, skipped: true };
  }
}
