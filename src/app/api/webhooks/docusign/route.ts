/**
 * DocuSign Webhook 回调处理 — POST /api/webhooks/docusign
 *
 * 无需用户认证，通过 HMAC-SHA256 签名验证请求合法性。
 *
 * 处理 envelope-completed 事件：
 * 1. 原子更新合同 + 供应商状态 → SIGNED（含回滚保障）
 * 2. 下载签署 PDF → 上传 Supabase Storage → 保存 document_url（非核心，失败不影响主流程）
 *
 * 原子性保障策略：
 * - 若合同更新失败 → 直接返回 500，DocuSign 会重试
 * - 若供应商更新失败 → 回滚合同到 SENT，返回 500，DocuSign 会重试
 * - 幂等检查同时验证双表状态，可从部分失败中恢复
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
  document_url: string | null;
  provider_metadata: Record<string, unknown> | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * 下载签署 PDF 并上传到 Supabase Storage，保存 document_url。
 * 非核心操作，失败只记录到 provider_metadata，不影响状态更新结果。
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
    .select("id, supplier_id, status, document_url, provider_metadata")
    .eq("signature_request_id", envelopeId)
    .single();

  if (findError || !contract) {
    return NextResponse.json(
      { error: "Contract not found for envelope" },
      { status: 404 },
    );
  }

  const row = contract as ContractRow;

  // 7. 幂等性检查：同时验证双表状态，可从部分失败中恢复
  if (row.status === "SIGNED") {
    const { data: supplier } = await adminClient
      .from("suppliers")
      .select("status")
      .eq("id", row.supplier_id)
      .single();

    if (supplier?.status === "SIGNED") {
      // 两表状态均已更新 — 检查 PDF 是否也已成功保存
      if (row.document_url) {
        // 完全幂等：状态 + PDF 均已就绪
        return NextResponse.json(
          { message: "Already processed" },
          { status: 200 },
        );
      }

      // 状态已更新但 PDF 缺失（上次在步骤 3-5 失败），补偿下载
      try {
        await downloadAndStorePdf(envelopeId, row.id, row.supplier_id);
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : "Unknown PDF error";
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

      return NextResponse.json(
        { success: true, processed_contract_id: row.id },
        { status: 200 },
      );
    }
    // 合同已 SIGNED 但供应商未更新 — 部分失败恢复，跳过合同更新直接补充供应商
  }

  // 8. 更新合同状态 → SIGNED（仅在尚未 SIGNED 时执行）
  if (row.status !== "SIGNED") {
    const { error: updateContractError } = await adminClient
      .from("contracts")
      .update({
        status: "SIGNED",
        signed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateContractError) {
      // 合同更新失败，未修改任何数据，返回 500 让 DocuSign 重试
      return NextResponse.json(
        { error: "Failed to update contract status" },
        { status: 500 },
      );
    }
  }

  // 9. 更新供应商状态 → SIGNED
  //    失败时回滚合同到 SENT，确保 DocuSign 重试时能完整重走流程
  const { error: updateSupplierError } = await adminClient
    .from("suppliers")
    .update({ status: "SIGNED" })
    .eq("id", row.supplier_id);

  if (updateSupplierError) {
    // 回滚合同状态，使下次重试可以从头开始
    await adminClient
      .from("contracts")
      .update({ status: "SENT" })
      .eq("id", row.id);

    return NextResponse.json(
      { error: "Failed to update supplier status" },
      { status: 500 },
    );
  }

  // 10. 下载签署 PDF → 上传 Storage → 保存 URL（非核心，失败不影响状态）
  try {
    await downloadAndStorePdf(envelopeId, row.id, row.supplier_id);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown PDF error";
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
