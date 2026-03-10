/**
 * FieldValue — 每个字段在 building_onboarding_data.field_values 中的存储结构。
 * 携带数据来源、置信度和审计元数据。
 */

export type DataSource =
  | "contract_pdf"
  | "website_crawl"
  | "google_sheets"
  | "file_upload"
  | "dropbox"
  | "api_doc"
  | "manual_input";
export type Confidence = "high" | "medium" | "low";

export interface FieldValue {
  value: unknown;
  source: DataSource;
  confidence: Confidence;
  confirmedBy?: string; // user_id
  confirmedAt?: string; // ISO timestamp
  updatedBy: string; // user_id or 'system'
  updatedAt: string; // ISO timestamp
}

/** 检查一个 FieldValue 是否有有效值（非 null、非 undefined、非空字符串、非空数组） */
export function hasValue(fv: FieldValue | undefined): boolean {
  if (!fv) return false;
  const v = fv.value;
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}
