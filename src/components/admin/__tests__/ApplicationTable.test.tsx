import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationTable } from "../ApplicationTable";

/**
 * ApplicationTable 组件测试
 *
 * 验证审批按钮的渲染逻辑和交互行为。
 * Validates: Requirements 4.1, 4.5
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

const BD_USERS = [
  { id: "bd-1", company_name: "BD Office", contact_email: "bd@example.com" },
];

type AppStatus = "PENDING" | "CONVERTED" | "REJECTED";

interface MockApp {
  id: string;
  company_name: string;
  supplier_type: string | null;
  contact_email: string;
  contact_phone: string | null;
  city: string | null;
  country: string | null;
  website_url: string | null;
  status: AppStatus;
  created_at: string;
  assigned_bd_id: string | null;
}

function makeApp(overrides: Partial<MockApp> = {}): MockApp {
  return {
    id: crypto.randomUUID(),
    company_name: "Test Co",
    supplier_type: null,
    contact_email: "test@example.com",
    contact_phone: null,
    city: null,
    country: null,
    website_url: null,
    status: "PENDING",
    created_at: new Date().toISOString(),
    assigned_bd_id: null,
    ...overrides,
  };
}

describe("ApplicationTable", () => {
  it("PENDING 申请显示可点击的审批按钮", async () => {
    const onApprove = vi.fn();
    const app = makeApp({ status: "PENDING", company_name: "Pending Corp" });

    render(
      <ApplicationTable
        applications={[app]}
        onApprove={onApprove}
        bdUsers={BD_USERS}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: "Approve" });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(buttons[0]).not.toBeDisabled();

    await userEvent.click(buttons[0]);
    expect(onApprove).toHaveBeenCalledWith(app);
  });

  it("CONVERTED 申请的审批按钮被禁用", () => {
    const onApprove = vi.fn();
    const app = makeApp({ status: "CONVERTED" });

    render(
      <ApplicationTable
        applications={[app]}
        onApprove={onApprove}
        bdUsers={BD_USERS}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: "Converted" });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(buttons[0]).toBeDisabled();
  });

  it("REJECTED 申请的审批按钮被禁用", () => {
    const onApprove = vi.fn();
    const app = makeApp({ status: "REJECTED" });

    render(
      <ApplicationTable
        applications={[app]}
        onApprove={onApprove}
        bdUsers={BD_USERS}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: "Rejected" });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(buttons[0]).toBeDisabled();
  });

  it("渲染所有申请字段", () => {
    const onApprove = vi.fn();
    const app = makeApp({
      company_name: "Acme Inc",
      contact_email: "acme@test.com",
      contact_phone: "+86 123",
      city: "Shanghai",
      country: "China",
      website_url: "https://acme.com",
    });

    render(
      <ApplicationTable
        applications={[app]}
        onApprove={onApprove}
        bdUsers={BD_USERS}
      />,
    );

    expect(screen.getAllByText("Acme Inc").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("acme@test.com").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("+86 123").length).toBeGreaterThanOrEqual(1);
  });

  it("空列表不渲染任何行", () => {
    const onApprove = vi.fn();
    render(
      <ApplicationTable
        applications={[]}
        onApprove={onApprove}
        bdUsers={BD_USERS}
      />,
    );

    const rows = screen.queryAllByRole("row");
    // 只有表头行（桌面端），没有数据行
    expect(rows.length).toBeLessThanOrEqual(1);
  });
});
