/**
 * 供应商确认/请求修改合同 API — POST /api/contracts/[contractId]/confirm
 *
 * action=confirm:  PENDING_REVIEW → CONFIRMED → DocuSign 创建信封 → SENT
 * action=request_changes: PENDING_REVIEW → DRAFT
 *
 * 鉴权：Supabase Session + 合同归属验证 | Requirements: 5.2, 5.3, 6.1, 6.4, 6.5, 6.6
 */

import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { validateTransition } from "@/lib/contracts/status-machine";
import { createEnvelope } from "@/lib/docusign/client";
import type { ContractFields, ContractStatus } from "@/lib/contracts/types";

type Action = "confirm" | "request_changes";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

interface ContractRow {
  id: string;
  supplier_id: string;
  status: ContractStatus;
  contract_fields: ContractFields | null;
}

interface SupplierRow {
  id: string;
  contact_email: string;
  company_name: string;
}

/** service-role 客户端，用于跨 RLS 操作 */
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * 验证当前用户身份，返回其关联的 supplier 记录。
 * 失败时返回对应的错误 Response。
 */
async function authenticateSupplier(): Promise<
  | { supplier: SupplierRow; error: null }
  | { supplier: null; error: NextResponse }
> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supplier: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const adminClient = getAdminClient();
  const { data: supplier, error: dbError } = await adminClient
    .from("suppliers")
    .select("id, contact_email, company_name")
    .eq("user_id", user.id)
    .single();

  if (dbError || !supplier) {
    return {
      supplier: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { supplier: supplier as SupplierRow, error: null };
}

/**
 * 查询合同记录并验证归属关系
 */
async function fetchAndVerifyContract(
  contractId: string,
  supplierId: string,
): Promise<
  | { contract: ContractRow; error: null }
  | { contract: null; error: NextResponse }
> {
  const adminClient = getAdminClient();
  const { data, error: dbError } = await adminClient
    .from("contracts")
    .select("id, supplier_id, status, contract_fields")
    .eq("id", contractId)
    .single();

  if (dbError || !data) {
    return {
      contract: null,
      error: NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      ),
    };
  }

  const contract = data as ContractRow;

  if (contract.supplier_id !== supplierId) {
    return {
      contract: null,
      error: NextResponse.json(
        { error: "Contract does not belong to current user" },
        { status: 403 },
      ),
    };
  }

  return { contract, error: null };
}

/**
 * 处理 action=confirm：PENDING_REVIEW → CONFIRMED → DocuSign 创建信封 → SENT
 */
async function handleConfirm(
  contract: ContractRow,
  supplier: SupplierRow,
): Promise<NextResponse> {
  const adminClient = getAdminClient();

  // 1. 验证状态转换 PENDING_REVIEW → CONFIRMED
  const toConfirmed = validateTransition(contract.status, "CONFIRMED");
  if (!toConfirmed.valid) {
    return NextResponse.json(
      {
        error: `Cannot perform action on contract with status: ${contract.status}`,
      },
      { status: 400 },
    );
  }

  // 2. 更新状态为 CONFIRMED
  const { error: confirmError } = await adminClient
    .from("contracts")
    .update({ status: "CONFIRMED" })
    .eq("id", contract.id);

  if (confirmError) {
    return NextResponse.json(
      { error: "Failed to update contract status" },
      { status: 500 },
    );
  }

  // 3. 调用 DocuSign 创建信封
  const fields = contract.contract_fields;
  if (!fields) {
    return NextResponse.json(
      { error: "Contract fields are missing" },
      { status: 400 },
    );
  }

  try {
    const { envelopeId } = await createEnvelope(
      supplier.contact_email,
      supplier.company_name,
      fields,
    );

    // 4. 成功：更新状态为 SENT，存储 envelope_id，设置 signature_provider
    const { error: sentError } = await adminClient
      .from("contracts")
      .update({
        status: "SENT",
        signature_request_id: envelopeId,
        signature_provider: "DOCUSIGN",
      })
      .eq("id", contract.id);

    if (sentError) {
      return NextResponse.json(
        { error: "Failed to update contract after envelope creation" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "合同已确认，签署邮件已发送",
      status: "SENT",
      envelopeId,
    });
  } catch (err: unknown) {
    // 5. 失败：保持 CONFIRMED 状态，记录错误到 provider_metadata
    const detail =
      err instanceof Error ? err.message : "Unknown DocuSign error";
    await adminClient
      .from("contracts")
      .update({
        provider_metadata: {
          docusign_error: detail,
          docusign_error_at: new Date().toISOString(),
        },
      })
      .eq("id", contract.id);

    return NextResponse.json(
      { error: "DocuSign API error", details: detail },
      { status: 502 },
    );
  }
}

/**
 * 处理 action=request_changes：PENDING_REVIEW → DRAFT
 */
async function handleRequestChanges(
  contract: ContractRow,
): Promise<NextResponse> {
  const transition = validateTransition(contract.status, "DRAFT");
  if (!transition.valid) {
    return NextResponse.json(
      {
        error: `Cannot perform action on contract with status: ${contract.status}`,
      },
      { status: 400 },
    );
  }

  const adminClient = getAdminClient();
  const { error: updateError } = await adminClient
    .from("contracts")
    .update({ status: "DRAFT" })
    .eq("id", contract.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update contract status" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "已请求修改，合同已退回 BD 编辑",
    status: "DRAFT",
  });
}

/**
 * POST /api/contracts/[contractId]/confirm
 *
 * Body: { action: "confirm" | "request_changes" }
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    // 1. 供应商身份验证
    const authResult = await authenticateSupplier();
    if (authResult.error) return authResult.error;
    const { supplier } = authResult;

    // 2. 解析 action
    const body = (await request.json()) as { action?: string };
    const action = body.action as Action | undefined;

    if (!action || !["confirm", "request_changes"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'confirm' or 'request_changes'" },
        { status: 400 },
      );
    }

    // 3. 查询合同并验证归属
    const { contractId } = await context.params;
    const contractResult = await fetchAndVerifyContract(
      contractId,
      supplier.id,
    );
    if (contractResult.error) return contractResult.error;
    const { contract } = contractResult;

    // 4. 分发处理
    if (action === "confirm") {
      return handleConfirm(contract, supplier);
    }

    return handleRequestChanges(contract);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
