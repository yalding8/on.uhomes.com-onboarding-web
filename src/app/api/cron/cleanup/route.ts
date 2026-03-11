/**
 * Cron Cleanup Job — GET /api/cron/cleanup
 *
 * Runs periodically (recommended: every 15 minutes) to handle:
 * 1. CONVERTING timeout: reset stale CONVERTING applications back to PENDING
 * 2. DocuSign expiry: flag SENT contracts older than 30 days
 * 3. Deletion execution: process DELETION_PENDING suppliers past cooling period
 * 4. Signing state repair: fix suppliers stuck in PENDING_CONTRACT after
 *    successful DocuSign signing (webhook failure fallback)
 *
 * Auth: CRON_SECRET header check (set in Vercel Cron config)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CRON_SECRET = process.env.CRON_SECRET;

/** CONVERTING applications older than 10 minutes are considered stuck */
const CONVERTING_TIMEOUT_MINUTES = 10;

/** SENT contracts older than 30 days are flagged as potentially expired */
const DOCUSIGN_EXPIRY_DAYS = 30;

function verifyCronAuth(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results: Record<string, unknown> = {};

  // 1. Reset stale CONVERTING applications
  const convertingCutoff = new Date(
    Date.now() - CONVERTING_TIMEOUT_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: staleApps, error: appsErr } = await admin
    .from("applications")
    .update({ status: "PENDING" })
    .eq("status", "CONVERTING")
    .lt("updated_at", convertingCutoff)
    .select("id");

  results.converting_reset = appsErr
    ? { error: appsErr.message }
    : { count: staleApps?.length ?? 0 };

  // 2. Flag expired SENT contracts (older than 30 days)
  const expiryCutoff = new Date(
    Date.now() - DOCUSIGN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: expiredContracts, error: contractsErr } = await admin
    .from("contracts")
    .select("id, supplier_id, updated_at, provider_metadata")
    .eq("status", "SENT")
    .lt("updated_at", expiryCutoff);

  if (!contractsErr && expiredContracts && expiredContracts.length > 0) {
    // Add expiry warning to provider_metadata (skip already-flagged)
    for (const c of expiredContracts) {
      const meta = c.provider_metadata as Record<string, unknown> | null;
      if (meta?.signing_expired === true) continue;

      await admin
        .from("contracts")
        .update({
          provider_metadata: {
            ...((meta ?? {}) as Record<string, unknown>),
            signing_expired: true,
            expired_at: new Date().toISOString(),
            original_sent_at: c.updated_at,
          },
        })
        .eq("id", c.id)
        .eq("status", "SENT");
    }
  }

  results.docusign_expired = contractsErr
    ? { error: contractsErr.message }
    : { count: expiredContracts?.length ?? 0 };

  // 3. Execute deletions past cooling period
  const now = new Date().toISOString();
  const { data: dueForDeletion, error: deletionErr } = await admin
    .from("suppliers")
    .select("id, contact_email")
    .eq("status", "DELETION_PENDING")
    .lt("deletion_scheduled_at", now);

  if (!deletionErr && dueForDeletion && dueForDeletion.length > 0) {
    const { executeDeletion } =
      await import("@/lib/compliance/account-deletion");
    let deleted = 0;
    const errors: string[] = [];

    for (const supplier of dueForDeletion) {
      try {
        // Determine country from application or default to non-AU
        const { data: app } = await admin
          .from("applications")
          .select("country")
          .eq("contact_email", supplier.contact_email)
          .single();
        const countryCode = app?.country ?? "UNKNOWN";

        await executeDeletion(admin, supplier.id, countryCode);
        deleted++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${supplier.id}: ${msg}`);
        console.error("[cron/cleanup] deletion failed", supplier.id, err);
      }
    }

    results.deletions = { executed: deleted, errors };
  } else {
    results.deletions = deletionErr
      ? { error: deletionErr.message }
      : { count: 0 };
  }

  // 4. Repair suppliers stuck in PENDING_CONTRACT after successful signing
  // This catches cases where the DocuSign webhook failed to update supplier status
  const { data: stuckSuppliers, error: stuckErr } = await admin
    .from("contracts")
    .select("id, supplier_id, status")
    .eq("status", "SIGNED");

  if (!stuckErr && stuckSuppliers && stuckSuppliers.length > 0) {
    let repaired = 0;
    for (const c of stuckSuppliers) {
      const { data: supplier } = await admin
        .from("suppliers")
        .select("id, status")
        .eq("id", c.supplier_id)
        .single();

      if (supplier && supplier.status === "PENDING_CONTRACT") {
        const { error: repairErr } = await admin
          .from("suppliers")
          .update({ status: "SIGNED" })
          .eq("id", supplier.id)
          .eq("status", "PENDING_CONTRACT");

        if (repairErr) {
          console.error("[cron/cleanup] signing repair failed", repairErr);
        } else {
          console.error("[cron/cleanup] repaired stuck supplier", supplier.id);
          repaired++;
        }
      }
    }
    results.signing_repair = { repaired };
  } else {
    results.signing_repair = stuckErr
      ? { error: stuckErr.message }
      : { count: 0 };
  }

  return NextResponse.json({ ok: true, results });
}
