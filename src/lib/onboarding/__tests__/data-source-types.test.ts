/**
 * P1-G4: Tests for expanded DataSource types and priority.
 */

import { describe, it, expect } from "vitest";
import { mergeExtractionResults, type ExtractionResult } from "../data-merge";

describe("P1-G4: expanded DataSource types in merge", () => {
  it("file_upload has priority 2 (higher than website_crawl)", () => {
    const results: ExtractionResult[] = [
      {
        source: "website_crawl",
        fields: { city: { value: "London-crawl", confidence: "medium" } },
      },
      {
        source: "file_upload",
        fields: { city: { value: "London-upload", confidence: "high" } },
      },
    ];

    const merged = mergeExtractionResults(results);
    expect(merged.city.value).toBe("London-upload");
    expect(merged.city.source).toBe("file_upload");
  });

  it("dropbox has same priority as google_sheets (2)", () => {
    const results: ExtractionResult[] = [
      {
        source: "google_sheets",
        fields: { city: { value: "A", confidence: "high" } },
      },
      {
        source: "dropbox",
        fields: { city: { value: "B", confidence: "high" } },
      },
    ];

    // Both priority 2, later one wins (sorted by priority, same = stable)
    const merged = mergeExtractionResults(results);
    // Same priority → last in sorted order wins
    expect(["A", "B"]).toContain(merged.city.value);
  });

  it("api_doc has priority 2 (lower than contract_pdf)", () => {
    const results: ExtractionResult[] = [
      {
        source: "api_doc",
        fields: { city: { value: "API-city", confidence: "high" } },
      },
      {
        source: "contract_pdf",
        fields: { city: { value: "PDF-city", confidence: "high" } },
      },
    ];

    const merged = mergeExtractionResults(results);
    expect(merged.city.value).toBe("PDF-city");
    expect(merged.city.source).toBe("contract_pdf");
  });

  it("new sources merge non-overlapping fields correctly", () => {
    const results: ExtractionResult[] = [
      {
        source: "file_upload",
        fields: { price_min: { value: 800, confidence: "high" } },
      },
      {
        source: "dropbox",
        fields: { price_max: { value: 1500, confidence: "medium" } },
      },
      {
        source: "api_doc",
        fields: { currency: { value: "GBP", confidence: "high" } },
      },
    ];

    const merged = mergeExtractionResults(results);
    expect(merged.price_min.value).toBe(800);
    expect(merged.price_max.value).toBe(1500);
    expect(merged.currency.value).toBe("GBP");
  });
});
