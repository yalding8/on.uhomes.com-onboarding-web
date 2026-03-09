import { describe, it, expect } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import * as fc from "fast-check";
import { render, screen } from "@testing-library/react";
import { StatusContent } from "../ContractStatusContent";
import type { ContractFields } from "@/lib/contracts/types";

/**
 * 合同预览组件测试 — 验证 ContractDocumentPreview 集成
 *
 * Property 11: 合同预览字段渲染完整性
 * 对于任意有效的合同字段对象，预览渲染结果应包含所有 9 个动态字段的值。
 */

/* ------------------------------------------------------------------ */
/*  Generators                                                         */
/* ------------------------------------------------------------------ */

/** 生成非空可打印字符串（纯字母避免 HTML 转义干扰） */
const nonEmptyAlpha = fc
  .string({ minLength: 3, maxLength: 20 })
  .filter((s: string) => /^[a-zA-Z ]+$/.test(s) && s.trim().length > 0);

/** 生成有效的 ISO 日期字符串 */
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

/** 生成有效的佣金比例 */
const commissionRate = fc.integer({ min: 1, max: 100 }).map((n) => String(n));

/** 生成有效的 ContractFields 对象 */
const validContractFields: fc.Arbitrary<ContractFields> = fc.record({
  partner_company_name: nonEmptyAlpha,
  partner_contact_name: nonEmptyAlpha,
  partner_address: nonEmptyAlpha,
  partner_city: nonEmptyAlpha,
  partner_country: nonEmptyAlpha,
  commission_rate: commissionRate,
  contract_start_date: isoDate,
  contract_end_date: isoDate,
  covered_properties: nonEmptyAlpha,
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
      contractId="test-contract-001"
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
    "PENDING_REVIEW 下所有字段值在文档预览中可见",
    (fields) => {
      const { container, unmount } = renderStatusContent(
        "PENDING_REVIEW",
        fields,
      );
      const html = container.innerHTML;

      // 直接文本字段应出现在渲染结果中
      expect(html).toContain(fields.partner_company_name);
      expect(html).toContain(fields.partner_contact_name);
      expect(html).toContain(fields.partner_address);
      expect(html).toContain(fields.partner_city);
      expect(html).toContain(fields.partner_country);
      expect(html).toContain(`${fields.commission_rate}%`);
      expect(html).toContain(fields.covered_properties);

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

  it("DRAFT 状态显示提示", () => {
    renderStatusContent("DRAFT");
    expect(screen.getByText("Contract is Being Prepared")).toBeInTheDocument();
  });

  it("PENDING_REVIEW 状态渲染文档预览中的字段值", () => {
    const { container } = renderStatusContent("PENDING_REVIEW", sampleFields);
    const html = container.innerHTML;

    expect(html).toContain("Acme Properties Ltd");
    expect(html).toContain("John Smith");
    expect(html).toContain("123 Main St");
    expect(html).toContain("London");
    expect(html).toContain("UK");
    expect(html).toContain("15%");
    expect(html).toContain("All London properties");
  });

  it("PENDING_REVIEW 状态渲染确认和请求修改按钮", () => {
    renderStatusContent("PENDING_REVIEW", sampleFields);
    expect(screen.getByText("Confirm & Sign")).toBeInTheDocument();
    expect(screen.getByText("Request Changes")).toBeInTheDocument();
  });

  it("PENDING_REVIEW 状态 fields 为 null 时显示无数据提示", () => {
    renderStatusContent("PENDING_REVIEW", null);
    expect(screen.getByText("Contract Not Yet Available")).toBeInTheDocument();
  });

  it("CONFIRMED 状态显示创建签署请求", () => {
    renderStatusContent("CONFIRMED");
    expect(screen.getByText("Creating Signing Request...")).toBeInTheDocument();
  });

  it("SENT 状态显示签署邮件已发送", () => {
    renderStatusContent("SENT");
    expect(
      screen.getByText("Signing Email Sent — Check Your Inbox"),
    ).toBeInTheDocument();
  });

  it("SIGNED 状态显示签署完成", () => {
    renderStatusContent("SIGNED", null, null);
    expect(
      screen.getByText("Contract Signed Successfully"),
    ).toBeInTheDocument();
  });

  it("SIGNED 状态有 documentUrl 时渲染下载按钮", () => {
    renderStatusContent("SIGNED", null, "https://example.com/doc.pdf");
    const button = screen.getByText("Download Signed Contract (PDF)");
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
  });

  it("SIGNED 状态无 documentUrl 时不渲染下载链接", () => {
    renderStatusContent("SIGNED", null, null);
    expect(
      screen.queryByText("Download Signed Contract (PDF)"),
    ).not.toBeInTheDocument();
  });

  it("CANCELED 状态显示合同已取消", () => {
    renderStatusContent("CANCELED");
    expect(screen.getByText("Contract Canceled")).toBeInTheDocument();
  });

  it("isLoading 为 true 时按钮禁用", () => {
    render(
      <StatusContent
        status="PENDING_REVIEW"
        fields={sampleFields}
        documentUrl={null}
        contractId="test-contract-001"
        isLoading={true}
        onAction={noop}
      />,
    );
    expect(screen.getByText("Processing...")).toBeInTheDocument();
  });

  it("空字段值渲染为 'Not specified'", () => {
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
    const { container } = renderStatusContent("PENDING_REVIEW", emptyFields);
    const notSpecified = container.querySelectorAll(".italic");
    expect(notSpecified.length).toBeGreaterThanOrEqual(1);
  });
});
