import { describe, it, expect } from "vitest";
import {
  scoreQuantity,
  scoreResolution,
  scoreCategoryCoverage,
  scoreIntegrity,
  calculatePhotoScore,
  getPhotoTier,
  type ImageMeta,
  IMAGE_CATEGORIES,
} from "../photo-scoring";

// ── S1-U01: Photo quantity score: 0 photos ──
describe("scoreQuantity", () => {
  it("S1-U01: returns 0 for 0 photos", () => {
    expect(scoreQuantity(0)).toBe(0);
  });

  it("returns 30 for 1 photo", () => {
    expect(scoreQuantity(1)).toBe(30);
  });

  it("returns 30 for 2 photos", () => {
    expect(scoreQuantity(2)).toBe(30);
  });

  // S1-U02: Photo quantity score: 3 photos
  it("S1-U02: returns 60 for 3 photos", () => {
    expect(scoreQuantity(3)).toBe(60);
  });

  it("returns 60 for 5 photos", () => {
    expect(scoreQuantity(5)).toBe(60);
  });

  it("returns 80 for 6 photos", () => {
    expect(scoreQuantity(6)).toBe(80);
  });

  it("returns 80 for 9 photos", () => {
    expect(scoreQuantity(9)).toBe(80);
  });

  // S1-U03: Photo quantity score: 10 photos
  it("S1-U03: returns 100 for 10 photos", () => {
    expect(scoreQuantity(10)).toBe(100);
  });

  it("returns 100 for 15 photos", () => {
    expect(scoreQuantity(15)).toBe(100);
  });
});

// ── S1-U04 / S1-U05: Resolution scoring ──
describe("scoreResolution", () => {
  it("S1-U04: returns 0 for width below 800px", () => {
    expect(scoreResolution(640)).toBe(0);
  });

  it("returns 50 for width 800px", () => {
    expect(scoreResolution(800)).toBe(50);
  });

  it("returns 50 for width 1200px", () => {
    expect(scoreResolution(1200)).toBe(50);
  });

  it("S1-U05: returns 100 for width above 1200px", () => {
    expect(scoreResolution(1920)).toBe(100);
  });

  it("returns 0 for width 0", () => {
    expect(scoreResolution(0)).toBe(0);
  });
});

// ── S1-U06 / S1-U07: Category coverage scoring ──
describe("scoreCategoryCoverage", () => {
  it("S1-U06: returns 20 for exterior only", () => {
    expect(scoreCategoryCoverage(["exterior"])).toBe(20);
  });

  it("returns 40 for exterior + bedroom", () => {
    expect(scoreCategoryCoverage(["exterior", "bedroom"])).toBe(40);
  });

  it("returns 60 for all 3 required categories", () => {
    expect(scoreCategoryCoverage(["exterior", "bedroom", "bathroom"])).toBe(60);
  });

  it("returns 67 for 3 required + 1 optional", () => {
    // 3 required × 20 = 60, 1/6 optional → round(1/6 × 40) = 7 → total 67
    expect(
      scoreCategoryCoverage(["exterior", "bedroom", "bathroom", "lobby"]),
    ).toBe(67);
  });

  it("S1-U07: returns 100 for all 9 categories", () => {
    expect(scoreCategoryCoverage([...IMAGE_CATEGORIES])).toBe(100);
  });

  it("returns 0 for empty categories", () => {
    expect(scoreCategoryCoverage([])).toBe(0);
  });

  it("deduplicates repeated categories", () => {
    expect(scoreCategoryCoverage(["exterior", "exterior", "exterior"])).toBe(
      20,
    );
  });
});

// ── Integrity scoring ──
describe("scoreIntegrity", () => {
  it("returns 100 when all flags are clean", () => {
    expect(
      scoreIntegrity({ hasWatermark: false, isStock: false, isBlurry: false }),
    ).toBe(100);
  });

  it("returns 0 when all flags are bad", () => {
    expect(
      scoreIntegrity({ hasWatermark: true, isStock: true, isBlurry: true }),
    ).toBe(0);
  });

  it("returns 67 when one flag is bad", () => {
    expect(
      scoreIntegrity({ hasWatermark: true, isStock: false, isBlurry: false }),
    ).toBe(67);
  });
});

// ── S1-U08: Composite photo score ──
describe("calculatePhotoScore", () => {
  it("S1-U08: calculates weighted composite correctly", () => {
    const images: ImageMeta[] = [
      {
        category: "exterior",
        width: 1920,
        integrity: { hasWatermark: false, isStock: false, isBlurry: false },
      },
      {
        category: "bedroom",
        width: 1920,
        integrity: { hasWatermark: false, isStock: false, isBlurry: false },
      },
      {
        category: "bathroom",
        width: 1920,
        integrity: { hasWatermark: false, isStock: false, isBlurry: false },
      },
    ];
    const result = calculatePhotoScore(images);
    // quantity: 3 photos = 60, resolution: avg 1920 = 100, coverage: 3 required = 60, integrity: all clean = 100
    // composite = 60*0.30 + 100*0.25 + 60*0.30 + 100*0.15 = 18 + 25 + 18 + 15 = 76
    expect(result.composite).toBe(76);
    expect(result.quantity).toBe(60);
    expect(result.resolution).toBe(100);
    expect(result.coverage).toBe(60);
    expect(result.integrity).toBe(100);
  });

  it("returns all zeros for empty images", () => {
    const result = calculatePhotoScore([]);
    expect(result.composite).toBe(0);
    expect(result.quantity).toBe(0);
    expect(result.resolution).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.integrity).toBe(0);
  });

  it("handles mixed resolution images (uses average)", () => {
    const images: ImageMeta[] = [
      {
        category: "exterior",
        width: 640,
        integrity: { hasWatermark: false, isStock: false, isBlurry: false },
      },
      {
        category: "bedroom",
        width: 1920,
        integrity: { hasWatermark: false, isStock: false, isBlurry: false },
      },
    ];
    const result = calculatePhotoScore(images);
    // quantity: 2 = 30, resolution: avg(0, 100) = 50, coverage: ext+bed = 40, integrity: 100
    // 30*0.30 + 50*0.25 + 40*0.30 + 100*0.15 = 9 + 12.5 + 12 + 15 = 48.5 → 49
    expect(result.composite).toBe(49);
  });
});

// ── Photo tier classification ──
describe("getPhotoTier", () => {
  it("returns null for score below 80", () => {
    expect(getPhotoTier(79, 2, [], 640)).toBeNull();
  });

  it("returns Previewable for score >= 80 with 3 images including exterior+bedroom at 800px", () => {
    expect(getPhotoTier(80, 3, ["exterior", "bedroom", "bathroom"], 800)).toBe(
      "Previewable",
    );
  });

  it("returns Recommended for score >= 90 with 6 images covering 5 categories at 1200px", () => {
    expect(
      getPhotoTier(
        90,
        6,
        ["exterior", "bedroom", "bathroom", "kitchen", "lobby", "amenities"],
        1200,
      ),
    ).toBe("Recommended");
  });

  it("returns Premium for perfect score with 10+ images, all categories, high-res", () => {
    expect(getPhotoTier(100, 10, [...IMAGE_CATEGORIES], 1920)).toBe("Premium");
  });
});
