import { describe, it, expect } from "vitest";
import {
  scoreDescriptionQuality,
  scoreRichness,
  calculateMultiDimensionalScore,
  canPublish,
  type MultiDimInput,
} from "../scoring-v2";

// ── S1-U12 / S1-U13: Description quality scoring ──
describe("scoreDescriptionQuality", () => {
  it("S1-U12: returns 20 for short description (<50 chars)", () => {
    expect(scoreDescriptionQuality("Nice apartment")).toBe(20);
  });

  it("returns 50 for 50-100 char description", () => {
    const desc = "A".repeat(75);
    expect(scoreDescriptionQuality(desc)).toBe(50);
  });

  it("returns 80 for 100-300 char description", () => {
    const desc = "A".repeat(200);
    expect(scoreDescriptionQuality(desc)).toBe(80);
  });

  it("S1-U13: returns 100 for >300 char description", () => {
    const desc = "A".repeat(350);
    expect(scoreDescriptionQuality(desc)).toBe(100);
  });

  it("returns 0 for empty description", () => {
    expect(scoreDescriptionQuality("")).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(scoreDescriptionQuality(undefined)).toBe(0);
  });
});

// ── Richness scoring ──
describe("scoreRichness", () => {
  it("returns 0 when no optional fields filled", () => {
    expect(scoreRichness(0, 10, "")).toBe(0);
  });

  it("returns 50 when all optional filled but no description", () => {
    expect(scoreRichness(10, 10, "")).toBe(50);
  });

  it("returns 100 when all optional filled and long description", () => {
    expect(scoreRichness(10, 10, "A".repeat(350))).toBe(100);
  });

  it("calculates fill rate correctly", () => {
    // 5/10 = 50% fill rate → 50% * 0.5 = 25 richness from fields
    // short desc "hi" = 20 desc quality → 20 * 0.5 = 10 from desc
    // total = 25 + 10 = 35
    expect(scoreRichness(5, 10, "hi")).toBe(35);
  });
});

// ── S1-U09 through S1-U11: Multi-dimensional composite score ──
describe("calculateMultiDimensionalScore", () => {
  it("S1-U09: returns 0 for all empty", () => {
    const input: MultiDimInput = {
      completenessScore: 0,
      photoScore: 0,
      descriptionQuality: 0,
      dataConsistency: 0,
      richness: 0,
    };
    const result = calculateMultiDimensionalScore(input);
    expect(result.total).toBe(0);
    expect(result.completeness).toBe(0);
    expect(result.quality).toBe(0);
    expect(result.richness).toBe(0);
  });

  it("S1-U10: only completeness passes", () => {
    const input: MultiDimInput = {
      completenessScore: 100,
      photoScore: 0,
      descriptionQuality: 0,
      dataConsistency: 0,
      richness: 0,
    };
    const result = calculateMultiDimensionalScore(input);
    expect(result.completeness).toBe(100);
    expect(result.quality).toBe(0);
    expect(result.richness).toBe(0);
    // Total = 100*0.50 + 0*0.30 + 0*0.20 = 50
    expect(result.total).toBe(50);
  });

  it("calculates weighted total correctly", () => {
    const input: MultiDimInput = {
      completenessScore: 80,
      photoScore: 70,
      descriptionQuality: 60,
      dataConsistency: 90,
      richness: 50,
    };
    const result = calculateMultiDimensionalScore(input);
    // quality = photo*0.4 + desc*0.3 + consistency*0.3 = 28+18+27 = 73
    expect(result.quality).toBe(73);
    // total = 80*0.50 + 73*0.30 + 50*0.20 = 40 + 21.9 + 10 = 71.9 → 72
    expect(result.total).toBe(72);
  });

  it("returns perfect 100 for all maxed", () => {
    const input: MultiDimInput = {
      completenessScore: 100,
      photoScore: 100,
      descriptionQuality: 100,
      dataConsistency: 100,
      richness: 100,
    };
    const result = calculateMultiDimensionalScore(input);
    expect(result.total).toBe(100);
  });
});

// ── S1-U11: 80-point publish boundary ──
describe("canPublish", () => {
  it("S1-U11: score 79 cannot publish", () => {
    expect(canPublish(79)).toBe(false);
  });

  it("S1-U11: score 80 can publish", () => {
    expect(canPublish(80)).toBe(true);
  });

  it("score 100 can publish", () => {
    expect(canPublish(100)).toBe(true);
  });

  it("score 0 cannot publish", () => {
    expect(canPublish(0)).toBe(false);
  });
});
