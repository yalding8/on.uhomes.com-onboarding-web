/**
 * Confidence Adjuster — 根据 Worker 端 LLM validation 质量调整置信度。
 *
 * - "good": 保持原置信度
 * - "mixed": medium 及以下降一级
 * - "poor": 所有字段降一级
 */

import type { ExtractionFieldValue } from "./data-merge";
import type { Confidence } from "./field-value";

export interface AdjustmentResult {
  adjusted: Record<string, ExtractionFieldValue>;
  downgradedFields: string[];
}

function downgradeConfidence(current: Confidence): Confidence {
  switch (current) {
    case "high":
      return "medium";
    case "medium":
      return "low";
    case "low":
      return "low";
  }
}

export function adjustConfidence(
  fields: Record<string, ExtractionFieldValue>,
  validationQuality: string | null,
): AdjustmentResult {
  const adjusted: Record<string, ExtractionFieldValue> = {};
  const downgradedFields: string[] = [];

  for (const [key, fv] of Object.entries(fields)) {
    adjusted[key] = { ...fv };
  }

  if (validationQuality === "poor") {
    for (const [key, fv] of Object.entries(adjusted)) {
      const newConf = downgradeConfidence(fv.confidence);
      if (newConf !== fv.confidence) {
        adjusted[key] = { ...fv, confidence: newConf };
        downgradedFields.push(key);
      }
    }
  } else if (validationQuality === "mixed") {
    for (const [key, fv] of Object.entries(adjusted)) {
      if (fv.confidence !== "high") {
        const newConf = downgradeConfidence(fv.confidence);
        if (newConf !== fv.confidence) {
          adjusted[key] = { ...fv, confidence: newConf };
          downgradedFields.push(key);
        }
      }
    }
  }

  return { adjusted, downgradedFields };
}
