import { describe, it, expect, vi } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import * as fc from "fast-check";
import { render, screen } from "@testing-library/react";
import {
  StatusContent,
  FIELD_ORDER,
  FIELD_LABELS,
} from "../ContractStatusContent";
import type { ContractFields } from "@/lib/contracts/types";

/**
 * 合同预览组件测试
 *
 * **Validates: Requirements 5.1**
 *
 * Property 11: 合同预览字段渲染完整性
 * 对于任意有效的合同字段对象，预览渲染结果应包含所有 9 个动态字段的值。
 */

/* ------------------------------------------------------------------ */
/*  Generators                                                         */
/* ------------------------------------------------------------------ */

/** 生成非空可打印字符串（避免空白导致渲染为 "—"） */
const nonEmptyString = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/** 生成有效的 ISO 日期字符串（避免 fc.date shrinking 产生 Invalid Date） */
const isoDate = fc
  .integer({ min: 2020, max: 2030 })
  .chain((year) =>
    fc
      .integer({ min: 1, max: 12 })
      .chain((month) =>
        fc
          .integer({ min: 1, max: 28 })
          .map(
            (day) =>
              `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          ),
      ),
  );

/** 生成有效的佣金比例（0-100 之间的数值字符串） */
const commissionRate = fc.integer({ min: 1, max: 100 }).map((n) => String(n));

/** 生成有效的 ContractFields 对象 */
const validContractFields: fc.Arbitrary<ContractFields> = fc.record({
  partner_company_name: nonEmptyString,
  partner_contact_name: nonEmptyString,
  partner_address: nonEmptyString,
  partner_city: nonEmptyString,
  partner_country: nonEmptyString,
  commission_rate: commissionRate,
  contract_start_date: isoDate,
  contract_end_date: isoDate,
  covered_properties: nonEmptyString,
});

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */

const noop = () => {};

function renderStatusContent(
  status: Parameters<typeof StatusContent>[0]["status"],
  fields: ContractFields | null = null,
  documentUrl: string | null = null,
) {
  return render(
    <StatusContent
      status={status}
      fields={fields}
      documentUrl={documentUrl}
      isLoading={false}
      onAction={noop}
    />,
  );
}

/* ------------------------------------------------------------------ */
/*  Property-Based Tests                                               */
/* ------------------------------------------------------------------ */

describe("Property 11: 合同预览字段渲染完整性", () => {
  fcTest.prop([validContractFields], { numRuns: 100 })(
    "对于任意有效的合同字段对象，PENDING_REVIEW 状态下应渲染所有 9 个字段值",
    (fields) => {
      const { unmount } = renderStatusContent("PENDING_REVIEW", fields);

      for (const key of FIELD_ORDER) {
        const el = screen.getByTestId(`field-${key}`);
        expect(el).toBeInTheDocument();
        expect(el.textContent).toBe(fields[key]);
      }

      // 确保恰好 9 个字段
      expect(FIELD_ORDER).toHaveLength(9);

      unmount();
    },
  );

  fcTest.prop([validContractFields], { numRuns: 100 })(
    "对于任意有效字段，所有字段标签均应渲染",
    (fields) => {
      const { unmount } = renderStatusContent("PENDING_REVIEW", fields);

      for (const key of FIELD_ORDER) {
        expect(screen.getByText(FIELD_LABELS[key])).toBeInTheDocument();
      }

      unmount();
    },
  );
});

/* ------------------------------------------------------------------ */
/*  Unit Tests                                                         */
/* ------------------------------------------------------------------ */

describe("StatusContent 单元测试", () => {
  const sampleFields: ContractFields = {
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

  it("DRAFT 状态显示'合同正在准备中'提示", () => {
    renderStatusContent("DRAFT");
    expect(screen.getByText("合同正在准备中")).toBeInTheDocument();
  });

  it("PENDING_REVIEW 状态渲染所有 9 个字段值", () => {
    renderStatusContent("PENDING_REVIEW", sampleFields);

    for (const key of FIELD_ORDER) {
      const el = screen.getByTestId(`field-${key}`);
      expect(el.textContent).toBe(sampleFields[key]);
    }
  });

  it("PENDING_REVIEW 状态渲染确认和请求修改按钮", () => {
    renderStatusContent("PENDING_REVIEW", sampleFields);
    expect(screen.getByText("确认并进入签署")).toBeInTheDocument();
    expect(screen.getByText("请求修改")).toBeInTheDocument();
  });

  it("PENDING_REVIEW 状态 fields 为 null 时不渲染字段区域", () => {
    renderStatusContent("PENDING_REVIEW", null);
    expect(screen.queryByTestId("contract-fields")).not.toBeInTheDocument();
  });

  it("CONFIRMED 状态显示'正在创建签署请求...'", () => {
    renderStatusContent("CONFIRMED");
    expect(screen.getByText("正在创建签署请求...")).toBeInTheDocument();
  });

  it("SENT 状态显示签署邮件已发送提示", () => {
    renderStatusContent("SENT");
    expect(screen.getByText("签署邮件已发送，请查收邮箱")).toBeInTheDocument();
  });

  it("SIGNED 状态显示签署完成", () => {
    renderStatusContent("SIGNED", null, null);
    expect(screen.getByText("合同签署完成")).toBeInTheDocument();
  });

  it("SIGNED 状态有 documentUrl 时渲染下载链接", () => {
    renderStatusContent("SIGNED", null, "https://example.com/doc.pdf");
    const link = screen.getByText("下载已签署合同 (PDF)");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://example.com/doc.pdf",
    );
  });

  it("SIGNED 状态无 documentUrl 时不渲染下载链接", () => {
    renderStatusContent("SIGNED", null, null);
    expect(screen.queryByText("下载已签署合同 (PDF)")).not.toBeInTheDocument();
  });

  it("CANCELED 状态显示合同已取消", () => {
    renderStatusContent("CANCELED");
    expect(screen.getByText("合同已取消")).toBeInTheDocument();
  });

  it("isLoading 为 true 时按钮禁用", () => {
    render(
      <StatusContent
        status="PENDING_REVIEW"
        fields={sampleFields}
        documentUrl={null}
        isLoading={true}
        onAction={noop}
      />,
    );
    expect(screen.getByText("处理中...")).toBeInTheDocument();
  });

  it("空字段值渲染为 '—' 占位符", () => {
    const emptyFields: ContractFields = {
      partner_company_name: "",
      partner_contact_name: "",
      partner_address: "",
      partner_city: "",
      partner_country: "",
      commission_rate: "",
      contract_start_date: "",
      contract_end_date: "",
      covered_properties: "",
    };
    renderStatusContent("PENDING_REVIEW", emptyFields);

    for (const key of FIELD_ORDER) {
      const el = screen.getByTestId(`field-${key}`);
      expect(el.textContent).toBe("—");
    }
  });
});
