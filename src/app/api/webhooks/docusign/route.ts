/**
 * DocuSign Webhook 回调处理 — POST /api/webhooks/docusign
 *
 * 无需用户认证，通过 HMAC-SHA256 签名验证请求合法性。
 *
 * 处理 envelope-completed 事件：
 * 1. 更新合同状态 → SIGNED + signed_at
 * 2. 更新供应商状态 → SIGNED
 * 3. 下载签署 PDF → 上传 Supabase Storage → 保存 document_url
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 8.1, 8.2, 8.3, 8.6
 */

import { NextResponse } from "next/server";
import { verifyDocuSignHmac } from "@/lib/docusign/hmac";
import { downloadSignedDocument } from "@/lib/docusign/client";
import { createAdminClient } from "@/lib/supabase/admin";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DocuSignEvent {
  event: string;
  data?: {
    envelopeId?: string;
  };
}

interface ContractRow {
  id: string;
  supplier_id: string;
  status: string;
  provider_metadata: Record<string, unknown> | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * 下载签署 PDF 并上传到 Supabase Storage，保存 document_url。
 * 此操作为非核心操作，失败不影响合同/供应商状态更新。
 */
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

  const { data: urlData } = adminClient.storage
    .from("signed-contracts")
    .getPublicUrl(storagePath);

  await adminClient
    .from("contracts")
    .update({ document_url: urlData.publicUrl })
    .eq("id", contractId);
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  // 1. 读取原始请求体和 HMAC 签名
  const payload = await request.text();
  const signature = request.headers.get("x-docusign-signature-1");

  // 2. HMAC 签名验证
  const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
  if (
    !signature ||
    !secret ||
    !verifyDocuSignHmac(payload, signature, secret)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. 解析事件
  const event: DocuSignEvent = JSON.parse(payload);

  // 4. 仅处理 envelope-completed 事件
  if (event.event !== "envelope-completed") {
    return NextResponse.json({ message: "Event ignored" }, { status: 200 });
  }

  // 5. 提取 envelope_id
  const envelopeId = event.data?.envelopeId;
  if (!envelopeId) {
    return NextResponse.json(
      { error: "Missing envelopeId in event data" },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();

  // 6. 通过 envelope_id 查找合同
  const { data: contract, error: findError } = await adminClient
    .from("contracts")
    .select("id, supplier_id, status, provider_metadata")
    .eq("signature_request_id", envelopeId)
    .single();

  if (findError || !contract) {
    return NextResponse.json(
      { error: "Contract not found for envelope" },
      { status: 404 },
    );
  }

  const row = contract as ContractRow;

  // 7. 幂等性：已签署合同不重复处理
  if (row.status === "SIGNED") {
    return NextResponse.json({ message: "Already processed" }, { status: 200 });
  }

  // 8. 更新合同状态 → SIGNED + signed_at（核心操作）
  const { error: updateContractError } = await adminClient
    .from("contracts")
    .update({
      status: "SIGNED",
      signed_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateContractError) {
    return NextResponse.json(
      { error: "Failed to update contract status" },
      { status: 500 },
    );
  }

  // 9. 更新供应商状态 → SIGNED（核心操作）
  const { error: updateSupplierError } = await adminClient
    .from("suppliers")
    .update({ status: "SIGNED" })
    .eq("id", row.supplier_id);

  if (updateSupplierError) {
    return NextResponse.json(
      { error: "Failed to update supplier status" },
      { status: 500 },
    );
  }

  // 10. 下载签署 PDF → 上传 Storage → 保存 URL（非核心操作，失败不影响状态）
  try {
    await downloadAndStorePdf(envelopeId, row.id, row.supplier_id);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown PDF error";
    // 记录错误到 provider_metadata，不影响 webhook 返回
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

  return NextResponse.json({
    success: true,
    processed_contract_id: row.id,
  });
}
