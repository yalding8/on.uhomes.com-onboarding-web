/**
 * Gap Report — Compare Field Schema with filled data, generate missing fields report.
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
  A: "Auto-extractable",
  B: "Needs confirmation",
  C: "Manual input required",
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
