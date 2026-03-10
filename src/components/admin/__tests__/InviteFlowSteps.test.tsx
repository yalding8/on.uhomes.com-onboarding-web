import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InviteFlowSteps } from "../InviteFlowSteps";

describe("InviteFlowSteps", () => {
  it("TC-INVITE-UI-001: renders 4 flow steps", () => {
    render(<InviteFlowSteps />);

    expect(screen.getAllByText("Invite").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Register").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Contract").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Go Live").length).toBeGreaterThanOrEqual(1);
  });

  it("TC-INVITE-UI-001: each step has a description", () => {
    render(<InviteFlowSteps />);

    expect(
      screen.getAllByText("You send the invitation").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("They create their account").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Sign the partner agreement").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Buildings go live").length,
    ).toBeGreaterThanOrEqual(1);
  });
});
