/**
 * BD 合同字段保存与推送审阅 API
 *
 * PUT  /api/admin/contracts/[contractId] — 保存合同字段（仅 DRAFT 状态）
 * POST /api/admin/contracts/[contractId] — 推送审阅（DRAFT → PENDING_REVIEW）
 *
 * 鉴权：Session-based，验证 role='bd'
 *
 * Requirements: 3.4, 4.1, 4.2, 4.3
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { validateContractFields } from "@/lib/contracts/field-validation";
import { validateTransition } from "@/lib/contracts/status-machine";
import type { ContractFields, ContractStatus } from "@/lib/contracts/types";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

/** 创建 service-role Supabase 客户端 */
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface ContractData {
  id: string;
  supplier_id: string;
  status: ContractStatus;
  contract_fields: Partial<ContractFields> | null;
}

type FetchContractResult =
  | { contract: ContractData; errorResponse: null }
  | { contract: null; errorResponse: NextResponse };

/**
 * 查询合同记录，返回合同数据或错误 Response
 */
async function fetchContract(
  supabase: { from: ReturnType<typeof createClient>["from"] },
  contractId: string,
): Promise<FetchContractResult> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, supplier_id, status, contract_fields")
    .eq("id", contractId)
    .single();

  if (error || !data) {
    return {
      contract: null,
      errorResponse: NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      ),
    };
  }

  return { contract: data as ContractData, errorResponse: null };
}

/**
 * PUT: 保存合同字段到 contract_fields（仅 DRAFT 状态）
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    // 1. BD 鉴权
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const { contractId } = await context.params;
    const supabaseAdmin = createAdminClient();

    // 2. 查询合同
    const { contract, errorResponse } = await fetchContract(
      supabaseAdmin,
      contractId,
    );
    if (errorResponse) return errorResponse;

    // 3. 验证状态为 DRAFT
    if (contract.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Cannot perform action on contract with status: ${contract.status}`,
        },
        { status: 400 },
      );
    }

    // 4. 解析并保存字段数据
    const body = (await request.json()) as { fields: Partial<ContractFields> };
    const fields = body.fields;

    if (!fields || typeof fields !== "object") {
      return NextResponse.json(
        { error: "Request body must contain a 'fields' object" },
        { status: 400 },
      );
    }

    // 5. 更新 contract_fields
    const { error: updateError } = await supabaseAdmin
      .from("contracts")
      .update({ contract_fields: fields })
      .eq("id", contractId);

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to save contract fields",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: "合同字段已保存" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: 推送审阅（DRAFT → PENDING_REVIEW）
 * 验证所有必填字段完整后更新状态
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    // 1. BD 鉴权
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const { contractId } = await context.params;
    const supabaseAdmin = createAdminClient();

    // 2. 查询合同
    const { contract, errorResponse } = await fetchContract(
      supabaseAdmin,
      contractId,
    );
    if (errorResponse) return errorResponse;

    // 3. 验证状态转换合法性
    const transition = validateTransition(contract.status, "PENDING_REVIEW");
    if (!transition.valid) {
      return NextResponse.json(
        {
          error: `Cannot perform action on contract with status: ${contract.status}`,
        },
        { status: 400 },
      );
    }

    // 4. 验证所有必填字段已填写完整
    const fields = (contract.contract_fields ?? {}) as Partial<ContractFields>;
    const validation = validateContractFields(fields);

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", fields: validation.errors },
        { status: 400 },
      );
    }

    // 5. 更新状态为 PENDING_REVIEW
    const { error: updateError } = await supabaseAdmin
      .from("contracts")
      .update({ status: "PENDING_REVIEW" })
      .eq("id", contractId);

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to update contract status",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "合同已推送审阅",
      status: "PENDING_REVIEW",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
