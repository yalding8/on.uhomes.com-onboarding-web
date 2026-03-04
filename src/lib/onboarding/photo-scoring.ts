/**
 * S1.1: Photo Quality Scoring System
 *
 * Scores building images across 4 dimensions:
 * - Quantity (30%): number of photos
 * - Resolution (25%): average image width
 * - Category Coverage (30%): required + optional categories
 * - Integrity (15%): watermark, stock, blur detection
 *
 * Composite = quantity×0.30 + resolution×0.25 + coverage×0.30 + integrity×0.15
 */

export const IMAGE_CATEGORIES = [
  "exterior",
  "lobby",
  "bedroom",
  "bathroom",
  "kitchen",
  "living_area",
  "amenities",
  "neighborhood",
  "floor_plan",
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

const REQUIRED_CATEGORIES: ReadonlySet<ImageCategory> = new Set([
  "exterior",
  "bedroom",
  "bathroom",
]);

const OPTIONAL_CATEGORIES: ReadonlySet<ImageCategory> = new Set(
  IMAGE_CATEGORIES.filter((c) => !REQUIRED_CATEGORIES.has(c)),
);

export interface IntegrityFlags {
  hasWatermark: boolean;
  isStock: boolean;
  isBlurry: boolean;
}

export interface ImageMeta {
  category: ImageCategory;
  width: number;
  integrity: IntegrityFlags;
}

export interface PhotoScoreResult {
  quantity: number;
  resolution: number;
  coverage: number;
  integrity: number;
  composite: number;
}

export type PhotoTier = "Previewable" | "Recommended" | "Premium";

// ── Dimension Scorers ──

/** Quantity: 0→0, 1-2→30, 3-5→60, 6-9→80, 10+→100 */
export function scoreQuantity(count: number): number {
  if (count >= 10) return 100;
  if (count >= 6) return 80;
  if (count >= 3) return 60;
  if (count >= 1) return 30;
  return 0;
}

/** Resolution: <800px→0, 800-1200px→50, >1200px→100 */
export function scoreResolution(width: number): number {
  if (width > 1200) return 100;
  if (width >= 800) return 50;
  return 0;
}

/** Category coverage: required (exterior/bedroom/bathroom) each 20pts, optional each ~13pts */
export function scoreCategoryCoverage(categories: string[]): number {
  const unique = new Set(categories);
  let score = 0;

  for (const cat of REQUIRED_CATEGORIES) {
    if (unique.has(cat)) score += 20;
  }

  const optionalHits = [...OPTIONAL_CATEGORIES].filter((c) =>
    unique.has(c),
  ).length;
  // 6 optional categories share remaining 40 points: ~6.67 each, round to 13/2 = per-pair
  // Design spec: each optional = 13 points, max from optional = 6 * ~6.67 ≈ 40
  const optionalScore = Math.min(
    40,
    Math.round((optionalHits / OPTIONAL_CATEGORIES.size) * 40),
  );
  score += optionalScore;

  return Math.min(100, score);
}

/** Integrity: 3 flags, each clean = 33.3 points */
export function scoreIntegrity(flags: IntegrityFlags): number {
  const checks = [!flags.hasWatermark, !flags.isStock, !flags.isBlurry];
  const passCount = checks.filter(Boolean).length;
  return Math.round((passCount / 3) * 100);
}

// ── Composite Score ──

const W_QUANTITY = 0.3;
const W_RESOLUTION = 0.25;
const W_COVERAGE = 0.3;
const W_INTEGRITY = 0.15;

export function calculatePhotoScore(images: ImageMeta[]): PhotoScoreResult {
  if (images.length === 0) {
    return { quantity: 0, resolution: 0, coverage: 0, integrity: 0, composite: 0 };
  }

  const quantity = scoreQuantity(images.length);

  const resScores = images.map((img) => scoreResolution(img.width));
  const resolution = Math.round(
    resScores.reduce((a, b) => a + b, 0) / resScores.length,
  );

  const coverage = scoreCategoryCoverage(images.map((img) => img.category));

  const intScores = images.map((img) => scoreIntegrity(img.integrity));
  const integrity = Math.round(
    intScores.reduce((a, b) => a + b, 0) / intScores.length,
  );

  const composite = Math.round(
    quantity * W_QUANTITY +
      resolution * W_RESOLUTION +
      coverage * W_COVERAGE +
      integrity * W_INTEGRITY,
  );

  return { quantity, resolution, coverage, integrity, composite };
}

// ── Tier Classification ──

export function getPhotoTier(
  score: number,
  imageCount: number,
  categories: string[],
  minWidth: number,
): PhotoTier | null {
  const uniqueCats = new Set(categories);

  if (
    score === 100 &&
    imageCount >= 10 &&
    uniqueCats.size >= IMAGE_CATEGORIES.length &&
    minWidth > 1200
  ) {
    return "Premium";
  }

  if (
    score >= 90 &&
    imageCount >= 6 &&
    uniqueCats.size >= 5 &&
    minWidth >= 1200
  ) {
    return "Recommended";
  }

  if (
    score >= 80 &&
    imageCount >= 3 &&
    uniqueCats.has("exterior") &&
    uniqueCats.has("bedroom") &&
    minWidth >= 800
  ) {
    return "Previewable";
  }

  return null;
}
