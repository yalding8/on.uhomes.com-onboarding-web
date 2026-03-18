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
import { validateAndRepairOutput } from "./output-validator.js";
import type { ExtractedFields, Confidence } from "../types.js";

/** 清理 LLM 输出中的 markdown 代码围栏 */
function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  // 移除 ```json ... ``` 或 ``` ... ```（支持多层嵌套）
  while (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    } else {
      break;
    }
    cleaned = cleaned.trim();
  }
  while (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3).trim();
  }
  return cleaned.trim();
}

/**
 * 清理 JSON 字符串中 key/value 内嵌的换行符
 * Kimi K2.5 会在 key 或 value 前插入 \n，如 {"\\nbuilding_name":"\\nTest"}
 */
function stripEmbeddedNewlines(text: string): string {
  // 移除 JSON string token 内部紧跟引号后的换行: "\nfoo" → "foo"
  return text.replace(/"[\n\r]+\s*/g, '"').replace(/[\n\r]+\s*"/g, '"');
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
 * 尝试从截断的 JSON 中恢复已完成的键值对。
 * 策略：找到最后一个完整的 "key":value, 截断其后内容并闭合 JSON。
 */
function tryRecoverTruncatedJson(
  text: string,
): Record<string, unknown> | null {
  if (!text.trimStart().startsWith("{")) return null;

  // 从尾部逐步截断，直到找到最后一个完整的 key:value 对
  // 找最后一个有效的逗号分隔位置
  let lastGoodComma = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 1) {
      lastGoodComma = i;
    }
  }

  if (lastGoodComma <= 0) return null;

  // 截取到最后一个逗号前的内容，闭合 JSON
  const truncated = text.slice(0, lastGoodComma) + "}";
  try {
    return JSON.parse(truncated) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 将 LLM 原始输出转换为 ExtractedFields 格式
 *
 * 使用 Zod schema 验证 + 类型修复（output-validator），
 * 再分配置信度。
 *
 * @param raw LLM 返回的原始文本（可能包含 markdown 围栏）
 * @returns 校验过的 ExtractedFields
 */
export function mapLlmOutput(raw: string): ExtractedFields {
  const validated = validateAndRepairOutput(raw);

  if (Object.keys(validated).length === 0) {
    console.error(
      "[field-mapper] Failed to parse LLM JSON output. Raw (first 500 chars):",
      raw.slice(0, 500),
    );
    return {};
  }

  const result: ExtractedFields = {};

  for (const [key, value] of Object.entries(validated)) {
    const confidence = assignConfidence(key, value);
    result[key] = { value, confidence };
  }

  return result;
}
