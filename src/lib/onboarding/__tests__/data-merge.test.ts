/** Data Merge 单元测试 — mergeExtractionResults / mergeWithProtection */

import { describe, it, expect } from "vitest";
import { mergeExtractionResults, mergeWithProtection } from "../data-merge";
import type { ExtractionResult } from "../data-merge";
import type { FieldValue } from "../field-value";

// ── Helpers ──

function makeFieldValue(
  overrides: Partial<FieldValue> & {
    value: unknown;
    source: FieldValue["source"];
  },
): FieldValue {
  return {
    confidence: "high",
    updatedBy: "system",
    updatedAt: "2026-02-26T00:00:00Z",
    ...overrides,
  };
}

// ── mergeExtractionResults ──

describe("mergeExtractionResults", () => {
  it("returns empty object for empty results", () => {
    const merged = mergeExtractionResults([]);
    expect(merged).toEqual({});
  });

  it("merges single source correctly", () => {
    const results: ExtractionResult[] = [
      {
        source: "contract_pdf",
        fields: {
          building_name: { value: "Tower A", confidence: "high" },
          price_min: { value: 1200, confidence: "medium" },
        },
      },
    ];

    const merged = mergeExtractionResults(results);

    expect(merged.building_name.value).toBe("Tower A");
    expect(merged.building_name.source).toBe("contract_pdf");
    expect(merged.building_name.confidence).toBe("high");
    expect(merged.building_name.updatedBy).toBe("system");
    expect(merged.price_min.value).toBe(1200);
    expect(merged.price_min.source).toBe("contract_pdf");
  });

  it("selects contract_pdf over google_sheets and website_crawl", () => {
    const results: ExtractionResult[] = [
      {
        source: "website_crawl",
        fields: { building_name: { value: "From Website", confidence: "low" } },
      },
      {
        source: "google_sheets",
        fields: {
          building_name: { value: "From Sheets", confidence: "medium" },
        },
      },
      {
        source: "contract_pdf",
        fields: {
          building_name: { value: "From Contract", confidence: "high" },
        },
      },
    ];

    const merged = mergeExtractionResults(results);

    expect(merged.building_name.value).toBe("From Contract");
    expect(merged.building_name.source).toBe("contract_pdf");
  });

  it("selects google_sheets over website_crawl", () => {
    const results: ExtractionResult[] = [
      {
        source: "website_crawl",
        fields: { city: { value: "Vancouver", confidence: "low" } },
      },
      {
        source: "google_sheets",
        fields: { city: { value: "Toronto", confidence: "medium" } },
      },
    ];

    const merged = mergeExtractionResults(results);

    expect(merged.city.value).toBe("Toronto");
    expect(merged.city.source).toBe("google_sheets");
  });

  it("merges non-overlapping fields from multiple sources", () => {
    const results: ExtractionResult[] = [
      {
        source: "contract_pdf",
        fields: { building_name: { value: "Tower A", confidence: "high" } },
      },
      {
        source: "website_crawl",
        fields: {
          key_amenities: { value: ["gym", "pool"], confidence: "medium" },
        },
      },
      {
        source: "google_sheets",
        fields: { price_min: { value: 1200, confidence: "high" } },
      },
    ];

    const merged = mergeExtractionResults(results);

    expect(Object.keys(merged)).toHaveLength(3);
    expect(merged.building_name.source).toBe("contract_pdf");
    expect(merged.key_amenities.source).toBe("website_crawl");
    expect(merged.price_min.source).toBe("google_sheets");
  });

  it("skips null, undefined, empty string, and empty array values", () => {
    const results: ExtractionResult[] = [
      {
        source: "contract_pdf",
        fields: {
          a: { value: null, confidence: "high" },
          b: { value: undefined, confidence: "high" },
          c: { value: "", confidence: "high" },
          d: { value: "  ", confidence: "high" },
          e: { value: [], confidence: "high" },
          f: { value: "valid", confidence: "high" },
        },
      },
    ];

    const merged = mergeExtractionResults(results);

    expect(Object.keys(merged)).toEqual(["f"]);
  });

  it("every merged field has source, confidence, updatedBy, updatedAt metadata", () => {
    const results: ExtractionResult[] = [
      {
        source: "contract_pdf",
        fields: {
          a: { value: "val1", confidence: "high" },
          b: { value: 42, confidence: "low" },
        },
      },
    ];

    const merged = mergeExtractionResults(results);

    for (const fv of Object.values(merged)) {
      expect(fv).toHaveProperty("source");
      expect(fv).toHaveProperty("confidence");
      expect(fv).toHaveProperty("updatedBy");
      expect(fv).toHaveProperty("updatedAt");
    }
  });
});

