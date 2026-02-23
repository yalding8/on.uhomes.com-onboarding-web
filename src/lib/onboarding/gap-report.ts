/**
 * Gap Report — 对比 Field Schema 与已填写数据，生成缺失字段报告。
 */

import type {
  FieldDefinition,
  FieldCategory,
  ExtractTier,
} from "./field-schema";
import type { FieldValue } from "./field-value";
import { hasValue } from "./field-value";

export interface GapReportItem {
  fieldKey: string;
  label: string;
  category: FieldCategory;
  weight: number;
  extractTier: ExtractTier;
  suggestion: string;
}

export interface GapReport {
  buildingId: string;
  totalFields: number;
  filledFields: number;
  missingByCategory: Partial<Record<FieldCategory, GapReportItem[]>>;
}

const TIER_SUGGESTION: Record<ExtractTier, string> = {
  A: "可自动提取",
  B: "需确认",
  C: "需手动填写",
};

export function generateGapReport(
  fieldSchema: FieldDefinition[],
  fieldValues: Record<string, FieldValue>,
  buildingId: string = "",
): GapReport {
  const missingByCategory: Partial<Record<FieldCategory, GapReportItem[]>> = {};
  let filledFields = 0;

  for (const field of fieldSchema) {
    if (hasValue(fieldValues[field.key])) {
      filledFields++;
      continue;
    }

    if (!missingByCategory[field.category]) {
      missingByCategory[field.category] = [];
    }

    missingByCategory[field.category]!.push({
      fieldKey: field.key,
      label: field.label,
      category: field.category,
      weight: field.weight,
      extractTier: field.extractTier,
      suggestion: TIER_SUGGESTION[field.extractTier],
    });
  }

  return {
    buildingId,
    totalFields: fieldSchema.length,
    filledFields,
    missingByCategory,
  };
}
