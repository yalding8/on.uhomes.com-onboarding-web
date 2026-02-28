/**
 * Bearer token 校验
 *
 * 使用 SUPABASE_SERVICE_ROLE_KEY 作为共享密钥，
 * 验证来自主应用的请求身份。
 */

import { getConfig } from "./config.js";

export function verifyBearerToken(authHeader: string | null): boolean {
  if (!authHeader) return false;

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return token === getConfig().supabaseServiceRoleKey;
}
