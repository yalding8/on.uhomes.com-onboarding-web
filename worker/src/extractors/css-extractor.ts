/**
 * CSS 选择器提取层 — 基于常见 DOM 模式直接提取字段
 *
 * 在 JSON-LD/OG 之后、LLM 之前执行。
 * 通用规则 + 平台专用规则（Entrata/RentCafe/AppFolio）双轨。
 */

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { ExtractedFields, Confidence } from "../types.js";

interface CssRule {
  fieldKey: string;
  selectors: string[];
  extract: "text" | "href" | "list" | "srcList";
  transform?: (raw: string) => unknown;
  confidence: Confidence;
}

// prettier-ignore
const GENERIC_RULES: CssRule[] = [
  { fieldKey: "primary_contact_email", selectors: ['a[href^="mailto:"]'], extract: "href", transform: (h) => h.replace("mailto:", "").split("?")[0], confidence: "medium" },
  { fieldKey: "primary_contact_phone", selectors: ['a[href^="tel:"]'], extract: "href", transform: (h) => h.replace("tel:", ""), confidence: "medium" },
  { fieldKey: "building_address", selectors: ['[itemprop="streetAddress"]', '[itemprop="address"]', ".property-address", "address", '[class*="address"]'], extract: "text", confidence: "medium" },
  { fieldKey: "city", selectors: ['[itemprop="addressLocality"]'], extract: "text", confidence: "medium" },
  { fieldKey: "postal_code", selectors: ['[itemprop="postalCode"]', '[class*="zip-code"]', '[class*="postal"]'], extract: "text", confidence: "medium" },
  { fieldKey: "country", selectors: ['[itemprop="addressCountry"]'], extract: "text", confidence: "medium" },
  { fieldKey: "price_min", selectors: ["[data-price-min]", ".price-range .min", '[itemprop="lowPrice"]'], extract: "text", transform: extractNumericPrice, confidence: "medium" },
  { fieldKey: "price_max", selectors: ["[data-price-max]", ".price-range .max", '[itemprop="highPrice"]'], extract: "text", transform: extractNumericPrice, confidence: "medium" },
  { fieldKey: "key_amenities", selectors: [".amenities li", ".amenity-list li", ".features li", ".amenity-item"], extract: "list", transform: normalizeAmenities, confidence: "medium" },
  { fieldKey: "images", selectors: [".gallery img", ".carousel img", ".slider img", '[data-gallery] img'], extract: "srcList", confidence: "medium" },
  { fieldKey: "application_link", selectors: ['a[href*="apply"]', 'a[href*="application"]', 'a[href*="booking"]', ".apply-button", ".apply-now"], extract: "href", confidence: "medium" },
  { fieldKey: "total_units", selectors: [".unit-count", ".total-units", '[data-units]'], extract: "text", transform: extractNumber, confidence: "medium" },
];

// prettier-ignore
const PLATFORM_RULES: Record<string, CssRule[]> = {
  entrata: [
    { fieldKey: "price_min", selectors: [".rent-range .min-rent", ".rentLabel"], extract: "text", transform: extractNumericPrice, confidence: "high" },
    { fieldKey: "price_max", selectors: [".rent-range .max-rent"], extract: "text", transform: extractNumericPrice, confidence: "high" },
    { fieldKey: "total_units", selectors: [".unit-count", ".available-units"], extract: "text", transform: extractNumber, confidence: "high" },
  ],
  rentcafe: [
    { fieldKey: "price_min", selectors: [".rentRollup .rent", ".price-range"], extract: "text", transform: extractNumericPrice, confidence: "high" },
    { fieldKey: "key_amenities", selectors: [".amenityLabel", ".amenity-name"], extract: "list", transform: normalizeAmenities, confidence: "high" },
  ],
  appfolio: [
    { fieldKey: "price_min", selectors: [".listing-price"], extract: "text", transform: extractNumericPrice, confidence: "high" },
  ],
};

export function extractWithCss(
  html: string,
  platform?: string,
): ExtractedFields {
  const $ = cheerio.load(html);
  const fields: ExtractedFields = {};
  if (platform && PLATFORM_RULES[platform]) {
    applyRules($, PLATFORM_RULES[platform], fields);
  }
  applyRules($, GENERIC_RULES, fields);
  extractPriceFromText($, fields);
  return fields;
}

function applyRules(
  $: cheerio.CheerioAPI,
  rules: CssRule[],
  fields: ExtractedFields,
): void {
  for (const rule of rules) {
    if (fields[rule.fieldKey]) continue;
    for (const selector of rule.selectors) {
      const els = $(selector);
      if (els.length === 0) continue;
      const value = extractValue($, els, rule.extract);
      if (value === null || value === undefined) continue;
      if (typeof value === "string" && !value.trim()) continue;
      const transformed = rule.transform
        ? rule.transform(value as string)
        : value;
      if (transformed === null || transformed === undefined) continue;
      fields[rule.fieldKey] = {
        value: transformed,
        confidence: rule.confidence,
      };
      break;
    }
  }
}

