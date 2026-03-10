import { describe, it, expect } from "vitest";
import { adjustConfidence } from "../confidence-adjuster";
import type { ExtractionFieldValue } from "../data-merge";

function makeFields(
  conf: "high" | "medium" | "low",
): Record<string, ExtractionFieldValue> {
  return {
    building_name: { value: "Test", confidence: conf },
    city: { value: "NYC", confidence: conf },
  };
}

describe("adjustConfidence", () => {
  it("returns unchanged fields when quality is 'good'", () => {
    const fields = makeFields("high");
    const result = adjustConfidence(fields, "good");
    expect(result.adjusted.building_name.confidence).toBe("high");
    expect(result.downgradedFields).toHaveLength(0);
  });

  it("returns unchanged fields when quality is null", () => {
    const result = adjustConfidence(makeFields("medium"), null);
    expect(result.adjusted.building_name.confidence).toBe("medium");
    expect(result.downgradedFields).toHaveLength(0);
  });

  it("downgrades all fields on 'poor' quality", () => {
    const result = adjustConfidence(makeFields("high"), "poor");
    expect(result.adjusted.building_name.confidence).toBe("medium");
    expect(result.adjusted.city.confidence).toBe("medium");
    expect(result.downgradedFields).toEqual(["building_name", "city"]);
  });

  it("downgrades medium→low on 'poor' quality", () => {
    const result = adjustConfidence(makeFields("medium"), "poor");
    expect(result.adjusted.building_name.confidence).toBe("low");
  });

  it("keeps low as low on 'poor' quality", () => {
    const result = adjustConfidence(makeFields("low"), "poor");
    expect(result.adjusted.building_name.confidence).toBe("low");
    expect(result.downgradedFields).toHaveLength(0);
  });

  it("on 'mixed', only downgrades non-high fields", () => {
    const fields: Record<string, ExtractionFieldValue> = {
      a: { value: "x", confidence: "high" },
      b: { value: "y", confidence: "medium" },
      c: { value: "z", confidence: "low" },
    };
    const result = adjustConfidence(fields, "mixed");
    expect(result.adjusted.a.confidence).toBe("high");
    expect(result.adjusted.b.confidence).toBe("low");
    expect(result.adjusted.c.confidence).toBe("low");
    expect(result.downgradedFields).toEqual(["b"]);
  });
});
