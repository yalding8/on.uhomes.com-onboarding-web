/**
 * Contract Preview PDF — GET /api/contracts/[contractId]/preview-pdf
 *
 * P2-G2: Generate a PDF preview of the contract fields.
 * If a custom uploaded PDF exists, redirects to it.
 * Otherwise generates a branded PDF from contract_fields.
 *
 * Auth: Supabase Session (supplier or BD)
 */

import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { contractId } = await context.params;

    const { data: contract, error } = await admin
      .from("contracts")
      .select("id, supplier_id, contract_fields, uploaded_document_url")
      .eq("id", contractId)
      .single();

    if (error || !contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // Verify ownership: supplier owns it or user is BD
    const { data: supplier } = await admin
      .from("suppliers")
      .select("id, user_id, role, company_name")
      .eq("id", contract.supplier_id)
      .single();

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }

    const { data: currentSupplier } = await admin
      .from("suppliers")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const isOwner = supplier.user_id === user.id;
    const isBd = currentSupplier?.role === "bd";

    if (!isOwner && !isBd) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If custom PDF uploaded, return its URL
    const uploadedUrl = contract.uploaded_document_url as string | null;
    if (uploadedUrl) {
      return NextResponse.json({ pdfUrl: uploadedUrl, source: "uploaded" });
    }

    // Generate simple HTML-based preview (no @react-pdf/renderer dependency)
    const fields = (contract.contract_fields ?? {}) as Record<string, unknown>;
    const companyName = (supplier.company_name as string) ?? "Supplier";
    const html = buildContractHtml(companyName, fields);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[preview-pdf]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function buildContractHtml(
  companyName: string,
  fields: Record<string, unknown>,
): string {
  const fieldRows = Object.entries(fields)
    .map(
      ([key, val]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;color:#222;border-bottom:1px solid #eee;">${esc(key)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${esc(String(val ?? "—"))}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Contract Preview</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;padding:32px 24px;">
  <div style="border-bottom:3px solid #FF5A5F;padding-bottom:16px;margin-bottom:24px;">
    <span style="font-weight:700;font-size:18px;color:#FF5A5F;">uhomes.com</span>
    <span style="font-weight:700;font-size:18px;color:#222;margin-inline-start:8px;">Partnership Agreement</span>
  </div>
  <h2 style="font-size:20px;color:#222;margin:0 0 8px;">Contract Preview</h2>
  <p style="color:#666;font-size:14px;margin:0 0 24px;">Partner: ${esc(companyName)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;color:#555;">
    ${fieldRows || '<tr><td style="padding:8px;color:#999;">No contract fields defined yet.</td></tr>'}
  </table>
  <p style="margin-top:32px;font-size:12px;color:#999;">This is a preview. The final contract will be sent via DocuSign for signing.</p>
</body></html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
