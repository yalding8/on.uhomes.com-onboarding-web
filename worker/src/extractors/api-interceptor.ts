/**
 * API 响应拦截器 — 从 XHR/fetch JSON 响应中捕获公寓数据
 *
 * 识别策略：关键词匹配 JSON 文本 → 递归搜索字段映射
 */

import type { ExtractedFields, Confidence } from "../types.js";

const MIN_JSON_LENGTH = 50;

const APARTMENT_KEYWORDS =
  /price|rent(?!er)|monthly|unit[s]?[\s":]|bedroom|studio|amenit|floor.?plan|sqft|square.?feet|deposit|lease|pet.?(?:fee|policy|friendly)|parking|laundry|gym|pool|rooftop/i;

/** 判断 JSON 字符串是否包含公寓相关数据 */
export function isApartmentData(jsonStr: string): boolean {
  if (jsonStr.length < MIN_JSON_LENGTH) return false;
  return APARTMENT_KEYWORDS.test(jsonStr);
}

/**
 * 字段名映射表：API JSON key → field definition key
 * 支持模糊匹配（转为小写后匹配）
 */
const KEY_MAP: Record<string, string> = {
  // building_name
  name: "building_name",
  buildingname: "building_name",
  propertyname: "building_name",
  property_name: "building_name",
  communityname: "building_name",
  community_name: "building_name",
  title: "building_name",
  // building_address
  address: "building_address",
  streetaddress: "building_address",
  street_address: "building_address",
  fulladdress: "building_address",
  // city
  city: "city",
  // country
  country: "country",
  // postal_code
  postalcode: "postal_code",
  postal_code: "postal_code",
  zipcode: "postal_code",
  zip_code: "postal_code",
  zip: "postal_code",
  // price
  minrent: "price_min",
  min_rent: "price_min",
  minprice: "price_min",
  min_price: "price_min",
  startingprice: "price_min",
  pricefrom: "price_min",
  maxrent: "price_max",
  max_rent: "price_max",
  maxprice: "price_max",
  max_price: "price_max",
  priceto: "price_max",
  rent: "price_min",
  price: "price_min",
  monthlyrent: "price_min",
  monthly_rent: "price_min",
  // description
  description: "description",
  // amenities
  amenities: "key_amenities",
  features: "key_amenities",
  // units
  totalunits: "total_units",
  total_units: "total_units",
  unitcount: "total_units",
  unit_count: "total_units",
  numberofunits: "total_units",
  // images
  images: "images",
  photos: "images",
  gallery: "images",
  // cover image
  heroimage: "cover_image",
  hero_image: "cover_image",
  mainimage: "cover_image",
  main_image: "cover_image",
  coverimage: "cover_image",
  cover_image: "cover_image",
  thumbnail: "cover_image",
  // application
  applicationurl: "application_link",
  application_url: "application_link",
  applyurl: "application_link",
  apply_url: "application_link",
};

const CONFIDENCE: Confidence = "high";

/**
 * 从 API JSON 响应中映射公寓字段
 * 递归搜索嵌套对象，模糊匹配字段名
 */
export function mapApiResponse(json: unknown): ExtractedFields {
  const fields: ExtractedFields = {};

  // GraphQL unwrap
  const data =
    isObject(json) && "data" in json && isObject(json.data) ? json.data : json;

  collectFields(data, fields, 0);

  // 从 units/floorplans 数组推断 unit_types_summary
  if (!fields.unit_types_summary) {
    const summary = extractUnitTypes(data);
    if (summary) {
      fields.unit_types_summary = { value: summary, confidence: CONFIDENCE };
    }
  }

  return fields;
}

function collectFields(
  obj: unknown,
  fields: ExtractedFields,
  depth: number,
): void {
  if (depth > 5 || !isObject(obj)) return;

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    const normalizedKey = key.toLowerCase().replace(/[-_\s]/g, "");
    const fieldKey = KEY_MAP[normalizedKey];

    if (fieldKey && !fields[fieldKey]) {
      const mapped = mapValue(fieldKey, value);
      if (mapped !== null) {
        fields[fieldKey] = { value: mapped, confidence: CONFIDENCE };
      }
    }

    // 递归搜索嵌套对象
    if (isObject(value)) {
      collectFields(value, fields, depth + 1);
    }

    // 搜索数组中的第一个对象
    if (Array.isArray(value) && value.length > 0 && isObject(value[0])) {
      collectFields(value[0], fields, depth + 1);
    }
  }
}

function mapValue(fieldKey: string, value: unknown): unknown {
  if (fieldKey === "key_amenities") {
    if (Array.isArray(value)) {
      return value.map((v) =>
        isObject(v) && "name" in v ? String(v.name) : String(v),
      );
    }
    if (typeof value === "string") return value.split(",").map((s) => s.trim());
    return null;
  }

  if (fieldKey === "images") {
    if (Array.isArray(value)) {
      return value
        .map((v) => {
          if (typeof v === "string") return v;
          if (isObject(v) && "url" in v) return String(v.url);
          if (isObject(v) && "src" in v) return String(v.src);
          return null;
        })
        .filter(Boolean)
        .slice(0, 10);
    }
    return null;
  }

  if (
    fieldKey === "price_min" ||
    fieldKey === "price_max" ||
    fieldKey === "total_units"
  ) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const num = parseFloat(value.replace(/[$,]/g, ""));
      return isNaN(num) ? null : num;
    }
    return null;
  }

  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;

  return null;
}

function extractUnitTypes(obj: unknown): string | null {
  if (!isObject(obj)) return null;

  for (const [key, value] of Object.entries(obj)) {
    const k = key.toLowerCase();
    if (
      (k.includes("unit") ||
        k.includes("floorplan") ||
        k.includes("floor_plan")) &&
      Array.isArray(value) &&
      value.length > 0
    ) {
      const types = value
        .map((v) => {
          if (isObject(v)) {
            return (
              (v as Record<string, unknown>).type ??
              (v as Record<string, unknown>).name ??
              (v as Record<string, unknown>).unitType ??
              (v as Record<string, unknown>).unit_type ??
              (v as Record<string, unknown>).label
            );
          }
          return null;
        })
        .filter(Boolean)
        .map(String);

      if (types.length > 0) {
        return [...new Set(types)].join(", ");
      }
    }
  }

  // 递归查找
  for (const value of Object.values(obj)) {
    if (isObject(value)) {
      const found = extractUnitTypes(value);
      if (found) return found;
    }
  }

  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
