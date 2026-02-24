/**
 * BD 合同字段保存与推送审阅 API 核心逻辑测试
 *
 * 提取 route handler 的核心判断逻辑为纯函数进行测试，
 * 避免 mock Supabase / Next.js 运行时。
 *
 * Validates: Requirements 3.4, 4.1, 4.2, 4.3
 */

import { describe, it, expect } from "vitest";
import { validateContractFields } from "@/lib/contracts/field-validation";
import { validateTransition, isEditable } from "@/lib/contracts/status-machine";
import type { ContractStatus, ContractFields } from "@/lib/contracts/types";

// ─── 测试数据 ───────────────────────────────────────────────

const VALID_FIELDS: ContractFields = {
  partner_company_name: "Acme Properties Ltd",
  partner_contact_name: "John Smith",
  partner_address: "123 Main St",
  partner_city: "London",
  partner_country: "UK",
  commission_rate: "15",
  contract_start_date: "2026-03-01",
  contract_end_date: "2027-02-28",
  covered_properties: "All London properties",
};

// ─── PUT 逻辑：仅 DRAFT 状态可保存字段 ─────────────────────

describe("PUT /api/admin/contracts/[contractId] — 保存合同字段", () => {
  describe("状态守卫：仅 DRAFT 可编辑", () => {
    const allStatuses: ContractStatus[] = [
      "DRAFT",
      "PENDING_REVIEW",
      "CONFIRMED",
      "SENT",
      "SIGNED",
      "CANCELED",
    ];

    it("DRAFT 状态允许编辑", () => {
      expect(isEditable("DRAFT")).toBe(true);
    });

    it.each(allStatuses.filter((s) => s !== "DRAFT"))(
      "非 DRAFT 状态 %s 禁止编辑",
      (status) => {
        expect(isEditable(status)).toBe(false);
      },
    );
  });
});

// ─── POST 逻辑：推送审阅 (DRAFT → PENDING_REVIEW) ──────────

describe("POST /api/admin/contracts/[contractId] — 推送审阅", () => {
  describe("状态转换验证", () => {
    it("DRAFT → PENDING_REVIEW 为合法转换", () => {
      const result = validateTransition("DRAFT", "PENDING_REVIEW");
      expect(result.valid).toBe(true);
    });

    it("非 DRAFT 状态不能转换到 PENDING_REVIEW", () => {
      const nonDraftStatuses: ContractStatus[] = [
        "PENDING_REVIEW",
        "CONFIRMED",
        "SENT",
        "SIGNED",
        "CANCELED",
      ];

      for (const status of nonDraftStatuses) {
        const result = validateTransition(status, "PENDING_REVIEW");
        expect(result.valid).toBe(false);
      }
    });
  });

  describe("字段完整性验证 — 推送前必须所有必填字段完整", () => {
    it("所有字段合法时验证通过", () => {
      const result = validateContractFields(VALID_FIELDS);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it("缺少 partner_company_name 时验证失败", () => {
      const fields = { ...VALID_FIELDS, partner_company_name: "" };
      const result = validateContractFields(fields);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty("partner_company_name");
    });

    it("缺少 partner_contact_name 时验证失败", () => {
      const fields = { ...VALID_FIELDS, partner_contact_name: "" };
      const result = validateContractFields(fields);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty("partner_contact_name");
    });

    it("commission_rate 非数值时验证失败", () => {
      const fields = { ...VALID_FIELDS, commission_rate: "abc" };
      const result = validateContractFields(fields);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty("commission_rate");
    });

    it("commission_rate 超出范围时验证失败", () => {
      const fields = { ...VALID_FIELDS, commission_rate: "150" };
      const result = validateContractFields(fields);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty("commission_rate");
    });

    it("contract_end_date 早于 start_date 时验证失败", () => {
      const fields = {
        ...VALID_FIELDS,
        contract_start_date: "2027-01-01",
        contract_end_date: "2026-01-01",
      };
      const result = validateContractFields(fields);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty("contract_end_date");
    });

    it("空字段对象时所有必填字段均报错", () => {
      const result = validateContractFields({});
      expect(result.valid).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(9);
    });

    it("多个字段缺失时返回所有错误", () => {
      const fields = {
        partner_company_name: "Acme",
        commission_rate: "10",
        // 其余字段缺失
      };
      const result = validateContractFields(fields);
      expect(result.valid).toBe(false);
      // 至少 7 个字段缺失
      expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(7);
    });
  });
});

// ─── 错误响应格式验证 ──────────────────────────────────────

describe("错误响应格式", () => {
  it("validateTransition 非法转换返回 reason 字符串", () => {
    const result = validateTransition("SIGNED", "PENDING_REVIEW");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("validateContractFields 失败时 errors 包含字段名作为 key", () => {
    const result = validateContractFields({ commission_rate: "abc" });
    expect(result.valid).toBe(false);
    expect(result.errors.commission_rate).toBeDefined();
    expect(typeof result.errors.commission_rate).toBe("string");
  });
});
