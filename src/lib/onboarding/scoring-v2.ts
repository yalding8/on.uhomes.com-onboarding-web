/**
 * S1.2: Multi-dimensional Scoring System v2
 *
 * Upgrades from single "field completeness" to three-dimensional scoring:
 *   Total = Completeness × 0.50 + Quality × 0.30 + Richness × 0.20
 *
 * Quality sub-score:
 *   Quality = PhotoScore × 0.40 + DescriptionQuality × 0.30 + DataConsistency × 0.30
 *
 * Richness sub-score:
 *   Richness = OptionalFillRate × 0.50 + ContentDetailedness × 0.50
 *
 * The original `calculateScore` in scoring-engine.ts provides the Completeness dimension.
 * This module adds Quality and Richness dimensions on top.
 */

// ── Weight Constants ──

const W_COMPLETENESS = 0.5;
const W_QUALITY = 0.3;
const W_RICHNESS = 0.2;

const W_PHOTO = 0.4;
const W_DESCRIPTION = 0.3;
const W_CONSISTENCY = 0.3;

const W_FILL_RATE = 0.5;
const W_DETAIL = 0.5;

const PUBLISH_THRESHOLD = 80;

// ── Types ──

export interface MultiDimInput {
  completenessScore: number; // 0-100 from scoring-engine.ts
  photoScore: number; // 0-100 from photo-scoring.ts
  descriptionQuality: number; // 0-100 from scoreDescriptionQuality
  dataConsistency: number; // 0-100 (external: field conflict rate)
  richness: number; // 0-100 from scoreRichness
}

export interface MultiDimResult {
  completeness: number;
  quality: number;
  richness: number;
  total: number;
}

// ── Description Quality Scorer ──

/**
 * Score description quality by word/char count.
 * <50 chars = 20, 50-100 = 50, 100-300 = 80, >300 = 100
 */
export function scoreDescriptionQuality(
  description: string | undefined | null,
): number {
  if (!description) return 0;
  const len = description.trim().length;
  if (len === 0) return 0;
  if (len > 300) return 100;
  if (len >= 100) return 80;
  if (len >= 50) return 50;
  return 20;
}

// ── Richness Scorer ──

/**
 * Richness = optionalFillRate × 0.5 + contentDetailedness × 0.5
 * optionalFillRate = filledOptional / totalOptional * 100
 * contentDetailedness = descriptionQuality score
 */
export function scoreRichness(
  filledOptional: number,
  totalOptional: number,
  description: string | undefined | null,
): number {
  const fillRate =
    totalOptional === 0 ? 0 : (filledOptional / totalOptional) * 100;
  const detailScore = scoreDescriptionQuality(description);
  return Math.round(fillRate * W_FILL_RATE + detailScore * W_DETAIL);
}

// ── Multi-dimensional Composite ──

export function calculateMultiDimensionalScore(
  input: MultiDimInput,
): MultiDimResult {
  const completeness = input.completenessScore;

  const quality = Math.round(
    input.photoScore * W_PHOTO +
      input.descriptionQuality * W_DESCRIPTION +
      input.dataConsistency * W_CONSISTENCY,
  );

  const richness = input.richness;

  const total = Math.round(
    completeness * W_COMPLETENESS + quality * W_QUALITY + richness * W_RICHNESS,
  );

  return { completeness, quality, richness, total };
}

// ── Publish Gate ──

export function canPublish(totalScore: number): boolean {
  return totalScore >= PUBLISH_THRESHOLD;
}
