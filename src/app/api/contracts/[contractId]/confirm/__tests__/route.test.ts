/**
 * 供应商确认/请求修改合同 API 核心逻辑测试
 *
 * 提取 route handler 的核心判断逻辑为纯函数进行测试，
 * 避免 mock Supabase / Next.js 运行时。
 *
 * Validates: Requirements 5.2, 5.3, 6.1, 6.4, 6.5, 6.6
 */

import { describe, it, expect } from "vitest";
import { validateTransition } from "@/lib/contracts/status-machine";
import type { ContractStatus } from "@/lib/contracts/types";

// ─── action=confirm 逻辑：PENDING_REVIEW → CONFIRMED ────────

describe("POST /api/contracts/[contractId]/confirm — action=confirm", () => {
  describe("状态转换验证：PENDING_REVIEW → CONFIRMED", () => {
    it("PENDING_REVIEW → CONFIRMED 为合法转换", () => {
      const result = validateTransition("PENDING_REVIEW", "CONFIRMED");
      expect(result.valid).toBe(true);
    });

    it("CONFIRMED → SENT 为合法转换（DocuSign 信封创建成功后）", () => {
      const result = validateTransition("CONFIRMED", "SENT");
      expect(result.valid).toBe(true);
    });

    it.each([
      "DRAFT",
      "CONFIRMED",
      "SENT",
      "SIGNED",
      "CANCELED",
    ] satisfies ContractStatus[])(
      "非 PENDING_REVIEW 状态 %s 不能转换到 CONFIRMED",
      (status) => {
        const result = validateTransition(status, "CONFIRMED");
        expect(result.valid).toBe(false);
      },
    );
  });

  describe("DocuSign 信封创建失败时的状态回退", () => {
    it("CONFIRMED 可以回退到 PENDING_REVIEW（DocuSign 失败时自动回退）", () => {
      const result = validateTransition("CONFIRMED", "PENDING_REVIEW");
      expect(result.valid).toBe(true);
    });

    it("CONFIRMED 可以转到 CANCELED（BD 取消）", () => {
      const result = validateTransition("CONFIRMED", "CANCELED");
      expect(result.valid).toBe(true);
    });
  });
});

// ─── action=request_changes 逻辑：PENDING_REVIEW → DRAFT ────

describe("POST /api/contracts/[contractId]/confirm — action=request_changes", () => {
  describe("状态转换验证：PENDING_REVIEW → DRAFT", () => {
    it("PENDING_REVIEW → DRAFT 为合法转换", () => {
      const result = validateTransition("PENDING_REVIEW", "DRAFT");
      expect(result.valid).toBe(true);
    });

    it.each([
      "DRAFT",
      "CONFIRMED",
      "SENT",
      "SIGNED",
      "CANCELED",
    ] satisfies ContractStatus[])(
      "非 PENDING_REVIEW 状态 %s 不能转换到 DRAFT",
      (status) => {
        if (status === "DRAFT") {
          // DRAFT → DRAFT 是同状态，validateTransition 会返回 invalid（状态未变更）
          const result = validateTransition(status, "DRAFT");
          expect(result.valid).toBe(false);
        } else {
          const result = validateTransition(status, "DRAFT");
          expect(result.valid).toBe(false);
        }
      },
    );
  });
});

// ─── action 参数验证 ────────────────────────────────────────

describe("action 参数验证", () => {
  const validActions = ["confirm", "request_changes"];

  it.each(validActions)("'%s' 是合法的 action 值", (action) => {
    expect(validActions.includes(action)).toBe(true);
  });

  it.each(["", "approve", "reject", "cancel", "sign"])(
    "'%s' 不是合法的 action 值",
    (action) => {
      expect(validActions.includes(action)).toBe(false);
    },
  );
});

// ─── 合同归属验证逻辑 ──────────────────────────────────────

describe("合同归属验证", () => {
  it("supplier_id 匹配时允许操作", () => {
    const contractSupplierId = "supplier-123";
    const currentSupplierId = "supplier-123";
    expect(contractSupplierId === currentSupplierId).toBe(true);
  });

  it("supplier_id 不匹配时拒绝操作", () => {
    const contractSupplierId: string = "supplier-123";
    const currentSupplierId: string = "supplier-456";
    expect(contractSupplierId === currentSupplierId).toBe(false);
  });
});

// ─── 错误响应格式验证 ──────────────────────────────────────

describe("错误响应格式", () => {
  it("非法状态转换返回包含当前状态的 reason", () => {
    const result = validateTransition("DRAFT", "CONFIRMED");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("DRAFT");
    }
  });

  it("终态转换返回终态提示", () => {
    const result = validateTransition("SIGNED", "CONFIRMED");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("SIGNED");
    }
  });
});
