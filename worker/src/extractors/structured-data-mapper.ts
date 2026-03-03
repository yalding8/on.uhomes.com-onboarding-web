/**
 * JSON-LD / Schema.org 结构化数据 → ExtractedFields 直接映射
 *
 * 当页面包含 JSON-LD 时，优先从结构化数据中映射字段，
 * 避免 LLM 调用，速度更快且置信度更高。
 */

import type { ExtractedFields, Confidence } from "../types.js";

/** JSON-LD 中的 schema.org 类型映射规则 */
interface MappingRule {
  /** JSON-LD 中的路径（支持 . 分隔的嵌套路径） */
  jsonLdPath: string;
  /** 目标字段 key */
  fieldKey: string;
  /** 值转换函数 */
  transform?: (value: unknown) => unknown;
  /** 固定置信度 */
  confidence: Confidence;
}

const MAPPING_RULES: MappingRule[] = [
  // --- 基本信息 ---
  { jsonLdPath: "name", fieldKey: "building_name", confidence: "high" },
  {
    jsonLdPath: "address.streetAddress",
    fieldKey: "building_address",
    confidence: "high",
  },
  {
    jsonLdPath: "address.addressLocality",
    fieldKey: "city",
    confidence: "high",
  },
  {
    jsonLdPath: "address.addressCountry",
    fieldKey: "country",
    confidence: "high",
  },
  {
    jsonLdPath: "address.postalCode",
    fieldKey: "postal_code",
    confidence: "high",
  },
  { jsonLdPath: "description", fieldKey: "description", confidence: "high" },

  // --- 图片 ---
  {
    jsonLdPath: "image",
    fieldKey: "cover_image",
    confidence: "high",
    transform: (v) => (Array.isArray(v) ? v[0] : v),
  },
  {
    jsonLdPath: "photo",
    fieldKey: "cover_image",
    confidence: "high",
    transform: (v) => (Array.isArray(v) ? v[0] : v),
  },
  {
    jsonLdPath: "image",
    fieldKey: "images",
    confidence: "high",
    transform: (v) => (Array.isArray(v) ? v.slice(0, 10) : [v]),
  },

  // --- 联系方式 ---
  {
    jsonLdPath: "telephone",
    fieldKey: "primary_contact_phone",
    confidence: "high",
  },
  {
    jsonLdPath: "email",
    fieldKey: "primary_contact_email",
    confidence: "high",
  },
  {
    jsonLdPath: "contactPoint.telephone",
    fieldKey: "primary_contact_phone",
    confidence: "high",
  },
  {
    jsonLdPath: "contactPoint.email",
    fieldKey: "primary_contact_email",
    confidence: "high",
  },
  {
    jsonLdPath: "contactPoint.contactType",
    fieldKey: "primary_contact_name",
    confidence: "medium",
  },

  // --- 价格 ---
  {
    jsonLdPath: "offers.lowPrice",
    fieldKey: "price_min",
    confidence: "high",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "offers.highPrice",
    fieldKey: "price_max",
    confidence: "high",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "offers.priceCurrency",
    fieldKey: "currency",
    confidence: "high",
  },
  {
    jsonLdPath: "priceRange",
    fieldKey: "price_min",
    confidence: "medium",
    transform: extractMinPrice,
  },

  // --- 设施 ---
  {
    jsonLdPath: "amenityFeature",
    fieldKey: "key_amenities",
    confidence: "medium",
    transform: extractAmenityNames,
  },
  {
    jsonLdPath: "numberOfRooms",
    fieldKey: "total_units",
    confidence: "medium",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "floorSize.value",
    fieldKey: "total_units",
    confidence: "low",
    transform: parseNumeric,
  },

  // --- URL ---
  { jsonLdPath: "url", fieldKey: "application_link", confidence: "medium" },
];

/** schema.org @type 值，表示可能是公寓/物业页面 */
const PROPERTY_TYPES = [
  "ApartmentComplex",
  "Apartment",
  "Residence",
  "LodgingBusiness",
  "RealEstateListing",
  "Place",
  "LocalBusiness",
  "Organization",
  "Product",
];

function parseNumeric(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$€£¥,\s]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

function extractMinPrice(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const match = v.match(/[\d,]+/);
  if (!match) return null;
  return parseNumeric(match[0]);
}

function extractAmenityNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        return (item as Record<string, unknown>).name as string;
      }
      return null;
    })
    .filter((name): name is string => typeof name === "string");
}

/** 从嵌套对象中按 dot path 取值 */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** 判断 JSON-LD 对象是否与物业相关 */
function isPropertyRelated(item: Record<string, unknown>): boolean {
  const type = item["@type"];
  if (!type) return true; // 无类型时尝试提取
  if (typeof type === "string") {
    return PROPERTY_TYPES.some((t) => type.toLowerCase() === t.toLowerCase());
  }
  if (Array.isArray(type)) {
    return type.some((t) =>
      PROPERTY_TYPES.some((pt) => String(t).toLowerCase() === pt.toLowerCase()),
    );
  }
  return false;
}

export interface StructuredDataResult {
  fields: ExtractedFields;
  /** 已覆盖的字段数 */
  coveredCount: number;
  /** 总目标字段数 */
  totalTargetFields: number;
  /** 覆盖率 (0-1) */
  coverageRatio: number;
}

/**
 * 从 JSON-LD 数据直接映射到 ExtractedFields
 *
 * @param jsonLdItems 页面中提取的所有 JSON-LD 对象
 * @returns 映射结果 + 覆盖率统计
 */
export function mapStructuredData(
  jsonLdItems: Record<string, unknown>[],
): StructuredDataResult {
  const fields: ExtractedFields = {};
  const coveredKeys = new Set<string>();

  // Filter to property-related items
  const relevantItems = jsonLdItems.filter(isPropertyRelated);
  if (relevantItems.length === 0 && jsonLdItems.length > 0) {
    // If no property-related items, try all items
    relevantItems.push(...jsonLdItems);
  }

  for (const item of relevantItems) {
    for (const rule of MAPPING_RULES) {
      // Skip if already mapped with higher confidence
      if (coveredKeys.has(rule.fieldKey)) continue;

      const rawValue = getByPath(item, rule.jsonLdPath);
      if (rawValue === null || rawValue === undefined) continue;
      if (typeof rawValue === "string" && rawValue.trim() === "") continue;

      const value = rule.transform ? rule.transform(rawValue) : rawValue;
      if (value === null || value === undefined) continue;

      fields[rule.fieldKey] = { value, confidence: rule.confidence };
      coveredKeys.add(rule.fieldKey);
    }
  }

  // Count unique target field keys in mapping rules
  const uniqueTargetKeys = new Set(MAPPING_RULES.map((r) => r.fieldKey));
  const totalTargetFields = uniqueTargetKeys.size;

  return {
    fields,
    coveredCount: coveredKeys.size,
    totalTargetFields,
    coverageRatio:
      totalTargetFields > 0 ? coveredKeys.size / totalTargetFields : 0,
  };
}
