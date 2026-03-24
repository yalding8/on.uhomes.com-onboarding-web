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

/** Top 80 美国公寓市场城市 — 用于 .com 站点推断 country=US */
// prettier-ignore
const US_CITIES = new Set([
  // NYC metro
  "new york", "brooklyn", "manhattan", "queens", "harlem",
  "jersey city", "hoboken", "fort lee", "long island city",
  "newark", "new haven", "rego park", "forest hills",
  "woodside", "inwood", "astoria", "the bronx", "staten island",
  // Major metros
  "los angeles", "chicago", "houston", "phoenix", "philadelphia",
  "san antonio", "san diego", "dallas", "austin", "san jose",
  "san francisco", "seattle", "denver", "washington", "nashville",
  "boston", "portland", "las vegas", "atlanta", "miami",
  "minneapolis", "tampa", "orlando", "charlotte", "raleigh",
  "pittsburgh", "columbus", "indianapolis", "cincinnati", "cleveland",
  "detroit", "milwaukee", "kansas city", "st. louis", "salt lake city",
  // College / student housing markets
  "ann arbor", "madison", "boulder", "gainesville", "tempe",
  "tucson", "college station", "ithaca", "chapel hill", "durham",
  "berkeley", "stanford", "eugene", "tuscaloosa", "state college",
  "champaign", "bloomington", "tallahassee", "baton rouge",
  // Sunbelt growth
  "sacramento", "riverside", "irvine", "scottsdale", "mesa",
  "plano", "frisco", "arlington", "fort worth", "jacksonville",
  "savannah", "charleston", "greenville", "richmond", "norfolk",
  "honolulu", "anchorage", "albuquerque", "el paso", "omaha",
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

  // 2. 从已知 US city 推断 country=US
  if (!fields.country && !inferred.country) {
    const cityVal = fields.city?.value;
    if (typeof cityVal === "string" && US_CITIES.has(cityVal.toLowerCase())) {
      inferred.country = { value: "United States", confidence: "medium" };
    }
  }

  // 2b. .com 域名默认推断 US（公寓行业 .com >90% 为美国站点）
  if (!fields.country && !inferred.country) {
    const tld = extractTld(sourceUrl);
    if (tld === "com") {
      inferred.country = { value: "United States", confidence: "low" };
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
