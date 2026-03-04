/**
 * S2.1 Address Formatting — Unit Tests
 * Test IDs: S2-U01, S2-U02
 */
import { describe, it, expect } from "vitest";
import { formatAddress, parseAddressHeuristic } from "../address-format";

describe("formatAddress", () => {
  // S2-U01: US format
  it("formats US address correctly", () => {
    const result = formatAddress(
      {
        street_number: "411",
        street_name: "Duplex Ave",
        city: "Toronto",
        state_province: "ON",
        postal_code: "M4R 1V2",
      },
      "US",
    );
    expect(result).toBe("411 Duplex Ave, Toronto ON M4R 1V2");
  });

  it("formats US address with unit number", () => {
    const result = formatAddress(
      {
        street_number: "123",
        street_name: "Main St",
        unit_number: "Apt 4B",
        city: "New York",
        state_province: "NY",
        postal_code: "10001",
      },
      "US",
    );
    expect(result).toBe("123 Main St Apt 4B, New York NY 10001");
  });

  // S2-U02: Japanese format (postal code first)
  it("formats JP address correctly", () => {
    const result = formatAddress(
      {
        postal_code: "150-0001",
        state_province: "Tokyo",
        city: "Shibuya",
        street_name: "Jingumae",
        street_number: "1-2-3",
      },
      "JP",
    );
    // JP format: postal_code state city street_name street_number
    expect(result).toContain("150-0001");
    expect(result).toContain("Tokyo");
    expect(result).toContain("Shibuya");
  });

  it("formats AU address (unit first)", () => {
    const result = formatAddress(
      {
        unit_number: "Unit 5",
        street_number: "42",
        street_name: "George St",
        city: "Sydney",
        state_province: "NSW",
        postal_code: "2000",
      },
      "AU",
    );
    expect(result).toBe("Unit 5 42 George St, Sydney NSW 2000");
  });

  it("formats DE address (street+number then postal+city)", () => {
    const result = formatAddress(
      {
        street_name: "Friedrichstraße",
        street_number: "43",
        postal_code: "10117",
        city: "Berlin",
      },
      "DE",
    );
    expect(result).toBe("Friedrichstraße 43, 10117 Berlin");
  });

  it("handles missing fields gracefully", () => {
    const result = formatAddress({ city: "London" }, "GB");
    expect(result).toBe("London");
  });

  it("returns empty string for empty components", () => {
    expect(formatAddress({})).toBe("");
  });

  it("uses default (US-style) format for unknown country", () => {
    const result = formatAddress(
      { street_number: "1", street_name: "Test Rd", city: "Somewhere" },
      "ZZ",
    );
    expect(result).toBe("1 Test Rd, Somewhere");
  });
});

describe("parseAddressHeuristic", () => {
  it("splits comma-separated address into parts", () => {
    const result = parseAddressHeuristic("411 Duplex Ave, Toronto, ON, M4R");
    expect(result.street_name).toBe("411 Duplex Ave");
    expect(result.city).toBe("Toronto");
    expect(result.state_province).toBe("ON");
    expect(result.postal_code).toBe("M4R");
  });

  it("handles single-part address", () => {
    const result = parseAddressHeuristic("Sydney");
    expect(result.street_name).toBe("Sydney");
  });

  it("returns empty for empty string", () => {
    const result = parseAddressHeuristic("");
    expect(result).toEqual({});
  });
});
