import { describe, it, expect } from "vitest";
import { calculateScore } from "../scoring-engine";
import type { FieldDefinition } from "../field-schema";
import type { FieldValue } from "../field-value";

const makeField = (key: string, weight: number): FieldDefinition => ({
  key,
  label: key,
  category: "basic_info",
  type: "text",
  weight,
  extractTier: "A",
  required: true,
  phase: 1,
});

const makeFV = (
  value: unknown,
  confidence: "high" | "medium" | "low" = "high",
): FieldValue => ({
  value,
  source: "manual_input",
  confidence,
  updatedBy: "test",
  updatedAt: new Date().toISOString(),
});

describe("calculateScore", () => {
  it("returns 0 for empty field values", () => {
    const schema = [makeField("a", 5), makeField("b", 5)];
    const result = calculateScore(schema, {});
    expect(result.score).toBe(0);
    expect(result.missingFields).toEqual(["a", "b"]);
  });

  it("returns 100 for all fields filled with high confidence", () => {
    const schema = [makeField("a", 5), makeField("b", 5)];
    const values: Record<string, FieldValue> = {
      a: makeFV("hello"),
      b: makeFV("world"),
    };
    const result = calculateScore(schema, values);
    expect(result.score).toBe(100);
    expect(result.missingFields).toEqual([]);
  });

  it("calculates weighted score correctly", () => {
    const schema = [makeField("a", 8), makeField("b", 2)];
    const values: Record<string, FieldValue> = { a: makeFV("filled") };
    const result = calculateScore(schema, values);
    // 8 / 10 * 100 = 80
    expect(result.score).toBe(80);
    expect(result.filledWeight).toBe(8);
    expect(result.totalWeight).toBe(10);
  });

  it("returns 0 for empty schema", () => {
    const result = calculateScore([], {});
    expect(result.score).toBe(0);
  });

  it("treats empty string as missing", () => {
    const schema = [makeField("a", 10)];
    const values: Record<string, FieldValue> = { a: makeFV("") };
    const result = calculateScore(schema, values);
    expect(result.score).toBe(0);
    expect(result.missingFields).toEqual(["a"]);
  });

  it("treats empty array as missing", () => {
    const schema = [makeField("a", 10)];
    const values: Record<string, FieldValue> = { a: makeFV([]) };
    const result = calculateScore(schema, values);
    expect(result.score).toBe(0);
  });

  it("rounds correctly at boundary (79.5 → 80)", () => {
    const schema = [makeField("a", 159), makeField("b", 41)];
    const values: Record<string, FieldValue> = { a: makeFV("yes") };
    const result = calculateScore(schema, values);
    expect(result.score).toBe(80);
  });

  // ── Confidence weighting tests ──

  it("applies medium confidence multiplier (0.7)", () => {
    const schema = [makeField("a", 10)];
    const values: Record<string, FieldValue> = {
      a: makeFV("val", "medium"),
    };
    const result = calculateScore(schema, values);
    // 10 * 0.7 / 10 * 100 = 70
    expect(result.score).toBe(70);
    expect(result.filledWeight).toBe(7);
  });

  it("applies low confidence multiplier (0.3)", () => {
    const schema = [makeField("a", 10)];
    const values: Record<string, FieldValue> = {
      a: makeFV("val", "low"),
    };
    const result = calculateScore(schema, values);
    // 10 * 0.3 / 10 * 100 = 30
    expect(result.score).toBe(30);
    expect(result.filledWeight).toBeCloseTo(3);
  });

  it("mixes confidence levels correctly", () => {
    const schema = [makeField("a", 10), makeField("b", 10)];
    const values: Record<string, FieldValue> = {
      a: makeFV("high", "high"),
      b: makeFV("low", "low"),
    };
    const result = calculateScore(schema, values);
    // (10*1.0 + 10*0.3) / 20 * 100 = 13/20*100 = 65
    expect(result.score).toBe(65);
  });

  it("defaults to high confidence when confidence is undefined", () => {
    const schema = [makeField("a", 10)];
    const values: Record<string, FieldValue> = {
      a: {
        value: "test",
        source: "manual_input",
        confidence: undefined as unknown as "high",
        updatedBy: "test",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    };
    const result = calculateScore(schema, values);
    expect(result.score).toBe(100);
  });

  // ── excludedFields tests ──

  it("excludes fields from scoring when in excludedFields set", () => {
    const schema = [makeField("a", 10), makeField("b", 10)];
    const values: Record<string, FieldValue> = { a: makeFV("filled") };
    const excluded = new Set(["b"]);
    const result = calculateScore(schema, values, excluded);
    // Only "a" counts: 10/10 = 100
    expect(result.score).toBe(100);
    expect(result.totalWeight).toBe(10);
  });

  it("handles all fields excluded gracefully", () => {
    const schema = [makeField("a", 10)];
    const excluded = new Set(["a"]);
    const result = calculateScore(schema, {}, excluded);
    expect(result.score).toBe(0);
    expect(result.totalWeight).toBe(0);
  });

  it("records confidence in fieldDetails", () => {
    const schema = [makeField("a", 10)];
    const values: Record<string, FieldValue> = {
      a: makeFV("val", "medium"),
    };
    const result = calculateScore(schema, values);
    expect(result.fieldDetails.a.confidence).toBe("medium");
  });
});
