/**
 * Role Resolver — 从 suppliers 表查询当前用户角色。
 * 用于 API 路由和页面组件中的权限判断。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "supplier" | "bd" | "data_team";

export interface RoleInfo {
  role: UserRole;
  supplierId: string;
}

/**
 * 查询当前登录用户的角色和 supplier ID。
 * 如果用户没有 supplier 记录，返回 null。
 */
export async function getCurrentUserRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<RoleInfo | null> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, role")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    role: (data.role ?? "supplier") as UserRole,
    supplierId: data.id,
  };
}
