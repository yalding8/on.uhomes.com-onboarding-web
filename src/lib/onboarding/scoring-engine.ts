/**
 * Scoring Engine — 基于 Field Schema 权重计算 Building 信息完整度评分。
 *
 * 公式: score = round(filledWeight / totalWeight * 100)
 * 范围: 0-100 整数
 *
 * v2 改进:
 * - 置信度加权: weight × confidenceMultiplier (high=1.0, medium=0.7, low=0.3)
 * - N/A 字段排除: excludedFields 参数排除不适用字段的权重
 */

import type { FieldDefinition, FieldCategory } from "./field-schema";
import type { FieldValue, Confidence } from "./field-value";
import { hasValue } from "./field-value";

const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.3,
};

export interface FieldDetail {
  filled: boolean;
  weight: number;
  category: FieldCategory;
  confidence?: Confidence;
}

export interface ScoreResult {
  score: number;
  totalWeight: number;
  filledWeight: number;
  missingFields: string[];
  fieldDetails: Record<string, FieldDetail>;
}

export function calculateScore(
  fieldSchema: FieldDefinition[],
  fieldValues: Record<string, FieldValue>,
  excludedFields?: Set<string>,
): ScoreResult {
  let totalWeight = 0;
  let filledWeight = 0;
  const missingFields: string[] = [];
  const fieldDetails: Record<string, FieldDetail> = {};

  for (const field of fieldSchema) {
    if (excludedFields?.has(field.key)) continue;

    totalWeight += field.weight;
    const fv = fieldValues[field.key];
    const filled = hasValue(fv);

    if (filled) {
      const confidence: Confidence = fv?.confidence ?? "high";
      const multiplier = CONFIDENCE_MULTIPLIER[confidence];
      filledWeight += field.weight * multiplier;
    } else {
      missingFields.push(field.key);
    }

    fieldDetails[field.key] = {
      filled,
      weight: field.weight,
      category: field.category,
      confidence: fv?.confidence,
    };
  }

  const score =
    totalWeight === 0 ? 0 : Math.round((filledWeight / totalWeight) * 100);

  return { score, totalWeight, filledWeight, missingFields, fieldDetails };
}
