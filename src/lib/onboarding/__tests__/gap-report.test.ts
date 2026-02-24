import { describe, it, expect } from "vitest";
import { generateGapReport } from "../gap-report";
import type { FieldDefinition } from "../field-schema";
import type { FieldValue } from "../field-value";

const makeField = (
  key: string,
  category: FieldDefinition["category"] = "basic_info",
  tier: FieldDefinition["extractTier"] = "A",
): FieldDefinition => ({
  key,
  label: key,
  category,
  type: "text",
  weight: 5,
  extractTier: tier,
  required: true,
});

const makeFV = (value: unknown): FieldValue => ({
  value,
  source: "manual_input",
  confidence: "high",
  updatedBy: "test",
  updatedAt: new Date().toISOString(),
});

describe("generateGapReport", () => {
  it("reports all fields missing when no values", () => {
    const schema = [makeField("a"), makeField("b")];
    const report = generateGapReport(schema, {}, "b1");
    expect(report.filledFields).toBe(0);
    expect(report.totalFields).toBe(2);
    expect(report.missingByCategory.basic_info).toHaveLength(2);
  });

  it("reports no missing fields when all filled", () => {
    const schema = [makeField("a")];
    const report = generateGapReport(schema, { a: makeFV("ok") });
    expect(report.filledFields).toBe(1);
    expect(Object.keys(report.missingByCategory)).toHaveLength(0);
  });

  it("maps extractTier to correct suggestion", () => {
    const schema = [
      makeField("a", "basic_info", "A"),
      makeField("b", "contacts", "B"),
      makeField("c", "fees", "C"),
    ];
    const report = generateGapReport(schema, {});
    expect(report.missingByCategory.basic_info?.[0].suggestion).toBe(
      "Auto-extractable",
    );
    expect(report.missingByCategory.contacts?.[0].suggestion).toBe("Needs confirmation");
    expect(report.missingByCategory.fees?.[0].suggestion).toBe("Manual input required");
  });

  it("groups missing fields by category", () => {
    const schema = [
      makeField("a", "basic_info"),
      makeField("b", "basic_info"),
      makeField("c", "fees"),
    ];
    const report = generateGapReport(schema, {});
    expect(report.missingByCategory.basic_info).toHaveLength(2);
    expect(report.missingByCategory.fees).toHaveLength(1);
  });
});