// ── mergeWithProtection ──

describe("mergeWithProtection", () => {
  it("writes new fields that don't exist in existing", () => {
    const existing: Record<string, FieldValue> = {};
    const incoming: Record<string, FieldValue> = {
      building_name: makeFieldValue({
        value: "Tower A",
        source: "contract_pdf",
      }),
    };

    const merged = mergeWithProtection(existing, incoming);

    expect(merged.building_name.value).toBe("Tower A");
  });

  it("does NOT overwrite confirmed fields", () => {
    const existing: Record<string, FieldValue> = {
      building_name: makeFieldValue({
        value: "User Confirmed Name",
        source: "manual_input",
        confirmedBy: "user-123",
        confirmedAt: "2026-02-25T00:00:00Z",
      }),
    };
    const incoming: Record<string, FieldValue> = {
      building_name: makeFieldValue({
        value: "From Extraction",
        source: "contract_pdf",
      }),
    };

    const merged = mergeWithProtection(existing, incoming);

    expect(merged.building_name.value).toBe("User Confirmed Name");
    expect(merged.building_name.confirmedBy).toBe("user-123");
  });

  it("overwrites unconfirmed fields with higher priority source", () => {
    const existing: Record<string, FieldValue> = {
      city: makeFieldValue({ value: "Vancouver", source: "website_crawl" }),
    };
    const incoming: Record<string, FieldValue> = {
      city: makeFieldValue({ value: "Toronto", source: "google_sheets" }),
    };

    const merged = mergeWithProtection(existing, incoming);

    expect(merged.city.value).toBe("Toronto");
    expect(merged.city.source).toBe("google_sheets");
  });

  it("overwrites unconfirmed fields with same priority source", () => {
    const existing: Record<string, FieldValue> = {
      city: makeFieldValue({ value: "Old Value", source: "google_sheets" }),
    };
    const incoming: Record<string, FieldValue> = {
      city: makeFieldValue({ value: "New Value", source: "google_sheets" }),
    };

    const merged = mergeWithProtection(existing, incoming);

    expect(merged.city.value).toBe("New Value");
  });

  it("does NOT overwrite with lower priority source", () => {
    const existing: Record<string, FieldValue> = {
      city: makeFieldValue({ value: "From Contract", source: "contract_pdf" }),
    };
    const incoming: Record<string, FieldValue> = {
      city: makeFieldValue({ value: "From Website", source: "website_crawl" }),
    };

    const merged = mergeWithProtection(existing, incoming);

    expect(merged.city.value).toBe("From Contract");
    expect(merged.city.source).toBe("contract_pdf");
  });

  it("preserves existing fields not present in incoming", () => {
    const existing: Record<string, FieldValue> = {
      building_name: makeFieldValue({
        value: "Tower A",
        source: "contract_pdf",
      }),
      city: makeFieldValue({ value: "Toronto", source: "manual_input" }),
    };
    const incoming: Record<string, FieldValue> = {
      price_min: makeFieldValue({ value: 1200, source: "google_sheets" }),
    };

    const merged = mergeWithProtection(existing, incoming);

    expect(Object.keys(merged)).toHaveLength(3);
    expect(merged.building_name.value).toBe("Tower A");
    expect(merged.city.value).toBe("Toronto");
    expect(merged.price_min.value).toBe(1200);
  });

  it("handles mix of confirmed, unconfirmed, and new fields", () => {
    const existing: Record<string, FieldValue> = {
      confirmed_field: makeFieldValue({
        value: "Confirmed",
        source: "manual_input",
        confirmedBy: "user-1",
        confirmedAt: "2026-02-25T00:00:00Z",
      }),
      unconfirmed_field: makeFieldValue({
        value: "Old",
        source: "website_crawl",
      }),
    };
    const incoming: Record<string, FieldValue> = {
      confirmed_field: makeFieldValue({
        value: "Override attempt",
        source: "contract_pdf",
      }),
      unconfirmed_field: makeFieldValue({
        value: "New",
        source: "contract_pdf",
      }),
      new_field: makeFieldValue({
        value: "Brand New",
        source: "google_sheets",
      }),
    };

    const merged = mergeWithProtection(existing, incoming);

    expect(merged.confirmed_field.value).toBe("Confirmed");
    expect(merged.unconfirmed_field.value).toBe("New");
    expect(merged.new_field.value).toBe("Brand New");
  });
});
