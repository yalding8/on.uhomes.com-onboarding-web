/**
 * 手动邀请供应商 API — BD 直接邀请（不依赖 application）
 *
 * POST /api/admin/invite-supplier
 * 鉴权：Session-based，验证 role='bd'
 *
 * Requirements: 8.2, 8.3, 8.4
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InvitePayload {
  email: string;
  company_name: string;
  phone?: string;
  city?: string;
  website?: string;
}

function validatePayload(
  payload: Record<string, unknown>,
): { valid: true; data: InvitePayload } | { valid: false; error: string } {
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const companyName =
    typeof payload.company_name === "string"
      ? payload.company_name.trim()
      : "";

  if (!email) {
    return { valid: false, error: "邮箱为必填项" };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: "邮箱格式不合法" };
  }
  if (!companyName) {
    return { valid: false, error: "公司名称为必填项" };
  }

  return {
    valid: true,
    data: {
      email,
      company_name: companyName,
      phone:
        typeof payload.phone === "string" ? payload.phone.trim() || undefined : undefined,
      city:
        typeof payload.city === "string" ? payload.city.trim() || undefined : undefined,
      website:
        typeof payload.website === "string" ? payload.website.trim() || undefined : undefined,
    },
  };
}

export async function POST(request: Request) {
  try {
    // 1. BD 鉴权
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const payload = await request.json();
    const validation = validatePayload(payload);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { email, company_name, phone, city, website } = validation.data;

    // 2. Admin Client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 3. 检查邮箱是否已存在于 suppliers 表
    const { data: existing } = await supabaseAdmin
      .from("suppliers")
      .select("id")
      .eq("contact_email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "该邮箱已注册为供应商" },
        { status: 409 },
      );
    }

    // 4. 创建 Auth 用户
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: "Failed to create auth user", details: authError?.message },
        { status: 500 },
      );
    }
    const userId = authUser.user.id;

    // 5. 插入 suppliers 记录
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from("suppliers")
      .insert({
        user_id: userId,
        company_name,
        contact_email: email,
        contact_phone: phone ?? null,
        city: city ?? null,
        website: website ?? null,
        status: "PENDING_CONTRACT",
      })
      .select()
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        {
          error: "Failed to create supplier record",
          details: supplierError?.message,
        },
        { status: 500 },
      );
    }

    // 6. 插入 contracts 记录
    const signatureRequestId = crypto.randomUUID();
    const { error: contractError } = await supabaseAdmin
      .from("contracts")
      .insert({
        supplier_id: supplier.id,
        status: "SENT",
        signature_provider: "OPENSIGN",
        signature_request_id: signatureRequestId,
        embedded_signing_url: `https://mock.opensign.net/sign/${signatureRequestId}?test=true`,
        provider_metadata: {
          type: "STANDARD_PROMOTION_2026",
          source: "manual_invite",
        },
      });

    if (contractError) {
      return NextResponse.json(
        {
          error: "Failed to create contract record",
          details: contractError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "供应商邀请已发送",
      supplier_id: supplier.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