function extractValue(
  $: cheerio.CheerioAPI,
  els: cheerio.Cheerio<AnyNode>,
  mode: CssRule["extract"],
): unknown {
  switch (mode) {
    case "text":
      return els.first().text().trim();
    case "href":
      return els.first().attr("href") || "";
    case "list": {
      const items: string[] = [];
      els.each((_, el) => {
        const t = $(el).text().trim();
        if (t && t.length < 100) items.push(t);
      });
      return items.length > 0 ? items : null;
    }
    case "srcList": {
      const srcs: string[] = [];
      els.each((_, el) => {
        const s = $(el).attr("src") || $(el).attr("data-src") || "";
        if (s && !s.startsWith("data:")) srcs.push(s);
      });
      return srcs.length > 0 ? [...new Set(srcs)].slice(0, 10) : null;
    }
  }
}

function extractNumericPrice(raw: string): number | null {
  const cleaned = String(raw).replace(/[$€£¥,\s]/g, "");
  const match = cleaned.match(/[\d.]+/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
}

function extractNumber(raw: string): number | null {
  const match = String(raw).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/** 从页面正文文本中用正则提取价格（CSS 选择器未命中时的 fallback） */
function extractPriceFromText(
  $: cheerio.CheerioAPI,
  fields: ExtractedFields,
): void {
  if (fields.price_min && fields.price_max) return;

  const text = $("body").text();
  const ranges: number[] = [];

  // "$1,200 - $3,500" or "£150 – £250" or "$1200 to $3500"
  const rangeRe = /[$£€]\s*([\d,]+)\s*[-–—]\s*[$£€]?\s*([\d,]+)/g;
  let m;
  while ((m = rangeRe.exec(text)) !== null) {
    pushPrice(ranges, m[1]);
    pushPrice(ranges, m[2]);
  }

  // "From $1,200" / "Starting at £150"
  const fromRe = /(?:from|starting\s+at)\s+[$£€]\s*([\d,]+)/gi;
  while ((m = fromRe.exec(text)) !== null) {
    pushPrice(ranges, m[1]);
  }

  if (ranges.length === 0) return;
  ranges.sort((a, b) => a - b);

  if (!fields.price_min) {
    fields.price_min = { value: ranges[0], confidence: "low" };
  }
  if (!fields.price_max && ranges.length > 1) {
    fields.price_max = {
      value: ranges[ranges.length - 1],
      confidence: "low",
    };
  }
}

function pushPrice(arr: number[], raw: string): void {
  const num = parseFloat(raw.replace(/,/g, ""));
  if (!isNaN(num) && num >= 50 && num <= 50_000) arr.push(num);
}

// prettier-ignore
const AMENITY_LABEL_MAP: Record<string, string> = {
  gym: "Gym", "fitness center": "Gym", "fitness centre": "Gym",
  pool: "Pool", "swimming pool": "Pool", laundry: "Laundry", parking: "Parking",
  "study room": "Study Room", "study lounge": "Study Room",
  "co-working": "Study Room", coworking: "Study Room", "business center": "Study Room",
  rooftop: "Rooftop", "roof deck": "Rooftop", terrace: "Rooftop", patio: "Rooftop",
  "pet friendly": "Pet Friendly", "pets allowed": "Pet Friendly", "dog park": "Pet Friendly",
  furnished: "Furnished", "fully furnished": "Furnished",
  wifi: "WiFi", "wi-fi": "WiFi", internet: "WiFi",
  security: "Security", "24/7 security": "Security", concierge: "Security", doorman: "Security",
  "bike storage": "Bike Storage", "bicycle storage": "Bike Storage",
  "game room": "Game Room", "games room": "Game Room",
  "movie room": "Game Room", theater: "Game Room", "screening room": "Game Room",
  elevator: "Elevator", lift: "Elevator",
  "ev charging": "EV Charging", "electric vehicle": "EV Charging",
  "package locker": "Package Room", "package room": "Package Room",
};

function normalizeAmenities(raw: string): string[] | null {
  const items: string[] = Array.isArray(raw) ? raw : [raw];
  const matched = new Set<string>();
  for (const item of items) {
    const lower = item.toLowerCase().trim();
    if (AMENITY_LABEL_MAP[lower]) {
      matched.add(AMENITY_LABEL_MAP[lower]);
      continue;
    }
    for (const [keyword, label] of Object.entries(AMENITY_LABEL_MAP)) {
      if (lower.includes(keyword)) matched.add(label);
    }
  }
  return matched.size > 0 ? [...matched] : null;
}
