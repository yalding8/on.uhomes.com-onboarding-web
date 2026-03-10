import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InviteTips } from "../InviteTips";

describe("InviteTips", () => {
  it("TC-INVITE-UI-002: renders 3 tip cards", () => {
    render(<InviteTips />);

    expect(screen.getByText("Quick Tips")).toBeDefined();
    expect(screen.getByText("Pre-fill Contract Fields")).toBeDefined();
    expect(screen.getByText("Need Help?")).toBeDefined();
  });

  it("TC-INVITE-UI-002: each card has content items", () => {
    render(<InviteTips />);

    expect(
      screen.getByText("Use the supplier's official business email"),
    ).toBeDefined();
    expect(
      screen.getByText("The invitation link expires in 7 days"),
    ).toBeDefined();
    expect(
      screen.getByText("For bulk invitations, contact your admin"),
    ).toBeDefined();
  });
});
