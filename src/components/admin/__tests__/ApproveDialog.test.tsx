import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApproveDialog, CONTRACT_TYPES } from "../ApproveDialog";
import type { ApproveDialogProps } from "../ApproveDialog";
import type { ApplicationRow } from "@/app/admin/applications/page";

/**
 * 审批确认对话框 — 单元测试
 *
 * Validates: Requirements 4.1, 4.3, 4.5
 */

function makeApplication(
  overrides: Partial<ApplicationRow> = {},
): ApplicationRow {
  return {
    id: "app-001",
    company_name: "测试公司",
    contact_email: "test@example.com",
    contact_phone: "13800138000",
    city: "上海",
    country: "中国",
    website_url: "https://example.com",
    status: "PENDING",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderDialog(overrides: Partial<ApproveDialogProps> = {}) {
  const props: ApproveDialogProps = {
    application: makeApplication(),
    onConfirm: vi.fn(() => Promise.resolve()),
    onCancel: vi.fn(),
    ...overrides,
  };
  const result = render(<ApproveDialog {...props} />);
  return { ...result, props };
}

describe("ApproveDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("渲染申请详情字段", () => {
    renderDialog();
    expect(screen.getByText("测试公司")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("13800138000")).toBeInTheDocument();
    expect(screen.getByText("上海")).toBeInTheDocument();
    expect(screen.getByText("中国")).toBeInTheDocument();
  });

  it("null 字段显示占位符", () => {
    renderDialog({
      application: makeApplication({
        contact_phone: null,
        city: null,
        country: null,
      }),
    });
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("渲染合同类型选择器，默认选中 STANDARD_PROMOTION_2026", () => {
    renderDialog();
    const select = screen.getByLabelText("Contract Type") as HTMLSelectElement;
    expect(select.value).toBe("STANDARD_PROMOTION_2026");
    expect(select.options).toHaveLength(CONTRACT_TYPES.length);
  });

  it("PENDING 状态下确认按钮可用", () => {
    renderDialog();
    const btn = screen.getByRole("button", { name: "Confirm Approval" });
    expect(btn).not.toBeDisabled();
  });

  it("非 PENDING 状态下确认按钮禁用", () => {
    renderDialog({ application: makeApplication({ status: "CONVERTED" }) });
    const btn = screen.getByRole("button", { name: "Converted" });
    expect(btn).toBeDisabled();
  });

  it("非 PENDING 状态显示无法审批提示", () => {
    renderDialog({ application: makeApplication({ status: "REJECTED" }) });
    expect(
      screen.getByText(/Current status is "Rejected", cannot approve/),
    ).toBeInTheDocument();
  });

  it("确认按钮调用 onConfirm 并传递合同类型", async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    renderDialog({ onConfirm });

    await userEvent.click(screen.getByRole("button", { name: "Confirm Approval" }));

    expect(onConfirm).toHaveBeenCalledWith("STANDARD_PROMOTION_2026");
  });

  it("切换合同类型后确认传递新值", async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    renderDialog({ onConfirm });

    await userEvent.selectOptions(
      screen.getByLabelText("Contract Type"),
      "PREMIUM_PROMOTION_2026",
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm Approval" }));

    expect(onConfirm).toHaveBeenCalledWith("PREMIUM_PROMOTION_2026");
  });

  it("取消按钮调用 onCancel", async () => {
    const { props } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it("Escape 键调用 onCancel", () => {
    const { props } = renderDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onCancel).toHaveBeenCalled();
  });

  it("点击遮罩调用 onCancel", () => {
    const { props } = renderDialog();
    // 遮罩是 aria-hidden 的 div
    const backdrop = document.querySelector("[aria-hidden='true']");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(props.onCancel).toHaveBeenCalled();
  });

  it("loading 期间确认按钮禁用，防止重复提交", async () => {
    let resolveConfirm: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    renderDialog({ onConfirm });

    const btn = screen.getByRole("button", { name: "Confirm Approval" });
    await userEvent.click(btn);

    // loading 中按钮应禁用
    await waitFor(() => {
      expect(btn).toBeDisabled();
    });

    // 解除 loading
    resolveConfirm!();
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it("onConfirm 抛错时显示错误信息并恢复按钮", async () => {
    const onConfirm = vi.fn(() =>
      Promise.reject(new Error("Approval failed: network error")),
    );
    renderDialog({ onConfirm });

    await userEvent.click(screen.getByRole("button", { name: "Confirm Approval" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Approval failed: network error");
    });

    // 按钮恢复可用
    expect(screen.getByRole("button", { name: "Confirm Approval" })).not.toBeDisabled();
  });

  it("loading 期间 Escape 键不触发关闭", async () => {
    const onConfirm = vi.fn(() => new Promise<void>(() => {}));
    const { props } = renderDialog({ onConfirm });

    await userEvent.click(screen.getByRole("button", { name: "Confirm Approval" }));

    // 等待进入 loading 状态
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirm Approval/ })).toBeDisabled();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("dialog 具有正确的 aria 属性", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "approve-dialog-title");
  });
});
