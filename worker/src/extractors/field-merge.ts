/**
 * 字段合并工具 — 多来源提取结果的合并策略
 */

import type { ExtractedFields, ExtractionFieldValue } from "../types.js";

/** 将 source 中的字段合并到 target（不覆盖已有字段） */
export function mergeFieldsInto(
  target: ExtractedFields,
  source: ExtractedFields,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (!target[key]) {
      target[key] = value;
    }
  }
}

/** 按置信度合并 — 对同一字段保留置信度更高的值 */
export function mergeByConfidence(
  target: ExtractedFields,
  source: ExtractedFields,
): void {
  const confidenceRank: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  for (const [key, value] of Object.entries(source)) {
    const existing = target[key] as ExtractionFieldValue | undefined;
    if (!existing) {
      target[key] = value;
      continue;
    }

    const existingRank = confidenceRank[existing.confidence] ?? 0;
    const newRank = confidenceRank[value.confidence] ?? 0;
    if (newRank > existingRank) {
      target[key] = value;
    }
  }
}
