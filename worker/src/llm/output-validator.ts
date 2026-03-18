/**
 * LLM 输出验证器 — Zod schema 验证 + 类型修复
 *
 * 1. 解析 JSON（支持截断修复）
 * 2. 按 Zod schema 验证每个字段
 * 3. 自动修复常见类型错误（string→number, string→boolean, string→array）
 * 4. 剥离未知字段和空值
 */

import { z } from "zod";

/** 修复 markdown 围栏 + 嵌入换行 */
function cleanRaw(raw: string): string {
  let s = raw.trim();
  while (s.startsWith("```")) {
    const nl = s.indexOf("\n");
    if (nl === -1) break;
    s = s.slice(nl + 1).trim();
  }
  while (s.endsWith("```")) {
    s = s.slice(0, -3).trim();
  }
  return s.replace(/"[\n\r]+\s*/g, '"').replace(/[\n\r]+\s*"/g, '"');
}

/** 截断 JSON 修复：找最后一个完整 key:value 对 */
function tryRecoverJson(text: string): Record<string, unknown> | null {
  if (!text.trimStart().startsWith("{")) return null;
  let lastComma = -1;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 1) lastComma = i;
  }
  if (lastComma <= 0) return null;
  try {
    return JSON.parse(text.slice(0, lastComma) + "}") as Record<string, unknown>;
  } catch {
    return null;
  }
}

function coerceNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[$€£¥,\s]/g, ""));
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

function coerceBoolean(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const l = v.toLowerCase().trim();
    if (["yes", "true", "1"].includes(l)) return true;
    if (["no", "false", "0"].includes(l)) return false;
  }
  return undefined;
}

function coerceStringArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.includes(",")) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return undefined;
}

/** 允许的字段 schema（宽松模式：接受后修复） */
const FIELD_TYPES: Record<string, "string" | "number" | "boolean" | "string[]" | "url[]"> = {
  building_name: "string",
  building_address: "string",
  city: "string",
  country: "string",
  postal_code: "string",
  description: "string",
  price_min: "number",
  price_max: "number",
  currency: "string",
  total_units: "number",
  number_of_floors: "number",
  year_built: "number",
  elevator_available: "boolean",
  shuttle_service: "boolean",
  in_unit_washer_dryer: "boolean",
  key_amenities: "string[]",
  unit_types_summary: "string",
  cover_image: "string",
  images: "url[]",
  application_link: "string",
  application_method: "string[]",
  lease_type: "string",
  rental_method: "string",
  utilities_included: "string",
  furnished_options: "string",
  ac_heating_type: "string",
  bed_included: "string",
  floor_plans: "string",
  cancellation_policy: "string",
  early_termination_policy: "string",
  sublease_policy: "string",
  relet_policy: "string",
  primary_contact_name: "string",
  primary_contact_email: "string",
  primary_contact_phone: "string",
  leasing_manager_name: "string",
  commission_structure: "string",
};

export type ValidatedOutput = Record<string, string | number | boolean | string[]>;

/**
 * 验证并修复 LLM 输出
 * @returns 干净的字段对象（只包含已知字段，类型正确）
 */
export function validateAndRepairOutput(raw: string): ValidatedOutput {
  const cleaned = cleanRaw(raw);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const recovered = tryRecoverJson(cleaned);
    if (!recovered) return {};
    parsed = recovered;
  }

  const result: ValidatedOutput = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in FIELD_TYPES)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;

    const expectedType = FIELD_TYPES[key];

    switch (expectedType) {
      case "string": {
        if (typeof value === "string" && value.trim()) {
          result[key] = value.trim();
        } else if (typeof value === "number") {
          result[key] = String(value);
        }
        break;
      }
      case "number": {
        const n = coerceNumber(value);
        if (n !== undefined) result[key] = n;
        break;
      }
      case "boolean": {
        const b = coerceBoolean(value);
        if (b !== undefined) result[key] = b;
        break;
      }
      case "string[]": {
        const arr = coerceStringArray(value);
        if (arr && arr.length > 0) result[key] = arr;
        break;
      }
      case "url[]": {
        if (Array.isArray(value)) {
          const urls = value
            .map((v) => (typeof v === "string" ? v : null))
            .filter(Boolean) as string[];
          if (urls.length > 0) result[key] = urls;
        }
        break;
      }
    }
  }

  return result;
}
