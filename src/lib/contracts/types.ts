/**
 * 合同相关 TypeScript 类型定义
 *
 * 合同状态流转路径：
 * DRAFT → PENDING_REVIEW → CONFIRMED → SENT → SIGNED
 * DRAFT / PENDING_REVIEW / CONFIRMED → CANCELED
 */

/** 合同类型：标准合同 / 自定义上传合同 */
export type ContractType = "STANDARD" | "CUSTOM";

/** 合同状态联合类型，对应 contracts 表 status CHECK 约束 */
export type ContractStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "CONFIRMED"
  | "SENT"
  | "SIGNED"
  | "CANCELED";

/** 合同动态字段，存储于 contracts.contract_fields JSONB 列 */
export interface ContractFields {
  partner_company_name: string;
  partner_contact_name: string;
  partner_address: string;
  partner_city: string;
  partner_country: string;
  commission_rate: string;
  contract_start_date: string; // ISO date string, e.g. "2026-03-01"
  contract_end_date: string; // ISO date string, e.g. "2027-02-28"
  covered_properties: string;
}

/** 合同动态字段的所有字段名 */
export const CONTRACT_FIELD_KEYS: ReadonlyArray<keyof ContractFields> = [
  "partner_company_name",
  "partner_contact_name",
  "partner_address",
  "partner_city",
  "partner_country",
  "commission_rate",
  "contract_start_date",
  "contract_end_date",
  "covered_properties",
] as const;

/** 字段验证结果 */
export interface FieldValidationResult {
  valid: boolean;
  errors: Record<string, string>; // fieldName → errorMessage
}

/** Field labels for the 9 dynamic contract fields */
export const FIELD_LABELS: Record<keyof ContractFields, string> = {
  partner_company_name: "Partner Company",
  partner_contact_name: "Contact Name",
  partner_address: "Address",
  partner_city: "City",
  partner_country: "Country / Region",
  commission_rate: "Commission Rate (%)",
  contract_start_date: "Contract Start Date",
  contract_end_date: "Contract End Date",
  covered_properties: "Covered Properties",
};

/** Field display order */
export const FIELD_ORDER: ReadonlyArray<keyof ContractFields> = [
  "partner_company_name",
  "partner_contact_name",
  "partner_address",
  "partner_city",
  "partner_country",
  "commission_rate",
  "contract_start_date",
  "contract_end_date",
  "covered_properties",
];
