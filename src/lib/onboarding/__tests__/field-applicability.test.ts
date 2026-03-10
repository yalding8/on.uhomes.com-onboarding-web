import { describe, it, expect } from "vitest";
import { getExcludedFields } from "../field-applicability";
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

describe("getExcludedFields", () => {
  it("excludes i20_accepted when country is not US", () => {
    const fields = { country: fv("United Kingdom") };
    const excluded = getExcludedFields(fields);
    expect(excluded.has("i20_accepted")).toBe(true);
  });

  it("includes i20_accepted when country is US", () => {
    const fields = { country: fv("United States") };
    const excluded = getExcludedFields(fields);
    expect(excluded.has("i20_accepted")).toBe(false);
  });

  it("includes i20_accepted for USA alias", () => {
    const fields = { country: fv("USA") };
    const excluded = getExcludedFields(fields);
    expect(excluded.has("i20_accepted")).toBe(false);
  });

  it("excludes pet_fee when key_amenities has no Pet Friendly", () => {
    const fields = { key_amenities: fv(["Gym", "Pool"]) };
    const excluded = getExcludedFields(fields);
    expect(excluded.has("pet_fee")).toBe(true);
    expect(excluded.has("pet_rent")).toBe(true);
  });

  it("includes pet_fee when key_amenities has Pet Friendly", () => {
    const fields = { key_amenities: fv(["Gym", "Pet Friendly"]) };
    const excluded = getExcludedFields(fields);
    expect(excluded.has("pet_fee")).toBe(false);
    expect(excluded.has("pet_rent")).toBe(false);
  });

  it("excludes commission_short_term when no commission_structure", () => {
    const fields = { commission_structure: fv("") };
    const excluded = getExcludedFields(fields);
    expect(excluded.has("commission_short_term")).toBe(true);
    expect(excluded.has("commission_renewals")).toBe(true);
  });

  it("includes commission_short_term when commission_structure filled", () => {
    const fields = { commission_structure: fv("10% per booking") };
    const excluded = getExcludedFields(fields);
    expect(excluded.has("commission_short_term")).toBe(false);
  });

  it("returns empty set when all conditions are met", () => {
    const fields = {
      country: fv("US"),
      key_amenities: fv(["Pet Friendly"]),
      commission_structure: fv("10%"),
    };
    const excluded = getExcludedFields(fields);
    expect(excluded.size).toBe(0);
  });
});
