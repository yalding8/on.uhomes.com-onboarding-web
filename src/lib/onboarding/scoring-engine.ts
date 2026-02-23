/**
 * Scoring Engine — 基于 Field Schema 权重计算 Building 信息完整度评分。
 *
 * 公式: score = round(filledWeight / totalWeight * 100)
 * 范围: 0-100 整数
 */

import type { FieldDefinition, FieldCategory } from './field-schema';
import type { FieldValue } from './field-value';
import { hasValue } from './field-value';

export interface FieldDetail {
  filled: boolean;
  weight: number;
  category: FieldCategory;
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
): ScoreResult {
  let totalWeight = 0;
  let filledWeight = 0;
  const missingFields: string[] = [];
  const fieldDetails: Record<string, FieldDetail> = {};

  for (const field of fieldSchema) {
    totalWeight += field.weight;
    const fv = fieldValues[field.key];
    const filled = hasValue(fv);

    if (filled) {
      filledWeight += field.weight;
    } else {
      missingFields.push(field.key);
    }

    fieldDetails[field.key] = {
      filled,
      weight: field.weight,
      category: field.category,
    };
  }

  const score = totalWeight === 0
    ? 0
    : Math.round((filledWeight / totalWeight) * 100);

  return { score, totalWeight, filledWeight, missingFields, fieldDetails };
}
