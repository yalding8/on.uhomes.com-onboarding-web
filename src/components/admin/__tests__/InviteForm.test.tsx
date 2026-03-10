import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InviteForm } from "../InviteForm";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

const VALID_TYPE = "Purpose Built Student Accommodation Provider";

function fillAndSubmit(container: HTMLElement) {
  const emailInput = container.querySelector(
    "#invite-email",
  ) as HTMLInputElement;
  const companyInput = container.querySelector(
    "#invite-company",
  ) as HTMLInputElement;
  const typeSelect = container.querySelector(
    "#invite-supplier-type",
  ) as HTMLSelectElement;

  fireEvent.change(emailInput, { target: { value: "test@example.com" } });
  fireEvent.change(companyInput, { target: { value: "Acme Corp" } });
  fireEvent.change(typeSelect, { target: { value: VALID_TYPE } });

  fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));
}

describe("InviteForm", () => {
  it("TC-INVITE-UI-005: shows validation errors on empty submit", () => {
    render(<InviteForm />);

    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    expect(screen.getByText("Email is required")).toBeDefined();
    expect(screen.getByText("Company name is required")).toBeDefined();
    expect(screen.getByText("Supplier type is required")).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("TC-INVITE-UI-003: shows success card after submit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { container } = render(<InviteForm />);
    fillAndSubmit(container);

    await waitFor(() => {
      expect(screen.getByText("Invitation Sent!")).toBeDefined();
    });

    expect(screen.getByText("Acme Corp")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
    expect(screen.getByText("Invite Another")).toBeDefined();
    expect(screen.getByText("View Suppliers")).toBeDefined();
  });

  it("TC-INVITE-UI-004: Invite Another resets to form", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { container } = render(<InviteForm />);
    fillAndSubmit(container);

    await waitFor(() => {
      expect(screen.getByText("Invite Another")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Invite Another"));

    expect(
      screen.getByRole("button", { name: /send invitation/i }),
    ).toBeDefined();
    const emailInput = container.querySelector(
      "#invite-email",
    ) as HTMLInputElement;
    expect(emailInput.value).toBe("");
  });

  it("TC-INVITE-REGR-003: shows error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Email already exists" }),
    });

    const { container } = render(<InviteForm />);
    fillAndSubmit(container);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("Email already exists")).toBeDefined();
    });

    const emailInput = container.querySelector(
      "#invite-email",
    ) as HTMLInputElement;
    expect(emailInput.value).toBe("test@example.com");
  });

  it("shows required fields hint", () => {
    render(<InviteForm />);
    expect(screen.getByText(/fields marked with/i)).toBeDefined();
  });

  it("TC-INVITE-REGR-001: sends correct payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { container } = render(<InviteForm />);
    const emailInput = container.querySelector(
      "#invite-email",
    ) as HTMLInputElement;
    const companyInput = container.querySelector(
      "#invite-company",
    ) as HTMLInputElement;
    const typeSelect = container.querySelector(
      "#invite-supplier-type",
    ) as HTMLSelectElement;

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(companyInput, { target: { value: "Test Inc" } });
    fireEvent.change(typeSelect, { target: { value: VALID_TYPE } });

    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/invite-supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          company_name: "Test Inc",
          supplier_type: VALID_TYPE,
          phone: "",
          website: "",
        }),
      });
    });
  });
});
