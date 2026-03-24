/**
 * 地理信息推断 — 从 URL TLD、已知城市、价格符号推断 country / currency
 *
 * 在结构化提取之后、LLM 之前调用，为 LLM 提供更完整的上下文。
 */

import type { ExtractedFields } from "../types.js";

// prettier-ignore
const TLD_COUNTRY: Record<string, string> = {
  "co.uk": "United Kingdom", "uk": "United Kingdom",
  "com.au": "Australia", "au": "Australia",
  "ca": "Canada", "de": "Germany", "fr": "France",
  "nl": "Netherlands", "ie": "Ireland", "es": "Spain",
  "it": "Italy", "nz": "New Zealand", "sg": "Singapore",
  "jp": "Japan", "cn": "China", "hk": "Hong Kong",
  "pt": "Portugal", "at": "Austria", "be": "Belgium",
};

// prettier-ignore
const COUNTRY_CURRENCY: Record<string, string> = {
  "United States": "USD", "United Kingdom": "GBP",
  "Australia": "AUD", "Canada": "CAD",
  "Germany": "EUR", "France": "EUR", "Netherlands": "EUR",
  "Ireland": "EUR", "Spain": "EUR", "Italy": "EUR",
  "Austria": "EUR", "Belgium": "EUR", "Portugal": "EUR",
  "New Zealand": "NZD", "Singapore": "SGD",
  "Japan": "JPY", "China": "CNY", "Hong Kong": "HKD",
};

/** 常见美国城市（来自爬取样本） — 用于 .com 站点推断 country=US */
// prettier-ignore
const US_CITIES = new Set([
  "new york", "brooklyn", "manhattan", "queens", "harlem",
  "jersey city", "hoboken", "fort lee", "long island city",
  "newark", "new haven", "rego park", "forest hills",
  "woodside", "inwood",
]);

function extractTld(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split(".");
    if (parts.length >= 3) {
      const twoPartTld = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      if (TLD_COUNTRY[twoPartTld]) return twoPartTld;
    }
    return parts[parts.length - 1];
  } catch {
    return "";
  }
}

/**
 * 从 URL 和已提取字段推断 country / currency。
 * 仅补充缺失字段，不覆盖已有值。置信度为 medium。
 */
export function inferGeoFields(
  fields: ExtractedFields,
  sourceUrl: string,
): ExtractedFields {
  const inferred: ExtractedFields = {};

  // 1. 从 TLD 推断 country
  if (!fields.country) {
    const tld = extractTld(sourceUrl);
    const country = TLD_COUNTRY[tld];
    if (country) {
      inferred.country = { value: country, confidence: "medium" };
    }
  }

  // 2. .com 站点：从已知 US city 推断 country=US
  if (!fields.country && !inferred.country) {
    const cityVal = fields.city?.value;
    if (typeof cityVal === "string" && US_CITIES.has(cityVal.toLowerCase())) {
      inferred.country = { value: "United States", confidence: "medium" };
    }
  }

  // 3. 从 country 推断 currency
  const country = (fields.country?.value ?? inferred.country?.value) as
    | string
    | undefined;
  if (!fields.currency && country) {
    const currency = COUNTRY_CURRENCY[country];
    if (currency) {
      inferred.currency = { value: currency, confidence: "medium" };
    }
  }

  return inferred;
}
