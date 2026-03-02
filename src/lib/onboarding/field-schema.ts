/**
 * Field Schema — 定义 Building Onboarding 的所有字段元数据。
 * 这是整个评分、Gap Report、编辑页面的核心配置。
 *
 * 类型定义和工具函数在此文件，字段数据定义在 field-definitions.ts。
 */

import { FIELD_DEFINITIONS } from "./field-definitions";

export type FieldCategory =
  | "basic_info"
  | "commission"
  | "contacts"
  | "availability"
  | "booking_process"
  | "lease_policy"
  | "tenant_qualification"
  | "building_details"
  | "fees"
  | "furnishing_room";

export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multi_select"
  | "url"
  | "email"
  | "phone"
  | "json"
  | "image_urls";

export type ExtractTier = "A" | "B" | "C";

export interface FieldDefinition {
  key: string;
  label: string;
  category: FieldCategory;
  type: FieldType;
  weight: number; // 1-10
  extractTier: ExtractTier;
  required: boolean;
  options?: string[];
  description?: string;
  maxItems?: number;
}

export const FIELD_CATEGORY_LABELS: Record<FieldCategory, string> = {
  basic_info: "Basic Information",
  commission: "Commission Structure",
  contacts: "Contacts",
  availability: "Availability Checking",
  booking_process: "Booking Process",
  lease_policy: "Lease Policy",
  tenant_qualification: "Tenant Qualification",
  building_details: "Building Details",
  fees: "Fees",
  furnishing_room: "Furnishing & Room Details",
};

/** 完整字段定义（从 field-definitions.ts 导入） */
export const FIELD_SCHEMA: FieldDefinition[] = FIELD_DEFINITIONS;

// ── Utility Functions ──

/** 按分类分组返回字段定义 */
export function getFieldsByCategory(): Record<
  FieldCategory,
  FieldDefinition[]
> {
  const grouped = {} as Record<FieldCategory, FieldDefinition[]>;
  for (const field of FIELD_SCHEMA) {
    if (!grouped[field.category]) {
      grouped[field.category] = [];
    }
    grouped[field.category].push(field);
  }
  return grouped;
}

/** 返回所有 required 字段 */
export function getRequiredFields(): FieldDefinition[] {
  return FIELD_SCHEMA.filter((f) => f.required);
}

/** 计算所有字段的权重总和 */
export function getTotalWeight(): number {
  return FIELD_SCHEMA.reduce((sum, f) => sum + f.weight, 0);
}

/** 根据 key 查找字段定义 */
export function getFieldByKey(key: string): FieldDefinition | undefined {
  return FIELD_SCHEMA.find((f) => f.key === key);
}

/** 所有合法的 FieldCategory 值 */
export const ALL_CATEGORIES: FieldCategory[] = [
  "basic_info",
  "commission",
  "contacts",
  "availability",
  "booking_process",
  "lease_policy",
  "tenant_qualification",
  "building_details",
  "fees",
  "furnishing_room",
];
