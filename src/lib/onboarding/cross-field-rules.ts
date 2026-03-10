/**
 * Cross-Field Rules — 上下文感知的 Soft Validation。
 *
 * 产生警告而非拒绝，在 Gap Report 中显示为黄色提示。
 * 价格范围数据来源：uhomes.com 现有房源 P5-P95 区间。
 */

import type { FieldValue } from "./field-value";

export interface SoftValidationWarning {
  field: string;
  message: string;
  severity: "warning" | "info";
}

interface PriceRange {
  min: number;
  max: number;
}

const PRICE_RANGES: Record<string, PriceRange> = {
  "US:Per Bedroom:Monthly": { min: 300, max: 5000 },
  "US:Per Unit:Monthly": { min: 800, max: 10000 },
  "UK:Per Bedroom:Weekly": { min: 80, max: 600 },
  "UK:Per Unit:Weekly": { min: 150, max: 1500 },
  "UK:Per Bedroom:Per Semester": { min: 2000, max: 12000 },
  "AU:Per Bedroom:Weekly": { min: 150, max: 800 },
  "AU:Per Unit:Weekly": { min: 250, max: 1500 },
  "CA:Per Bedroom:Monthly": { min: 400, max: 4000 },
  "EU:Per Bedroom:Monthly": { min: 300, max: 3000 },
  DEFAULT: { min: 50, max: 20000 },
};

const US_ALIASES = ["us", "usa", "united states", "united states of america"];
const UK_ALIASES = [
  "uk",
  "gb",
  "united kingdom",
  "great britain",
  "england",
  "scotland",
  "wales",
];
const AU_ALIASES = ["au", "australia"];
const CA_ALIASES = ["ca", "canada"];
const EU_COUNTRIES = [
  "germany",
  "france",
  "netherlands",
  "ireland",
  "spain",
  "italy",
  "de",
  "fr",
  "nl",
  "ie",
  "es",
  "it",
];

export function normalizeCountryRegion(raw: string | undefined): string {
  if (!raw) return "DEFAULT";
  const normalized = raw.trim().toLowerCase();
  if (US_ALIASES.includes(normalized)) return "US";
  if (UK_ALIASES.includes(normalized)) return "UK";
  if (AU_ALIASES.includes(normalized)) return "AU";
  if (CA_ALIASES.includes(normalized)) return "CA";
  if (EU_COUNTRIES.includes(normalized)) return "EU";
  return "DEFAULT";
}

export function validatePriceContext(
  fieldValues: Record<string, FieldValue>,
): SoftValidationWarning[] {
  const warnings: SoftValidationWarning[] = [];

  const country = normalizeCountryRegion(
    fieldValues.country?.value as string | undefined,
  );
  const method = (fieldValues.rental_method?.value as string) ?? "Per Bedroom";
  const period = (fieldValues.rent_period?.value as string) ?? "Monthly";

  const key = `${country}:${method}:${period}`;
  const range = PRICE_RANGES[key] ?? PRICE_RANGES["DEFAULT"];

  const priceMin = fieldValues.price_min?.value;
  const priceMax = fieldValues.price_max?.value;

  if (typeof priceMin === "number" && priceMin < range.min) {
    warnings.push({
      field: "price_min",
      message: `Price ${priceMin} seems low for ${country} ${method} ${period} rentals (typical: ${range.min}–${range.max})`,
      severity: "warning",
    });
  }
  if (typeof priceMax === "number" && priceMax > range.max) {
    warnings.push({
      field: "price_max",
      message: `Price ${priceMax} seems high for ${country} ${method} ${period} rentals (typical: ${range.min}–${range.max})`,
      severity: "warning",
    });
  }

  return warnings;
}
