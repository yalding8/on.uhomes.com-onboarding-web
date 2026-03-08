/**
 * POST /api/admin/contracts/[contractId]/extract
 *
 * 从已上传的 PDF 中提取合同字段（LLM 提取）
 * 1. 从 Supabase Storage 下载 PDF
 * 2. pdf-parse 提取文本
 * 3. LLM 提取 9 个结构化字段
 * 4. 返回提取结果（不自动保存，由前端确认后保存）
 *
 * Auth: BD role (session-based)
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractContractFields } from "@/lib/llm/extract-contract";

const BUCKET = "uploaded-contracts";

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
      .select("id, supplier_id, status, contract_type, uploaded_document_url")
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
        { error: "Can only extract fields for DRAFT contracts" },
        { status: 400 },
      );
    }

    if (!contract.uploaded_document_url) {
      return NextResponse.json(
        { error: "No PDF uploaded for this contract" },
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

    // 3. 从 Storage 下载 PDF
    const path = `${contract.supplier_id}/${contractId}.pdf`;
    const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(path);

    if (downloadErr || !fileData) {
      console.error("[extract]", downloadErr);
      return NextResponse.json(
        { error: "Failed to download PDF" },
        { status: 500 },
      );
    }

    // 4. 提取 PDF 文本 (dynamic import to avoid pdf-parse test file side-effect)
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const pdfParse = (await import("pdf-parse")).default;
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    if (!text.trim()) {
      return NextResponse.json(
        { error: "PDF contains no extractable text (scanned document?)" },
        { status: 422 },
      );
    }

    // 5. LLM 提取结构化字段
    const result = await extractContractFields(text);

    return NextResponse.json({
      success: true,
      fields: result.fields,
      provider: result.provider,
    });
  } catch (error) {
    console.error("[extract]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
