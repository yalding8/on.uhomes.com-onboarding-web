/**
 * LLM 输出 → extractedFields 格式转换
 *
 * 1. 清理 markdown 围栏（```json ... ```）
 * 2. 解析 JSON
 * 3. 校验字段 key 是否在 FIELD_SCHEMA 中
 * 4. 类型强转（number/boolean/multi_select）
 * 5. 分配置信度
 */

import { getFieldByKey, getValidFieldKeys } from "../schema/field-schema.js";
import type { ExtractedFields, Confidence } from "../types.js";

/** 清理 LLM 输出中的 markdown 代码围栏 */
function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  // 移除 ```json ... ``` 或 ``` ... ```
  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    }
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/** 根据字段类型强转值 */
function coerceValue(key: string, value: unknown): unknown {
  const field = getFieldByKey(key);
  if (!field || value === null || value === undefined) return value;

  switch (field.type) {
    case "number": {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        // 移除货币符号和逗号
        const cleaned = value.replace(/[$€£¥,\s]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num) ? value : num;
      }
      return value;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const lower = value.toLowerCase().trim();
        if (["yes", "true", "1"].includes(lower)) return true;
        if (["no", "false", "0"].includes(lower)) return false;
      }
      return value;
    }
    case "multi_select": {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        return value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return value;
    }
    default:
      return value;
  }
}

/** 根据字段的 extractTier、类型匹配度和值完整性分配置信度 */
function assignConfidence(key: string, value: unknown): Confidence {
  const field = getFieldByKey(key);
  if (!field) return "low";

  // Check type match — mismatched types lower confidence
  const typeMismatch = checkTypeMismatch(field.type, value);

  if (field.extractTier === "A") {
    if (value === null || value === undefined) return "low";
    if (typeMismatch) return "low";
    if (typeof value === "string" && value.length < 3) return "medium";
    return "high";
  }

  if (field.extractTier === "B") {
    return typeMismatch ? "low" : "medium";
  }

  return "low";
}

/** Quick type match check — returns true if value doesn't match expected type */
function checkTypeMismatch(fieldType: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  switch (fieldType) {
    case "number":
      return typeof value !== "number";
    case "boolean":
      return typeof value !== "boolean";
    case "multi_select":
    case "image_urls":
      return !Array.isArray(value);
    case "email":
      return (
        typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      );
    case "url":
      return typeof value !== "string" || !/^https?:\/\/.+/.test(value);
    default:
      return false;
  }
}

/**
 * 将 LLM 原始输出转换为 ExtractedFields 格式
 *
 * @param raw LLM 返回的原始文本（可能包含 markdown 围栏）
 * @returns 校验过的 ExtractedFields
 */
export function mapLlmOutput(raw: string): ExtractedFields {
  const cleaned = stripMarkdownFences(raw);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    console.error(
      "[field-mapper] Failed to parse LLM JSON output. Raw (first 500 chars):",
      cleaned.slice(0, 500),
    );
    return {};
  }

  const validKeys = getValidFieldKeys();
  const result: ExtractedFields = {};

  for (const [key, rawValue] of Object.entries(parsed)) {
    // 跳过不在 schema 中的字段
    if (!validKeys.has(key)) continue;

    // 跳过空值
    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue === "string" && rawValue.trim() === "") continue;

    const value = coerceValue(key, rawValue);
    const confidence = assignConfidence(key, value);

    result[key] = { value, confidence };
  }

  return result;
}
