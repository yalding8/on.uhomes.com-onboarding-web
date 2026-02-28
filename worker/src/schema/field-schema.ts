/**
 * Field Schema — 定义 Building Onboarding 的所有字段元数据。
 *
 * [复制自主应用 src/lib/onboarding/field-schema.ts]
 * 类型定义和工具函数在此文件，字段数据定义在 field-definitions.ts。
 */

import { FIELD_DEFINITIONS } from "./field-definitions.js";

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
  weight: number;
  extractTier: ExtractTier;
  required: boolean;
  options?: string[];
  description?: string;
}

export const FIELD_SCHEMA: FieldDefinition[] = FIELD_DEFINITIONS;

export function getFieldByKey(key: string): FieldDefinition | undefined {
  return FIELD_SCHEMA.find((f) => f.key === key);
}

/** 返回所有合法的字段 key 集合 */
export function getValidFieldKeys(): Set<string> {
  return new Set(FIELD_SCHEMA.map((f) => f.key));
}
