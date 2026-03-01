"use client";

/**
 * Contract field input grid — renders the 9 editable fields.
 * Extracted from ContractEditForm to stay under 300-line limit.
 */

import type { ContractFields } from "@/lib/contracts/types";
import { CONTRACT_FIELD_KEYS } from "@/lib/contracts/types";

/** Field labels */
const FIELD_LABELS: Record<keyof ContractFields, string> = {
  partner_company_name: "Partner Company Name",
  partner_contact_name: "Partner Contact Name",
  partner_address: "Partner Address",
  partner_city: "Partner City",
  partner_country: "Partner Country / Region",
  commission_rate: "Commission Rate (%)",
  contract_start_date: "Contract Start Date",
  contract_end_date: "Contract End Date",
  covered_properties: "Covered Properties",
};

const FIELD_INPUT_TYPES: Partial<Record<keyof ContractFields, string>> = {
  commission_rate: "number",
  contract_start_date: "date",
  contract_end_date: "date",
};

const TEXTAREA_FIELDS: ReadonlyArray<keyof ContractFields> = [
  "covered_properties",
];

export function ContractFieldGrid({
  fields,
  errors,
  isEditable,
  onFieldChange,
}: {
  fields: Partial<ContractFields>;
  errors: Record<string, string>;
  isEditable: boolean;
  onFieldChange: (key: keyof ContractFields, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {CONTRACT_FIELD_KEYS.map((key) => {
        const isTextarea = TEXTAREA_FIELDS.includes(key);
        const inputType = FIELD_INPUT_TYPES[key] ?? "text";
        const value = fields[key] ?? "";
        const error = errors[key];

        return (
          <div key={key} className={isTextarea ? "md:col-span-2" : ""}>
            <label
              htmlFor={`field-${key}`}
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
            >
              {FIELD_LABELS[key]}
            </label>

            {isTextarea ? (
              <textarea
                id={`field-${key}`}
                value={value}
                onChange={(e) => onFieldChange(key, e.target.value)}
                disabled={!isEditable}
                rows={3}
                className={`w-full rounded-md border px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed ${
                  error
                    ? "border-[var(--color-warning)]"
                    : "border-[var(--color-border)]"
                } focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]`}
              />
            ) : (
              <input
                id={`field-${key}`}
                type={inputType}
                value={value}
                onChange={(e) => onFieldChange(key, e.target.value)}
                disabled={!isEditable}
                step={inputType === "number" ? "0.01" : undefined}
                min={inputType === "number" ? "0" : undefined}
                max={inputType === "number" ? "100" : undefined}
                className={`w-full rounded-md border px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed ${
                  error
                    ? "border-[var(--color-warning)]"
                    : "border-[var(--color-border)]"
                } focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]`}
              />
            )}

            {error && (
              <p className="mt-1 text-xs text-[var(--color-warning)]">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
