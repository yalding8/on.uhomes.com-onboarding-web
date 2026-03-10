/**
 * P0-G9 + P1-G8: Partnership confirmed email template tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildPartnershipConfirmedEmail } from "../templates/partnership-confirmed";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://test.example.com");
});

describe("buildPartnershipConfirmedEmail", () => {
  it("includes company name in email body", () => {
    const { html } = buildPartnershipConfirmedEmail({
      company_name: "Acme Properties",
    });
    expect(html).toContain("Acme Properties");
  });

  it("includes login link from env", () => {
    const { html } = buildPartnershipConfirmedEmail({
      company_name: "Test Co",
    });
    expect(html).toContain("https://test.example.com/login");
  });

  it("subject mentions partnership confirmed", () => {
    const { subject } = buildPartnershipConfirmedEmail({
      company_name: "Test Co",
    });
    expect(subject).toContain("partnership is confirmed");
  });

  it("mentions OTP login (no password)", () => {
    const { html } = buildPartnershipConfirmedEmail({
      company_name: "Test Co",
    });
    expect(html).toContain("one-time code");
  });

  it("escapes HTML in company name", () => {
    const { html } = buildPartnershipConfirmedEmail({
      company_name: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
