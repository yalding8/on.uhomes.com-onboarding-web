/**
 * BD 鉴权辅助函数 — 供所有 /api/admin/* 路由复用。
 * 从 cookie session 验证当前用户为 BD 角色。
 */

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface BdSupplier {
  id: string;
  user_id: string;
  company_name: string;
  contact_email: string;
  status: string;
  role: string;
}

export interface BdAuthResult {
  user: User;
  supplier: BdSupplier;
}

/**
 * 验证当前请求用户是否为 BD 角色。
 *
 * 1. 创建 server Supabase client（cookie-based session）
 * 2. getUser() 获取当前认证用户
 * 3. 查询 suppliers 表验证 role='bd'
 * 4. 返回用户信息或错误 Response
 */
export async function verifyBdRole(): Promise<BdAuthResult | Response> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: supplier, error: queryError } = await supabase
    .from("suppliers")
    .select("id, user_id, company_name, contact_email, status, role")
    .eq("user_id", user.id)
    .eq("role", "bd")
    .single();

  if (queryError || !supplier) {
    return NextResponse.json(
      { error: "Forbidden. BD role required." },
      { status: 403 },
    );
  }

  return { user, supplier: supplier as BdSupplier };
}

/**
 * 类型守卫：判断 verifyBdRole 返回值是否为错误 Response。
 */
export function isBdAuthError(
  result: BdAuthResult | Response,
): result is Response {
  return result instanceof Response;
}
