/**
 * 提取后字段校验器
 *
 * 对 LLM 提取的字段值进行规则校验：
 * - 数值范围合理性
 * - 格式正确性（email、phone、URL）
 * - 业务一致性（price_min ≤ price_max）
 * - 枚举值有效性
 */

import type { ExtractedFields, Confidence } from "../types.js";
import { getFieldByKey } from "../schema/field-schema.js";

export interface ValidationIssue {
  fieldKey: string;
  issue: string;
  action: "fix" | "downgrade" | "remove";
}

export interface ValidationResult {
  fields: ExtractedFields;
  issues: ValidationIssue[];
  removedCount: number;
}

const CURRENT_YEAR = new Date().getFullYear();

/** 数值范围规则 */
const NUMERIC_RANGES: Record<string, { min: number; max: number }> = {
  price_min: { min: 0, max: 100_000 },
  price_max: { min: 0, max: 100_000 },
  total_units: { min: 1, max: 10_000 },
  number_of_floors: { min: 1, max: 200 },
  year_built: { min: 1800, max: CURRENT_YEAR + 5 },
  application_fee: { min: 0, max: 5_000 },
  admin_fee: { min: 0, max: 5_000 },
  pet_rent: { min: 0, max: 1_000 },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+/;

export function validateFields(fields: ExtractedFields): ValidationResult {
  const result: ExtractedFields = { ...fields };
  const issues: ValidationIssue[] = [];
  let removedCount = 0;

  // --- price_min ≤ price_max consistency ---
  if (result.price_min && result.price_max) {
    const min = result.price_min.value as number;
    const max = result.price_max.value as number;
    if (typeof min === "number" && typeof max === "number" && min > max) {
      result.price_min = {
        value: max,
        confidence: result.price_min.confidence,
      };
      result.price_max = {
        value: min,
        confidence: result.price_max.confidence,
      };
      issues.push({
        fieldKey: "price_min",
        issue: "Swapped price_min/max (min > max)",
        action: "fix",
      });
    }
  }

  // --- price_period vs price sanity check ---
  if (result.price_period && result.price_min) {
    const period = result.price_period.value as string;
    const price = result.price_min.value as number;
    if (typeof price === "number") {
      // Monthly rent < $100 is suspicious — likely a daily rate mislabeled
      if (period === "monthly" && price < 100) {
        result.price_period = {
          value: period,
          confidence: "low" as Confidence,
        };
        issues.push({
          fieldKey: "price_period",
          issue: `Monthly price $${price} suspiciously low — may be daily rate`,
          action: "downgrade",
        });
      }
      // Daily rate > $1000 is suspicious — likely a monthly rate mislabeled
      if (period === "daily" && price > 1000) {
        result.price_period = {
          value: period,
          confidence: "low" as Confidence,
        };
        issues.push({
          fieldKey: "price_period",
          issue: `Daily price $${price} suspiciously high — may be monthly rent`,
          action: "downgrade",
        });
      }
    }
  }

  // --- Per-field validation ---
  for (const [key, fieldValue] of Object.entries(result)) {
    const { value } = fieldValue;

    // Numeric range checks
    if (key in NUMERIC_RANGES && typeof value === "number") {
      const range = NUMERIC_RANGES[key];
      if (value < range.min || value > range.max) {
        delete result[key];
        removedCount++;
        issues.push({
          fieldKey: key,
          issue: `Value ${value} outside range [${range.min}, ${range.max}]`,
          action: "remove",
        });
        continue;
      }
    }

    // Email format
    const fieldDef = getFieldByKey(key);
    if (fieldDef?.type === "email" && typeof value === "string") {
      if (!EMAIL_REGEX.test(value)) {
        result[key] = { value, confidence: "low" as Confidence };
        issues.push({
          fieldKey: key,
          issue: `Invalid email format: ${value}`,
          action: "downgrade",
        });
      }
    }

    // URL format
    if (fieldDef?.type === "url" && typeof value === "string") {
      if (!URL_REGEX.test(value)) {
        result[key] = { value, confidence: "low" as Confidence };
        issues.push({
          fieldKey: key,
          issue: `Invalid URL format: ${value}`,
          action: "downgrade",
        });
      }
    }

    // Select/multi_select enum validation
    if (fieldDef?.options && fieldDef.options.length > 0) {
      if (fieldDef.type === "select" && typeof value === "string") {
        if (!fieldDef.options.includes(value)) {
          result[key] = { value, confidence: "low" as Confidence };
          issues.push({
            fieldKey: key,
            issue: `Value "${value}" not in allowed options`,
            action: "downgrade",
          });
        }
      }
      if (fieldDef.type === "multi_select" && Array.isArray(value)) {
        const invalid = value.filter(
          (v) => !fieldDef.options!.includes(String(v)),
        );
        if (invalid.length > 0) {
          const valid = value.filter((v) =>
            fieldDef.options!.includes(String(v)),
          );
          result[key] = {
            value: valid.length > 0 ? valid : value,
            confidence: "low" as Confidence,
          };
          issues.push({
            fieldKey: key,
            issue: `Invalid options: ${invalid.join(", ")}`,
            action: "downgrade",
          });
        }
      }
    }
  }

  return { fields: result, issues, removedCount };
}
