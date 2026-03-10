/**
 * Field Applicability — N/A 字段排除机制。
 *
 * 某些字段仅在特定条件下适用（如 i20_accepted 仅 US 市场）。
 * 不适用的字段从评分分母中排除。
 */

import type { FieldValue } from "./field-value";

interface ApplicabilityRule {
  field: string;
  dependsOn: string;
  condition: (value: unknown) => boolean;
}

const US_ALIASES = ["us", "usa", "united states", "united states of america"];

export const APPLICABILITY_RULES: ApplicabilityRule[] = [
  {
    field: "i20_accepted",
    dependsOn: "country",
    condition: (v) => {
      const s = String(v ?? "")
        .toLowerCase()
        .trim();
      return US_ALIASES.includes(s);
    },
  },
  {
    field: "pet_fee",
    dependsOn: "key_amenities",
    condition: (v) => Array.isArray(v) && v.includes("Pet Friendly"),
  },
  {
    field: "pet_rent",
    dependsOn: "key_amenities",
    condition: (v) => Array.isArray(v) && v.includes("Pet Friendly"),
  },
  {
    field: "commission_short_term",
    dependsOn: "commission_structure",
    condition: (v) => typeof v === "string" && v.trim().length > 0,
  },
  {
    field: "commission_renewals",
    dependsOn: "commission_structure",
    condition: (v) => typeof v === "string" && v.trim().length > 0,
  },
];

export function getExcludedFields(
  fieldValues: Record<string, FieldValue>,
): Set<string> {
  const excluded = new Set<string>();
  for (const rule of APPLICABILITY_RULES) {
    const depValue = fieldValues[rule.dependsOn]?.value;
    if (!rule.condition(depValue)) {
      excluded.add(rule.field);
    }
  }
  return excluded;
}
