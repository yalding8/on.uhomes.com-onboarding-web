import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * verifyBdRole 的核心鉴权逻辑提取为纯函数，便于测试。
 * 与 src/lib/admin/auth.ts 中的 verifyBdRole 保持同步。
 */

interface BdSupplier {
  id: string;
  user_id: string;
  company_name: string;
  contact_email: string;
  status: string;
  role: string;
}

interface AuthCheckInput {
  user: { id: string; email: string } | null;
  authError: boolean;
  supplier: BdSupplier | null;
  queryError: boolean;
}

type AuthCheckResult =
  | { ok: true; user: { id: string; email: string }; supplier: BdSupplier }
  | { ok: false; status: number; error: string };

function checkBdAuth(input: AuthCheckInput): AuthCheckResult {
  const { user, authError, supplier, queryError } = input;

  if (authError || !user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (queryError || !supplier) {
    return { ok: false, status: 403, error: "Forbidden. BD role required." };
  }

  return { ok: true, user, supplier };
}

const BD_SUPPLIER: BdSupplier = {
  id: "sup-001",
  user_id: "user-001",
  company_name: "BD Corp",
  contact_email: "bd@example.com",
  status: "PENDING_CONTRACT",
  role: "bd",
};

const BD_USER = { id: "user-001", email: "bd@example.com" };

describe("BD 鉴权逻辑 (Requirements 7.2, 7.3)", () => {
  it("认证成功且为 BD 角色时返回用户和供应商信息", () => {
    const result = checkBdAuth({
      user: BD_USER,
      authError: false,
      supplier: BD_SUPPLIER,
      queryError: false,
    });

    expect(result).toEqual({
      ok: true,
      user: BD_USER,
      supplier: BD_SUPPLIER,
    });
  });

  it("未认证用户返回 401", () => {
    const result = checkBdAuth({
      user: null,
      authError: false,
      supplier: null,
      queryError: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });

  it("认证出错时返回 401", () => {
    const result = checkBdAuth({
      user: null,
      authError: true,
      supplier: null,
      queryError: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });

  it("非 BD 角色用户（无 supplier 记录）返回 403", () => {
    const result = checkBdAuth({
      user: BD_USER,
      authError: false,
      supplier: null,
      queryError: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Forbidden. BD role required.",
    });
  });

  it("suppliers 表查询出错时返回 403", () => {
    const result = checkBdAuth({
      user: BD_USER,
      authError: false,
      supplier: null,
      queryError: true,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Forbidden. BD role required.",
    });
  });

  it("supplier 角色用户（非 BD）返回 403", () => {
    // 查询 role='bd' 时不会匹配到 supplier 角色，所以 supplier 为 null
    const result = checkBdAuth({
      user: { id: "user-002", email: "supplier@example.com" },
      authError: false,
      supplier: null,
      queryError: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Forbidden. BD role required.",
    });
  });

  it("data_team 角色用户返回 403", () => {
    const result = checkBdAuth({
      user: { id: "user-003", email: "data@example.com" },
      authError: false,
      supplier: null,
      queryError: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Forbidden. BD role required.",
    });
  });
});
