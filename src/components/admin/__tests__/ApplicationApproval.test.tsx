import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationList } from "../ApplicationList";
import type { ApplicationRow, BdOption } from "@/app/admin/applications/page";

/**
 * 申请审批全流程 — 组件交互测试
 *
 * Covers: AA-01 ~ AA-15 (P0)
 * Tests the complete approval workflow: filter → select → dialog → confirm
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

const BD_USERS: BdOption[] = [
  { id: "bd-1", company_name: "BD Office", contact_email: "bd@example.com" },
];

function makeApplications(): ApplicationRow[] {
  return [
    {
      id: "app-1",
      company_name: "Alpha Corp",
      supplier_type: "Property Management Company",
      contact_email: "alpha@example.com",
      contact_phone: "+1 111 1111",
      city: "London",
      country: "UK",
      website_url: "https://alpha.com",
      status: "PENDING",
      created_at: "2026-02-01T00:00:00Z",
      assigned_bd_id: null,
      referral_code: null,
    },
    {
      id: "app-2",
      company_name: "Beta LLC",
      supplier_type: null,
      contact_email: "beta@example.com",
      contact_phone: "+1 222 2222",
      city: "Paris",
      country: "France",
      website_url: null,
      status: "PENDING",
      created_at: "2026-02-02T00:00:00Z",
      assigned_bd_id: "bd-1",
      referral_code: null,
    },
    {
      id: "app-3",
      company_name: "Gamma Inc",
      supplier_type: null,
      contact_email: "gamma@example.com",
      contact_phone: null,
      city: null,
      country: null,
      website_url: null,
      status: "CONVERTED",
      created_at: "2026-01-15T00:00:00Z",
      assigned_bd_id: null,
      referral_code: null,
    },
    {
      id: "app-4",
      company_name: "Delta Co",
      supplier_type: null,
      contact_email: "delta@example.com",
      contact_phone: null,
      city: "Berlin",
      country: "Germany",
      website_url: null,
      status: "REJECTED",
      created_at: "2026-01-10T00:00:00Z",
      assigned_bd_id: null,
      referral_code: null,
    },
  ];
}

function renderList(apps?: ApplicationRow[]) {
  return render(
    <ApplicationList
      applications={apps ?? makeApplications()}
      bdUsers={BD_USERS}
      isAdmin={true}
      currentBdId="bd-1"
    />,
  );
}

const MOCK_STATS_RESPONSE = {
  ok: true,
  json: () =>
    Promise.resolve({
      pending_total: 2,
      unassigned_count: 1,
      converted_this_week: 0,
      total_this_week: 0,
      pending_last_week: 0,
    }),
};

describe("Application Approval Workflow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Default mock returns stats response for ApplicationStats useEffect
    global.fetch = vi.fn().mockResolvedValue(MOCK_STATS_RESPONSE);
  });

  // AA-01: 页面加载
  it("AA-01: renders filter tabs and application list", async () => {
    const user = userEvent.setup();
    renderList();
    expect(screen.getByRole("tab", { name: /all/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: /pending/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: /converted/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: /rejected/i })).toBeVisible();
    // Default tab is PENDING — switch to ALL to see all apps
    await user.click(screen.getByRole("tab", { name: /all/i }));
    expect(screen.getAllByText("Alpha Corp").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Beta LLC").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Gamma Inc").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Delta Co").length).toBeGreaterThanOrEqual(1);
  });

  // AA-02, AA-06: ALL 标签 — 计数正确
  it("AA-02/06: All tab shows correct count", () => {
    renderList();
    const allTab = screen.getByRole("tab", { name: /all/i });
    expect(allTab).toHaveTextContent("4");
    // Default tab is Pending, verify count
    const pendingTab = screen.getByRole("tab", { name: /pending/i });
    expect(pendingTab).toHaveTextContent("2");
  });

  // AA-03: PENDING 筛选
  it("AA-03: Pending filter shows only PENDING applications", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole("tab", { name: /pending/i }));

    expect(screen.getAllByText("Alpha Corp").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Beta LLC").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Gamma Inc")).toBeNull();
    expect(screen.queryByText("Delta Co")).toBeNull();
  });

  // AA-04: CONVERTED 筛选
  it("AA-04: Converted filter shows only CONVERTED applications", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole("tab", { name: /converted/i }));

    expect(screen.queryByText("Alpha Corp")).toBeNull();
    expect(screen.getAllByText("Gamma Inc").length).toBeGreaterThanOrEqual(1);
  });

  // AA-05: REJECTED 筛选
  it("AA-05: Rejected filter shows only REJECTED applications", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole("tab", { name: /rejected/i }));

    expect(screen.queryByText("Alpha Corp")).toBeNull();
    expect(screen.getAllByText("Delta Co").length).toBeGreaterThanOrEqual(1);
  });

  // AA-06: 计数
  it("AA-06: filter tab counts match", () => {
    renderList();
    const pendingTab = screen.getByRole("tab", { name: /pending/i });
    const convertedTab = screen.getByRole("tab", { name: /converted/i });
    const rejectedTab = screen.getByRole("tab", { name: /rejected/i });
    expect(pendingTab).toHaveTextContent("2");
    expect(convertedTab).toHaveTextContent("1");
    expect(rejectedTab).toHaveTextContent("1");
  });

  // AA-07: 审批对话框打开
  it("AA-07: clicking Approve opens dialog", async () => {
    const user = userEvent.setup();
    renderList();

    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    await user.click(approveButtons[0]);

    expect(screen.getByRole("dialog")).toBeVisible();
  });

  // AA-08: 对话框内容
  it("AA-08: dialog shows application details", async () => {
    const user = userEvent.setup();
    renderList();

    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    await user.click(approveButtons[0]);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Alpha Corp")).toBeVisible();
    expect(within(dialog).getByText("alpha@example.com")).toBeVisible();
    expect(within(dialog).getByText("+1 111 1111")).toBeVisible();
    expect(within(dialog).getByText("London")).toBeVisible();
    expect(within(dialog).getByText("UK")).toBeVisible();
  });

  // AA-09: 选择合同类型
  it("AA-09: can change contract type in dialog", async () => {
    const user = userEvent.setup();
    renderList();

    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    await user.click(approveButtons[0]);

    const select = screen.getByLabelText("Contract Type") as HTMLSelectElement;
    expect(select.value).toBe("STANDARD_PROMOTION_2026");

    await user.selectOptions(select, "PREMIUM_PROMOTION_2026");
    expect(select.value).toBe("PREMIUM_PROMOTION_2026");
  });

  // AA-10: 取消审批
  it("AA-10: Cancel button closes dialog", async () => {
    const user = userEvent.setup();
    renderList();

    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    await user.click(approveButtons[0]);
    expect(screen.getByRole("dialog")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // AA-13: 确认审批 — API 调用
  it("AA-13: Confirm Approval calls API with correct payload", async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    renderList();

    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    await user.click(approveButtons[0]);

    await user.click(screen.getByRole("button", { name: "Confirm Approval" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/approve-supplier",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("app-1"),
        }),
      );
    });
  });

  // AA-14: 已转化行 — no Approve button
  it("AA-14: CONVERTED row has no Approve button", async () => {
    const user = userEvent.setup();
    renderList();
    // Switch to Converted tab
    await user.click(screen.getByRole("tab", { name: /converted/i }));
    // No Approve buttons should be visible for CONVERTED applications
    const approveButtons = screen.queryAllByRole("button", { name: "Approve" });
    expect(approveButtons).toHaveLength(0);
  });

  // AA-15: 空列表
  it("AA-15: empty filter shows empty state", async () => {
    const user = userEvent.setup();
    // Only PENDING applications — CONVERTED/REJECTED filters will be empty
    const apps = makeApplications();
    renderList([apps[0], apps[1]]);

    await user.click(screen.getByRole("tab", { name: /converted/i }));
    expect(screen.getByText(/no applications match/i)).toBeVisible();
  });

  // Active tab highlight — default is PENDING
  it("active tab has aria-selected=true", () => {
    renderList();

    const pendingTab = screen.getByRole("tab", { name: /pending/i });
    expect(pendingTab).toHaveAttribute("aria-selected", "true");

    const allTab = screen.getByRole("tab", { name: /all/i });
    expect(allTab).toHaveAttribute("aria-selected", "false");
  });

  // Assigned BD column shows BD name
  it("shows assigned BD name in table", () => {
    renderList();
    // Default tab is PENDING — Beta LLC (PENDING, assigned to bd-1) should show BD Office
    expect(screen.getAllByText("BD Office").length).toBeGreaterThanOrEqual(1);
  });
});
