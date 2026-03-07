import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContractEditForm } from "../ContractEditForm";
import type { ContractEditFormProps } from "../ContractEditForm";
import type { ContractFields } from "@/lib/contracts/types";

/**
 * 合同编辑表单 — 全字段交互测试
 *
 * Covers: CE-01 ~ CE-08 (P0)
 */

const ALL_FIELD_LABELS = [
  "Partner Company Name",
  "Partner Contact Name",
  "Partner Address",
  "Partner City",
  "Partner Country / Region",
  "Commission Rate (%)",
  "Contract Start Date",
  "Contract End Date",
  "Covered Properties",
];

function makeFields(
  overrides: Partial<ContractFields> = {},
): Partial<ContractFields> {
  return {
    partner_company_name: "",
    partner_contact_name: "",
    partner_address: "",
    partner_city: "",
    partner_country: "",
    commission_rate: "",
    contract_start_date: "",
    contract_end_date: "",
    covered_properties: "",
    ...overrides,
  };
}

function renderForm(overrides: Partial<ContractEditFormProps> = {}) {
  const props: ContractEditFormProps = {
    contractId: "contract-001",
    initialFields: makeFields(),
    supplierInfo: { company_name: "Acme Corp", city: "Shanghai" },
    contractStatus: "DRAFT",
    uploadedDocumentUrl: null,
    initialUpdatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
  return render(<ContractEditForm {...props} />);
}

describe("ContractEditForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  // CE-01: 页面加载 — 显示所有字段和按钮
  it("CE-01: renders all 9 fields and Save/Push buttons in DRAFT", () => {
    renderForm();
    for (const label of ALL_FIELD_LABELS) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Push for Review" }),
    ).toBeVisible();
  });

  // CE-03: 自动预填 — company_name 和 city
  it("CE-03: auto-prefills company_name and city from supplier info", () => {
    renderForm({
      initialFields: makeFields(),
      supplierInfo: { company_name: "Acme Corp", city: "Shanghai" },
    });
    expect(screen.getByLabelText("Partner Company Name")).toHaveValue(
      "Acme Corp",
    );
    expect(screen.getByLabelText("Partner City")).toHaveValue("Shanghai");
  });

  it("does not overwrite existing field values with prefill", () => {
    renderForm({
      initialFields: makeFields({
        partner_company_name: "Existing Co",
        partner_city: "Beijing",
      }),
      supplierInfo: { company_name: "Acme Corp", city: "Shanghai" },
    });
    expect(screen.getByLabelText("Partner Company Name")).toHaveValue(
      "Existing Co",
    );
    expect(screen.getByLabelText("Partner City")).toHaveValue("Beijing");
  });

  // B06: null supplier city — fields default to empty string, not null
  it("B06: null supplier city defaults partner_city to empty string", () => {
    renderForm({
      initialFields: {},
      supplierInfo: { company_name: "Acme Corp", city: null },
    });
    expect(screen.getByLabelText("Partner Company Name")).toHaveValue(
      "Acme Corp",
    );
    // partner_city should be "" not null/undefined
    expect(screen.getByLabelText("Partner City")).toHaveValue("");
  });

  // CE-04: 编辑全部字段
  it("CE-04: all 9 fields are editable in DRAFT status", async () => {
    const user = userEvent.setup();
    renderForm();

    const textFields = [
      { label: "Partner Company Name", value: "Test Corp" },
      { label: "Partner Contact Name", value: "John Doe" },
      { label: "Partner Address", value: "123 Main St" },
      { label: "Partner City", value: "London" },
      { label: "Partner Country / Region", value: "UK" },
    ];

    for (const { label, value } of textFields) {
      const input = screen.getByLabelText(label);
      await user.clear(input);
      await user.type(input, value);
      expect(input).toHaveValue(value);
    }

    // Number field
    const commissionInput = screen.getByLabelText("Commission Rate (%)");
    await user.clear(commissionInput);
    await user.type(commissionInput, "15.5");
    expect(commissionInput).toHaveValue(15.5);

    // Date fields
    const startDate = screen.getByLabelText("Contract Start Date");
    await user.clear(startDate);
    await user.type(startDate, "2026-03-01");
    expect(startDate).toHaveValue("2026-03-01");

    const endDate = screen.getByLabelText("Contract End Date");
    await user.clear(endDate);
    await user.type(endDate, "2027-03-01");
    expect(endDate).toHaveValue("2027-03-01");

    // Textarea
    const properties = screen.getByLabelText("Covered Properties");
    await user.clear(properties);
    await user.type(properties, "Building A, Building B");
    expect(properties).toHaveValue("Building A, Building B");
  });

  // CE-05: 保存
  it("CE-05: Save button calls PUT API and shows success", async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/contracts/contract-001",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Contract fields saved")).toBeVisible();
    });
  });

  it("Save button shows Saving... during request", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (v: Response) => void;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    ) as typeof fetch;

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    resolveFetch!({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as unknown as Response);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
    });
  });

  // CE-06: 提交审核
  it("CE-06: Push for Review calls PUT then POST, transitions to PENDING_REVIEW", async () => {
    const user = userEvent.setup();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, status: "PENDING_REVIEW" }),
      });
    global.fetch = mockFetch;

    renderForm();
    await user.click(screen.getByRole("button", { name: "Push for Review" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // First call: PUT (save)
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: "PUT" });
    // Second call: POST (push)
    expect(mockFetch.mock.calls[1][1]).toMatchObject({ method: "POST" });

    // Status message
    await waitFor(() => {
      expect(screen.getByText("Contract pushed for review")).toBeVisible();
    });

    // Buttons should disappear (no longer DRAFT)
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Push for Review" }),
    ).toBeNull();
  });

  // CE-07: 空字段提交审核 — 显示字段级错误
  it("CE-07: Push for Review with missing fields shows field errors", async () => {
    const user = userEvent.setup();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: "Validation failed",
            fields: {
              partner_contact_name: "Required",
              partner_address: "Required",
            },
          }),
      });
    global.fetch = mockFetch;

    renderForm();
    await user.click(screen.getByRole("button", { name: "Push for Review" }));

    await waitFor(() => {
      expect(screen.getByText("Validation failed")).toBeVisible();
    });
    expect(screen.getAllByText("Required")).toHaveLength(2);
  });

  // CE-08: 非 DRAFT 只读
  it("CE-08: non-DRAFT status disables all fields and hides buttons", () => {
    renderForm({ contractStatus: "PENDING_REVIEW" });

    for (const label of ALL_FIELD_LABELS) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Push for Review" }),
    ).toBeNull();
    expect(screen.getByText(/editing is disabled/)).toBeVisible();
  });

  it("CONFIRMED status shows read-only notice", () => {
    renderForm({ contractStatus: "CONFIRMED" });
    expect(screen.getByText(/Confirmed/)).toBeVisible();
    expect(screen.getByText(/editing is disabled/)).toBeVisible();
  });

  it("Save error displays error message", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Save failed" }),
    });

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeVisible();
    });
  });

  it("network error shows fallback message", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Network error, please try again")).toBeVisible();
    });
  });
});
