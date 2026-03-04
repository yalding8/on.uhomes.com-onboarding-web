/**
 * S3.2 Signing Route — Unit Tests
 * Test IDs: S3-U05, S3-U06
 */
import { describe, it, expect } from "vitest";
import { getSigningMethod, isDocuSignVerified } from "../signing-route";

describe("getSigningMethod", () => {
  // S3-U05: DocuSign for verified countries
  it.each([
    "US",
    "CA",
    "GB",
    "AU",
    "NZ",
    "IE",
    "DE",
    "FR",
    "NL",
    "HK",
    "MO",
    "SG",
    "JP",
    "IT",
    "ES",
    "SE",
    "DK",
    "NO",
    "FI",
    "CH",
    "BE",
    "AT",
    "PT",
  ])("returns 'docusign' for %s", (country) => {
    expect(getSigningMethod(country)).toBe("docusign");
  });

  // S3-U06: Wet-ink fallback for unverified countries
  it.each(["ZZ", "IN", "BR", "NG", "KE", "TH", "VN", "PH"])(
    "returns 'wet_ink_upload' for %s",
    (country) => {
      expect(getSigningMethod(country)).toBe("wet_ink_upload");
    },
  );

  it("is case-insensitive", () => {
    expect(getSigningMethod("us")).toBe("docusign");
    expect(getSigningMethod("Us")).toBe("docusign");
  });
});

describe("isDocuSignVerified", () => {
  it("returns true for verified countries", () => {
    expect(isDocuSignVerified("US")).toBe(true);
    expect(isDocuSignVerified("HK")).toBe(true);
  });

  it("returns false for unverified countries", () => {
    expect(isDocuSignVerified("IN")).toBe(false);
    expect(isDocuSignVerified("ZZ")).toBe(false);
  });
});
