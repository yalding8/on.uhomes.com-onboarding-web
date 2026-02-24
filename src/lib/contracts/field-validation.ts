/**
 * Contract field validation — pure functions, no side effects
 *
 * Validation rules:
 * - All fields are required (non-empty)
 * - commission_rate: valid number, range 0–100
 * - contract_start_date: valid date format
 * - contract_end_date: valid date format, must be after start_date
 */

import type { ContractFields, FieldValidationResult } from "./types";
import { CONTRACT_FIELD_KEYS } from "./types";

/** Required text fields (non-empty check only) */
const REQUIRED_TEXT_FIELDS: ReadonlyArray<keyof ContractFields> = [
  "partner_company_name",
  "partner_contact_name",
  "partner_address",
  "partner_city",
  "partner_country",
  "covered_properties",
] as const;

/**
 * Check if a string is a valid date (parseable by Date and not NaN)
 */
function isValidDate(value: string): boolean {
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/**
 * Validate contract dynamic fields for completeness and format
 *
 * @param fields - partial or full contract fields
 * @returns validation result with valid flag and errors map
 */
export function validateContractFields(
  fields: Partial<ContractFields>,
): FieldValidationResult {
  const errors: Record<string, string> = {};

  // 1. Required text fields — non-empty check
  for (const key of REQUIRED_TEXT_FIELDS) {
    const value = fields[key];
    if (value === undefined || value === null || value.trim() === "") {
      errors[key] = `${key} is required`;
    }
  }

  // 2. commission_rate — non-empty + valid number + range 0–100
  const rate = fields.commission_rate;
  if (rate === undefined || rate === null || rate.trim() === "") {
    errors.commission_rate = "commission_rate is required";
  } else {
    const num = Number(rate);
    if (isNaN(num)) {
      errors.commission_rate = "commission_rate must be a valid number";
    } else if (num < 0 || num > 100) {
      errors.commission_rate = "commission_rate must be between 0 and 100";
    }
  }

  // 3. contract_start_date — non-empty + valid date
  const startDate = fields.contract_start_date;
  if (
    startDate === undefined ||
    startDate === null ||
    startDate.trim() === ""
  ) {
    errors.contract_start_date = "contract_start_date is required";
  } else if (!isValidDate(startDate)) {
    errors.contract_start_date = "contract_start_date is not a valid date";
  }

  // 4. contract_end_date — non-empty + valid date + after start_date
  const endDate = fields.contract_end_date;
  if (endDate === undefined || endDate === null || endDate.trim() === "") {
    errors.contract_end_date = "contract_end_date is required";
  } else if (!isValidDate(endDate)) {
    errors.contract_end_date = "contract_end_date is not a valid date";
  } else if (
    startDate &&
    startDate.trim() !== "" &&
    isValidDate(startDate) &&
    new Date(endDate) <= new Date(startDate)
  ) {
    errors.contract_end_date = "contract_end_date must be after contract_start_date";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Check if all required fields are filled (no format validation, non-empty only)
 * Used for quick check before pushing for review
 */
export function getMissingFields(
  fields: Partial<ContractFields>,
): ReadonlyArray<keyof ContractFields> {
  return CONTRACT_FIELD_KEYS.filter((key) => {
    const value = fields[key];
    return value === undefined || value === null || value.trim() === "";
  });
}
