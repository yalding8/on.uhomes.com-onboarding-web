/**
 * POST /api/admin/contracts/[contractId]/upload
 *
 * BD 上传非标准合同 PDF → 存入 Supabase Storage
 * 更新 contract_type = 'CUSTOM', uploaded_document_url = publicUrl
 *
 * Auth: BD role (session-based)
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "uploaded-contracts";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const { contractId } = await context.params;
    const supabaseAdmin = createAdminClient();

    // 1. 查询合同
    const { data: contract, error: contractErr } = await supabaseAdmin
      .from("contracts")
      .select("id, supplier_id, status")
      .eq("id", contractId)
      .single();

    if (contractErr || !contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    if (contract.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only upload PDF for DRAFT contracts" },
        { status: 400 },
      );
    }

    // 2. BD scoping
    if (!authResult.isAdmin) {
      const { data: target } = await supabaseAdmin
        .from("suppliers")
        .select("bd_user_id")
        .eq("id", contract.supplier_id)
        .single();
      if (target?.bd_user_id !== authResult.supplier.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 3. 读取上传的 PDF
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file in form data" },
        { status: 400 },
      );
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10 MB limit" },
        { status: 400 },
      );
    }

    // 4. 上传到 Supabase Storage
    const path = `${contract.supplier_id}/${contractId}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      console.error("[upload]", uploadErr);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    // 5. 更新合同记录
    const { error: updateErr } = await supabaseAdmin
      .from("contracts")
      .update({
        contract_type: "CUSTOM",
        uploaded_document_url: publicUrl,
      })
      .eq("id", contractId);

    if (updateErr) {
      console.error("[upload]", updateErr);
      return NextResponse.json(
        { error: "Failed to update contract" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, documentUrl: publicUrl });
  } catch (error) {
    console.error("[upload]", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
