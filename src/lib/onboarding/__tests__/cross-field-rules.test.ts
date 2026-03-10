import { describe, it, expect } from "vitest";
import {
  validatePriceContext,
  normalizeCountryRegion,
} from "../cross-field-rules";
import type { FieldValue } from "../field-value";

function fv(value: unknown): FieldValue {
  return {
    value,
    source: "manual_input",
    confidence: "high",
    updatedBy: "test",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("normalizeCountryRegion", () => {
  it("normalizes US aliases", () => {
    expect(normalizeCountryRegion("United States")).toBe("US");
    expect(normalizeCountryRegion("USA")).toBe("US");
    expect(normalizeCountryRegion("us")).toBe("US");
  });

  it("normalizes UK aliases", () => {
    expect(normalizeCountryRegion("United Kingdom")).toBe("UK");
    expect(normalizeCountryRegion("GB")).toBe("UK");
    expect(normalizeCountryRegion("England")).toBe("UK");
  });

  it("normalizes AU/CA", () => {
    expect(normalizeCountryRegion("Australia")).toBe("AU");
    expect(normalizeCountryRegion("Canada")).toBe("CA");
  });

  it("normalizes EU countries", () => {
    expect(normalizeCountryRegion("Germany")).toBe("EU");
    expect(normalizeCountryRegion("France")).toBe("EU");
    expect(normalizeCountryRegion("NL")).toBe("EU");
  });

  it("returns DEFAULT for unknown", () => {
    expect(normalizeCountryRegion("Japan")).toBe("DEFAULT");
    expect(normalizeCountryRegion(undefined)).toBe("DEFAULT");
  });
});

describe("validatePriceContext", () => {
  it("returns no warnings for normal US prices", () => {
    const fields = {
      country: fv("US"),
      rental_method: fv("Per Bedroom"),
      rent_period: fv("Monthly"),
      price_min: fv(800),
      price_max: fv(2500),
    };
    const warnings = validatePriceContext(fields);
    expect(warnings).toHaveLength(0);
  });

  it("warns when price_min is too low for US", () => {
    const fields = {
      country: fv("US"),
      rental_method: fv("Per Bedroom"),
      rent_period: fv("Monthly"),
      price_min: fv(50),
      price_max: fv(2500),
    };
    const warnings = validatePriceContext(fields);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe("price_min");
    expect(warnings[0].severity).toBe("warning");
  });

  it("warns when price_max is too high for UK weekly", () => {
    const fields = {
      country: fv("UK"),
      rental_method: fv("Per Bedroom"),
      rent_period: fv("Weekly"),
      price_min: fv(100),
      price_max: fv(1000),
    };
    const warnings = validatePriceContext(fields);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe("price_max");
  });

  it("uses DEFAULT range for unknown country", () => {
    const fields = {
      country: fv("Japan"),
      price_min: fv(100),
      price_max: fv(5000),
    };
    const warnings = validatePriceContext(fields);
    expect(warnings).toHaveLength(0);
  });

  it("returns no warnings when price fields are missing", () => {
    const fields = { country: fv("US") };
    const warnings = validatePriceContext(fields);
    expect(warnings).toHaveLength(0);
  });

  it("handles Per Semester pricing for UK", () => {
    const fields = {
      country: fv("UK"),
      rental_method: fv("Per Bedroom"),
      rent_period: fv("Per Semester"),
      price_min: fv(3000),
      price_max: fv(8000),
    };
    const warnings = validatePriceContext(fields);
    expect(warnings).toHaveLength(0);
  });

  it("warns on both min and max simultaneously", () => {
    const fields = {
      country: fv("US"),
      rental_method: fv("Per Bedroom"),
      rent_period: fv("Monthly"),
      price_min: fv(10),
      price_max: fv(50000),
    };
    const warnings = validatePriceContext(fields);
    expect(warnings).toHaveLength(2);
  });
});
