/**
 * 合同字段验证 — 纯函数实现，无副作用
 *
 * 验证规则：
 * - 所有字段非空
 * - commission_rate: 有效数值，范围 0–100
 * - contract_start_date: 有效日期格式
 * - contract_end_date: 有效日期格式，且晚于 start_date
 */

import type { ContractFields, FieldValidationResult } from "./types";
import { CONTRACT_FIELD_KEYS } from "./types";

/** 纯文本必填字段（仅校验非空） */
const REQUIRED_TEXT_FIELDS: ReadonlyArray<keyof ContractFields> = [
  "partner_company_name",
  "partner_contact_name",
  "partner_address",
  "partner_city",
  "partner_country",
  "covered_properties",
] as const;

/**
 * 判断字符串是否为有效的日期（可被 Date 正确解析且不为 NaN）
 */
function isValidDate(value: string): boolean {
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/**
 * 校验合同动态字段的完整性和格式
 *
 * @param fields - 部分或全部合同字段
 * @returns 验证结果，包含 valid 标志和 errors 映射
 */
export function validateContractFields(
  fields: Partial<ContractFields>,
): FieldValidationResult {
  const errors: Record<string, string> = {};

  // 1. 纯文本必填字段 — 非空校验
  for (const key of REQUIRED_TEXT_FIELDS) {
    const value = fields[key];
    if (value === undefined || value === null || value.trim() === "") {
      errors[key] = `${key} 为必填项`;
    }
  }

  // 2. commission_rate — 非空 + 有效数值 + 范围 0–100
  const rate = fields.commission_rate;
  if (rate === undefined || rate === null || rate.trim() === "") {
    errors.commission_rate = "commission_rate 为必填项";
  } else {
    const num = Number(rate);
    if (isNaN(num)) {
      errors.commission_rate = "commission_rate 必须为有效数值";
    } else if (num < 0 || num > 100) {
      errors.commission_rate = "commission_rate 必须在 0 到 100 之间";
    }
  }

  // 3. contract_start_date — 非空 + 有效日期
  const startDate = fields.contract_start_date;
  if (
    startDate === undefined ||
    startDate === null ||
    startDate.trim() === ""
  ) {
    errors.contract_start_date = "contract_start_date 为必填项";
  } else if (!isValidDate(startDate)) {
    errors.contract_start_date = "contract_start_date 不是有效日期";
  }

  // 4. contract_end_date — 非空 + 有效日期 + 晚于 start_date
  const endDate = fields.contract_end_date;
  if (endDate === undefined || endDate === null || endDate.trim() === "") {
    errors.contract_end_date = "contract_end_date 为必填项";
  } else if (!isValidDate(endDate)) {
    errors.contract_end_date = "contract_end_date 不是有效日期";
  } else if (
    startDate &&
    startDate.trim() !== "" &&
    isValidDate(startDate) &&
    new Date(endDate) <= new Date(startDate)
  ) {
    errors.contract_end_date = "contract_end_date 必须晚于 contract_start_date";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * 检查所有必填字段是否已填写（不做格式校验，仅非空检查）
 * 用于推送审阅前的快速检查
 */
export function getMissingFields(
  fields: Partial<ContractFields>,
): ReadonlyArray<keyof ContractFields> {
  return CONTRACT_FIELD_KEYS.filter((key) => {
    const value = fields[key];
    return value === undefined || value === null || value.trim() === "";
  });
}
