/**
 * Field Validator — 验证 PATCH API 传入的字段值合法性。
 *
 * 规则：
 * - null 始终合法（表示清空字段）
 * - 未知 key 拒绝（防止写入 schema 以外的数据）
 * - 每种 FieldType 有对应的类型检查
 * - select / multi_select 额外验证选项范围
 * - email / url 做基础格式验证
 */

import { getFieldByKey } from "./field-schema";
import type { FieldType } from "./field-schema";

export interface FieldError {
  key: string;
  label: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: FieldError[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/;

/** 对单个原始值按 FieldType 做类型检查，返回 null 表示通过，否则返回错误原因 */
function checkType(
  type: FieldType,
  value: unknown,
  options?: string[],
): string | null {
  // null 表示清空字段，始终合法
  if (value === null || value === undefined) return null;

  switch (type) {
    case "text":
    case "phone":
      if (typeof value !== "string") return "Must be a string";
      break;

    case "json":
      // json 字段编辑器传字符串；自动提取可能传对象，两者都接受
      if (typeof value !== "string" && typeof value !== "object")
        return "Must be a string or object";
      break;

    case "number":
      if (typeof value !== "number" || !isFinite(value))
        return "Must be a finite number";
      if (value < 0) return "Must be a non-negative number";
      break;

    case "boolean":
      if (typeof value !== "boolean") return "Must be true or false";
      break;

    case "select":
      if (typeof value !== "string") return "Must be a string";
      if (options && !options.includes(value))
        return `Must be one of: ${options.join(", ")}`;
      break;

    case "multi_select": {
      if (!Array.isArray(value)) return "Must be an array";
      if (options) {
        const invalid = (value as unknown[]).filter(
          (v) => typeof v !== "string" || !options.includes(v as string),
        );
        if (invalid.length > 0)
          return `Invalid options: ${(invalid as string[]).join(", ")}`;
      }
      break;
    }

    case "email":
      if (typeof value !== "string") return "Must be a string";
      if (!EMAIL_RE.test(value)) return "Must be a valid email address";
      break;

    case "url":
      if (typeof value !== "string") return "Must be a string";
      if (!URL_RE.test(value))
        return "Must be a valid URL starting with http:// or https://";
      break;

    case "image_urls":
      if (!Array.isArray(value)) return "Must be an array of URL strings";
      if (
        (value as unknown[]).some(
          (v) => typeof v !== "string" || !URL_RE.test(v as string),
        )
      )
        return "Each item must be a valid URL starting with http:// or https://";
      break;
  }

  return null;
}

/**
 * 批量验证 PATCH payload 中的 fields 字典。
 * @param fields  来自请求体的 { fieldKey: rawValue } 映射
 * @returns { ok, errors }
 */
export function validateFields(
  fields: Record<string, unknown>,
): ValidationResult {
  const errors: FieldError[] = [];

  for (const [key, value] of Object.entries(fields)) {
    const def = getFieldByKey(key);
    if (!def) {
      errors.push({ key, label: key, message: `Unknown field key: "${key}"` });
      continue;
    }

    const msg = checkType(def.type, value, def.options);
    if (msg) {
      errors.push({ key, label: def.label, message: msg });
    }
  }

  return { ok: errors.length === 0, errors };
}
