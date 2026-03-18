# Crawler Quality Enhancement — 设计方案 v1

> Major Track 设计文档
> 日期: 2026-03-17
> 分支: feat/global-apartment-crawler

---

## 0. 背景与目标

### 0.1 现状

Benchmark 测试（8 个真实公寓站点）显示：

- **策略路由命中率 100%** — 基础设施成熟
- **字段提取率极低** — 4/8 站点提取 0 字段，平均仅 2 字段/站点
- Tier A 覆盖率 64%，Tier B 覆盖率 71%，Tier C 0%

### 0.2 根因分析（9 大瓶颈）

| #   | 根因                                                                 | 严重度 | 位置                                                    |
| --- | -------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| R1  | NavLinks 仅从 `<nav>` 提取，SPA/现代站点导航在 `<header>`/`<div>` 中 | HIGH   | `cheerio-scraper.ts:124`                                |
| R2  | OG mapper 仅提取 4 个字段（title/desc/image/url）                    | HIGH   | `og-mapper.ts:10-30`                                    |
| R3  | JSON-LD mapper 仅 18 条规则，常见变体未覆盖                          | HIGH   | `structured-data-mapper.ts:22-141`                      |
| R4  | Markdown 转换移除 nav/header/footer，丢失联系方式和导航链接          | MEDIUM | `html-to-markdown.ts:12-13`, `cheerio-scraper.ts:52-53` |
| R5  | LLM prompt 平等列出 35+ 字段，无优先级区分                           | MEDIUM | `website-fields.ts:16-63`                               |
| R6  | 60K 字符截断丢失页面底部的价格/设施信息                              | MEDIUM | `llm-extractor.ts:16,33-36`                             |
| R7  | 覆盖率仅统计 JSON-LD，OG/LLM 提取不计入                              | LOW    | `website-crawl.ts:176-179`                              |
| R8  | 无 CSS 选择器直接提取层 — 缺少对常见 DOM 模式的结构化解析            | HIGH   | 缺失                                                    |
| R9  | 子页面 LLM 无条件触发（>100 字符即调用），浪费 token 且增加延迟      | LOW    | `website-crawl.ts:316`                                  |

### 0.3 目标

| 指标              | 当前      | 目标      |
| ----------------- | --------- | --------- |
| Tier A 字段覆盖率 | 64%       | ≥ 90%     |
| Tier B 字段覆盖率 | 71%       | ≥ 85%     |
| 平均提取字段数    | 2/站点    | ≥ 10/站点 |
| 0 字段站点比例    | 50% (4/8) | ≤ 5%      |
| Benchmark 站点数  | 8         | ≥ 30      |

---

## 1. 扩展链接发现范围（修复 R1）

### 1.1 问题

`cheerio-scraper.ts:124` 仅 `$("nav a[href]")` 提取导航链接。现代 SPA 常把导航放在 `<header>`、自定义 `<div>` 或 `role="navigation"` 元素中。

### 1.2 方案

扩展 `extractNavLinks` 的选择器覆盖范围，同时增加去噪过滤：

```typescript
// cheerio-scraper.ts — extractNavLinks 改造
function extractNavLinks(
  $: cheerio.CheerioAPI,
): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const seen = new Set<string>();

  // 优先级 1: 语义化导航
  const NAV_SELECTORS = [
    "nav a[href]",
    '[role="navigation"] a[href]',
    "header a[href]",
    ".nav a[href]",
    ".navbar a[href]",
    ".navigation a[href]",
    ".menu a[href]",
    "#menu a[href]",
  ];

  for (const selector of NAV_SELECTORS) {
    $(selector).each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();
      if (href && text && !seen.has(href)) {
        seen.add(href);
        links.push({ href, text });
      }
    });
  }

  // 优先级 2: 如果语义化导航为空，fallback 到全页面链接（排除噪音）
  if (links.length === 0) {
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();
      if (!href || !text || seen.has(href)) return;
      // 排除噪音链接
      if (/^(mailto:|tel:|javascript:|#|data:)/.test(href)) return;
      if (text.length > 60) return; // 过长文本通常不是导航项
      if (text.length < 2) return; // 过短通常是图标
      seen.add(href);
      links.push({ href, text });
    });
  }

  return links;
}
```

### 1.3 同步修改 Playwright scraper

`scraper.ts` 中的浏览器脚本也需要同步扩展链接发现逻辑（使用相同的选择器优先级）。

### 1.4 影响范围

- `worker/src/crawl/cheerio-scraper.ts` — `extractNavLinks` 函数
- `worker/src/crawl/scraper.ts` — 浏览器端链接提取脚本
- 无数据库变更

---

## 2. 新增 CSS 选择器提取层（修复 R8）

### 2.1 问题

当前提取管线是 `JSON-LD → OG → LLM`，缺少对常见 DOM 模式的直接解析。大量公寓网站没有 JSON-LD，但有可预测的 HTML 结构（价格区域、设施列表、联系表单等）。

### 2.2 方案：新增 `css-extractor.ts`

在 OG 提取之后、LLM 提取之前，增加一个基于 CSS 选择器的提取层：

```typescript
// worker/src/extractors/css-extractor.ts

import type { ExtractedFields, Confidence } from "../types.js";

interface CssRule {
  fieldKey: string;
  selectors: string[]; // 按优先级排列的 CSS 选择器
  transform?: (text: string) => unknown;
  confidence: Confidence;
}

const CSS_RULES: CssRule[] = [
  // 价格提取
  {
    fieldKey: "price_min",
    selectors: [
      "[data-price-min]",
      ".price-range .min",
      ".pricing .starting-at",
      ".rent-range:first-child",
    ],
    transform: extractNumericPrice,
    confidence: "medium",
  },
  {
    fieldKey: "price_max",
    selectors: [
      "[data-price-max]",
      ".price-range .max",
      ".pricing .up-to",
      ".rent-range:last-child",
    ],
    transform: extractNumericPrice,
    confidence: "medium",
  },
  // 联系方式
  {
    fieldKey: "primary_contact_email",
    selectors: [
      'a[href^="mailto:"]',
      "[data-email]",
      ".contact-email",
      ".email-link",
    ],
    transform: extractEmail,
    confidence: "medium",
  },
  {
    fieldKey: "primary_contact_phone",
    selectors: [
      'a[href^="tel:"]',
      "[data-phone]",
      ".contact-phone",
      ".phone-number",
    ],
    transform: extractPhone,
    confidence: "medium",
  },
  // 地址
  {
    fieldKey: "building_address",
    selectors: [
      '[itemprop="streetAddress"]',
      ".property-address",
      ".building-address",
      "address",
    ],
    confidence: "medium",
  },
  // 设施列表
  {
    fieldKey: "key_amenities",
    selectors: [
      ".amenities li",
      ".amenity-list li",
      "[data-amenities] li",
      ".features li",
      ".feature-list li",
    ],
    transform: extractAmenityList,
    confidence: "medium",
  },
  // 图片
  {
    fieldKey: "images",
    selectors: [
      ".gallery img",
      ".photo-gallery img",
      ".carousel img",
      ".slider img",
      ".image-gallery img",
    ],
    transform: extractImageSrcs,
    confidence: "medium",
  },
];

// 平台模板专用规则（Entrata, RentCafe, AppFolio 等）
const PLATFORM_RULES: Record<string, CssRule[]> = {
  entrata: [
    {
      fieldKey: "price_min",
      selectors: [".rent-range .min-rent"],
      transform: extractNumericPrice,
      confidence: "high",
    },
    {
      fieldKey: "price_max",
      selectors: [".rent-range .max-rent"],
      transform: extractNumericPrice,
      confidence: "high",
    },
    {
      fieldKey: "total_units",
      selectors: [".unit-count"],
      transform: extractNumber,
      confidence: "high",
    },
  ],
  rentcafe: [
    {
      fieldKey: "price_min",
      selectors: [".rentRollup .rent"],
      transform: extractNumericPrice,
      confidence: "high",
    },
    {
      fieldKey: "key_amenities",
      selectors: [".amenityLabel"],
      transform: extractAmenityList,
      confidence: "high",
    },
  ],
  appfolio: [
    {
      fieldKey: "price_min",
      selectors: [".listing-price"],
      transform: extractNumericPrice,
      confidence: "high",
    },
  ],
};
```

### 2.3 集成到提取管线

```
website-crawl.ts 修改:
  extractLayered() 变为:
    1. JSON-LD 直接映射（high confidence）
    2. OpenGraph 补充（medium confidence）
    3. CSS 选择器提取（medium confidence）  ← 新增
    4. LLM 提取（仅针对仍缺失的字段）
```

### 2.4 平台检测联动

`site-probe.ts` 已能检测平台模板（Entrata, RentCafe 等）。当检测到特定平台时，优先使用对应的 `PLATFORM_RULES`。

### 2.5 影响范围

- 新增 `worker/src/extractors/css-extractor.ts`
- 修改 `worker/src/extractors/website-crawl.ts` — `extractLayered()` 增加 CSS 层
- 修改 `worker/src/crawl/cheerio-scraper.ts` — 返回 `$` 实例供 CSS 提取使用
- 无数据库变更

---

## 3. 扩展 OG Mapper（修复 R2）

### 3.1 问题

当前 `og-mapper.ts` 仅提取 4 个字段。OpenGraph 还有大量可用标签被忽略。

### 3.2 方案

```typescript
// og-mapper.ts 扩展
export function mapOpenGraphData(og: Record<string, string>): ExtractedFields {
  const fields: ExtractedFields = {};

  // 基础映射（已有）
  if (og.title)
    fields.building_name = { value: og.title, confidence: "medium" };
  if (og.description)
    fields.description = { value: og.description, confidence: "medium" };
  if (og.image) fields.cover_image = { value: og.image, confidence: "medium" };

  // 新增: 从 OG 提取更多字段
  if (og["street-address"] || og["street_address"]) {
    fields.building_address = {
      value: og["street-address"] || og["street_address"],
      confidence: "medium",
    };
  }
  if (og.locality) fields.city = { value: og.locality, confidence: "medium" };
  if (og["country-name"] || og.country_name) {
    fields.country = {
      value: og["country-name"] || og.country_name,
      confidence: "medium",
    };
  }
  if (og.postal_code || og["postal-code"]) {
    fields.postal_code = {
      value: og.postal_code || og["postal-code"],
      confidence: "medium",
    };
  }
  if (og.phone_number) {
    fields.primary_contact_phone = {
      value: og.phone_number,
      confidence: "medium",
    };
  }
  if (og.email) {
    fields.primary_contact_email = { value: og.email, confidence: "medium" };
  }

  // 新增: 多图支持
  // og:image 可能有多个（og:image, og:image:1 等）
  // 但标准 OG 解析器已将多个值合并，这里处理逗号分隔情况
  if (og.image && !fields.images) {
    fields.images = { value: [og.image], confidence: "low" };
  }

  // 新增: 补充 meta 标签（非严格 OG 但常见）
  // 这些在 cheerio-scraper 中一并提取
  return fields;
}
```

### 3.3 扩展 `cheerio-scraper.ts` 提取更多 meta 标签

```typescript
// 新增: 提取 Twitter Card 和其他 meta 标签
function extractMetaTags($: cheerio.CheerioAPI): Record<string, string> {
  const meta: Record<string, string> = {};

  // Twitter Card
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr("name")?.replace("twitter:", "") ?? "";
    const content = $(el).attr("content") ?? "";
    if (name && content) meta[`twitter_${name}`] = content;
  });

  // 标准 meta（description, keywords, author）
  $('meta[name="description"]').each((_, el) => {
    meta.meta_description = $(el).attr("content") ?? "";
  });
  $('meta[name="author"]').each((_, el) => {
    meta.meta_author = $(el).attr("content") ?? "";
  });

  // Geo meta
  $('meta[name="geo.placename"]').each((_, el) => {
    meta.geo_placename = $(el).attr("content") ?? "";
  });
  $('meta[name="geo.position"]').each((_, el) => {
    meta.geo_position = $(el).attr("content") ?? "";
  });

  return meta;
}
```

### 3.4 影响范围

- 修改 `worker/src/extractors/og-mapper.ts`
- 修改 `worker/src/crawl/cheerio-scraper.ts` — 新增 meta 标签提取
- `ScrapedContent` 类型新增 `metaTags` 字段
- 无数据库变更

---

## 4. 扩展 JSON-LD Mapper（修复 R3）

### 4.1 问题

当前 18 条映射规则不覆盖常见的 Schema.org 变体。实际公寓网站的 JSON-LD 多样性远超预期。

### 4.2 方案：扩展到 35+ 条规则

```typescript
// 新增规则（追加到 MAPPING_RULES）
const ADDITIONAL_RULES: MappingRule[] = [
  // --- 地址变体 ---
  {
    jsonLdPath: "location.address.streetAddress",
    fieldKey: "building_address",
    confidence: "high",
  },
  {
    jsonLdPath: "location.address.addressLocality",
    fieldKey: "city",
    confidence: "high",
  },
  {
    jsonLdPath: "location.address.addressCountry",
    fieldKey: "country",
    confidence: "high",
  },
  {
    jsonLdPath: "location.address.postalCode",
    fieldKey: "postal_code",
    confidence: "high",
  },
  // 扁平地址
  {
    jsonLdPath: "streetAddress",
    fieldKey: "building_address",
    confidence: "medium",
  },
  { jsonLdPath: "addressLocality", fieldKey: "city", confidence: "medium" },
  { jsonLdPath: "addressCountry", fieldKey: "country", confidence: "medium" },

  // --- 价格变体 ---
  {
    jsonLdPath: "offers.price",
    fieldKey: "price_min",
    confidence: "high",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "offers.0.price",
    fieldKey: "price_min",
    confidence: "high",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "offers.0.lowPrice",
    fieldKey: "price_min",
    confidence: "high",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "offers.0.highPrice",
    fieldKey: "price_max",
    confidence: "high",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "offers.0.priceCurrency",
    fieldKey: "currency",
    confidence: "high",
  },

  // --- 联系变体 ---
  {
    jsonLdPath: "contactPoint.0.telephone",
    fieldKey: "primary_contact_phone",
    confidence: "high",
  },
  {
    jsonLdPath: "contactPoint.0.email",
    fieldKey: "primary_contact_email",
    confidence: "high",
  },
  {
    jsonLdPath: "sameAs",
    fieldKey: "application_link",
    confidence: "low",
    transform: extractFirstUrl,
  },

  // --- 楼盘详情 ---
  {
    jsonLdPath: "numberOfRooms",
    fieldKey: "total_units",
    confidence: "medium",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "numberOfBedrooms",
    fieldKey: "total_units",
    confidence: "low",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "floorLevel",
    fieldKey: "number_of_floors",
    confidence: "medium",
    transform: parseNumeric,
  },
  {
    jsonLdPath: "petsAllowed",
    fieldKey: "key_amenities",
    confidence: "medium",
    transform: petToAmenity,
  },
  {
    jsonLdPath: "yearBuilt",
    fieldKey: "year_built",
    confidence: "high",
    transform: parseNumeric,
  },

  // --- 图片变体 ---
  {
    jsonLdPath: "photos",
    fieldKey: "images",
    confidence: "high",
    transform: extractImageArray,
  },
  { jsonLdPath: "image.url", fieldKey: "cover_image", confidence: "high" },
  { jsonLdPath: "logo", fieldKey: "cover_image", confidence: "low" },
];
```

### 4.3 支持嵌套数组路径

当前 `getByPath` 不支持数组索引（如 `offers.0.price`）。需要扩展：

```typescript
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const idx = parseInt(part, 10);
      current = isNaN(idx) ? undefined : current[idx];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}
```

### 4.4 新增 @type 覆盖

```typescript
const PROPERTY_TYPES = [
  // 已有
  "ApartmentComplex",
  "Apartment",
  "Residence",
  "LodgingBusiness",
  "RealEstateListing",
  "Place",
  "LocalBusiness",
  "Organization",
  "Product",
  // 新增
  "Hotel",
  "House",
  "SingleFamilyResidence",
  "CivicStructure",
  "Accommodation",
  "Suite",
  "HotelRoom",
  "Room",
  "RealEstateAgent",
  "PropertyValue",
  "WebSite",
  "WebPage", // 常见的包裹类型，内含物业信息
];
```

### 4.5 影响范围

- 修改 `worker/src/extractors/structured-data-mapper.ts`
- 无数据库变更

---

## 5. 优化内容捕获（修复 R4 + R6）

### 5.1 问题 R4：Markdown 转换移除联系信息

`html-to-markdown.ts:12` 和 `cheerio-scraper.ts:52-53` 都将 `nav, footer, header` 完全移除。但这些区域通常包含电话、邮箱、地址等关键信息。

### 5.2 方案：分离 bodyText 和 contactText

不移除 header/footer 的全部内容，而是**分别提取**：

```typescript
// cheerio-scraper.ts 修改
function extractContent($: cheerio.CheerioAPI): {
  bodyText: string;
  contactText: string;
} {
  // 主体内容（移除噪音）
  const bodyClone = $("body").clone();
  bodyClone.find("script, style, noscript, iframe").remove();
  const bodyText = bodyClone.text().replace(/\s+/g, " ").trim();

  // 联系信息专区（从 header/footer/contact 区域提取）
  const contactParts: string[] = [];
  $(
    'header, footer, .contact, .contact-info, [id*="contact"], [class*="contact"]',
  ).each((_, el) => {
    contactParts.push($(el).text().replace(/\s+/g, " ").trim());
  });
  const contactText = contactParts.join("\n");

  return { bodyText, contactText };
}
```

### 5.3 问题 R6：智能截断

当前 60K 字符从头截断。关键信息（价格/设施）可能在页面中部或底部。

```typescript
// llm-extractor.ts 修改
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // 策略: 保留头部 40% + 尾部 30% + 中间关键段落 30%
  const headSize = Math.floor(maxLength * 0.4);
  const tailSize = Math.floor(maxLength * 0.3);
  const midBudget = maxLength - headSize - tailSize;

  const head = text.slice(0, headSize);
  const tail = text.slice(-tailSize);

  // 从中间部分提取含关键词的段落
  const middle = text.slice(headSize, -tailSize);
  const paragraphs = middle.split(/\n{2,}/);

  const PRIORITY_KEYWORDS =
    /price|rent|cost|amenit|feature|contact|phone|email|address|floor.?plan|unit|bedroom|apply/i;

  const prioritized = paragraphs
    .filter((p) => PRIORITY_KEYWORDS.test(p))
    .join("\n\n")
    .slice(0, midBudget);

  return `${head}\n\n[... content condensed ...]\n\n${prioritized}\n\n[... content condensed ...]\n\n${tail}`;
}
```

### 5.4 contactText 注入 LLM prompt

```typescript
// website-fields.ts — buildWebsiteUserPrompt 修改
export function buildWebsiteUserPrompt(
  title: string,
  bodyText: string,
  imageUrls: string[],
  jsonLd: Record<string, unknown>[],
  existingFields?: ExtractedFields,
  contactText?: string, // 新增参数
): string {
  const parts = [`Page title: ${title}`, `\nPage content:\n${bodyText}`];

  if (contactText) {
    parts.push(`\nContact information found in header/footer:\n${contactText}`);
  }
  // ...rest unchanged
}
```

### 5.5 影响范围

- 修改 `worker/src/crawl/cheerio-scraper.ts` — 分离 bodyText/contactText
- 修改 `worker/src/crawl/html-to-markdown.ts` — simpleHtmlToMarkdown 保留联系区域
- 修改 `worker/src/extractors/llm-extractor.ts` — smartTruncate
- 修改 `worker/src/llm/prompts/website-fields.ts` — contactText 参数
- `ScrapedContent` 类型新增 `contactText` 字段

---

## 6. LLM Prompt 分层优化（修复 R5）

### 6.1 问题

当前 prompt 平等列出 35+ 字段，LLM 无法区分优先级。大量 token 浪费在提取不存在的 Tier C 字段上。

### 6.2 方案：分层 prompt + 动态字段列表

```typescript
// website-fields.ts 重构

export const WEBSITE_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured property information from rental property websites.

Extract ONLY information explicitly present on the page. Do NOT guess or infer.
Output a valid JSON object using the exact field keys listed below.

## PRIORITY 1 — Must Extract (if available on page):
- "building_name": Property/building name
- "building_address": Full street address
- "city": City name
- "country": Country name
- "postal_code": Postal/ZIP code
- "price_min": Minimum rental price (number, no currency symbol)
- "price_max": Maximum rental price (number, no currency symbol)
- "currency": Currency code (USD, CAD, GBP, EUR, AUD)
- "primary_contact_email": Contact email
- "primary_contact_phone": Contact phone
- "cover_image": Main/hero image URL
- "key_amenities": Array of amenity tags from: ["Gym", "Pool", "Laundry", "Parking", "Study Room", "Rooftop", "Pet Friendly", "Furnished", "WiFi", "Security", "Bike Storage", "Game Room"]

## PRIORITY 2 — Extract if found:
- "description": Property description (brief summary)
- "total_units": Total units/bedspaces (number)
- "images": Array of gallery image URLs (up to 10)
- "unit_types_summary": Summary of unit types (e.g., "Studio, 1BR, 2BR, 3BR")
- "application_link": Application/booking URL
- "application_method": Array from: ["Online", "Offline", "Both"]
- "lease_type": "Individual", "Joint", or "Both"
- "rental_method": "Per Unit", "Per Bedroom", or "Both"
- "utilities_included": What utilities are included
- "furnished_options": Furnished options description

## PRIORITY 3 — Extract only if clearly stated:
- "number_of_floors": Number of floors (number)
- "year_built": Year built (number)
- "elevator_available": Has elevator (true/false)
- "shuttle_service": Has shuttle service (true/false)
- "in_unit_washer_dryer": Has in-unit washer/dryer (true/false)
- "ac_heating_type": "Central thermostat", "Individual bedroom control", or "Other"
- "bed_included": "Yes - Twin", "Yes - Full", "Yes - Queen", "Yes - Other", or "No"
- "floor_plans": Floor plan descriptions
- "primary_contact_name": Contact name
- "leasing_manager_name": Leasing/property manager name

## Rules:
1. Return ONLY a valid JSON object — no explanations, no markdown
2. Focus effort on PRIORITY 1 fields first
3. For number fields, return numbers without currency symbols or commas
4. For images, return full absolute URLs
5. For key_amenities, ONLY use tags from the allowed list
6. If a field is not found, do NOT include it`;
```

### 6.3 动态排除已提取字段

已有的 `existingFields` 注入逻辑保留不变，但增加明确提示：

```typescript
// 在 buildWebsiteUserPrompt 中，已提取字段的提示改为:
parts.push(
  `\nALREADY EXTRACTED (skip these, focus on missing PRIORITY 1 & 2 fields):`,
  JSON.stringify(alreadyExtracted, null, 2),
);
```

### 6.4 影响范围

- 修改 `worker/src/llm/prompts/website-fields.ts`
- 无其他文件变更

---

## 7. 覆盖率指标修正（修复 R7）

### 7.1 问题

`website-crawl.ts:176-179` 的 `fieldCoverageRatio` 仅统计 JSON-LD 覆盖率，meta 中报告的覆盖率与实际提取结果不符。

### 7.2 方案：基于最终字段数计算真实覆盖率

```typescript
// website-crawl.ts — 修改 return 之前的覆盖率计算

// Tier A 必填字段列表
const TIER_A_KEYS = [
  "building_name",
  "building_address",
  "city",
  "country",
  "postal_code",
  "primary_contact_name",
  "primary_contact_email",
  "commission_structure",
  "currency",
];

const TIER_B_KEYS = [
  "price_min",
  "price_max",
  "cover_image",
  "key_amenities",
  "unit_types_summary",
  "description",
  "total_units",
  "images",
  "application_link",
  "application_method",
];

const tierACovered = TIER_A_KEYS.filter((k) => k in validatedFields).length;
const tierBCovered = TIER_B_KEYS.filter((k) => k in validatedFields).length;
const totalFieldCount = Object.keys(validatedFields).length;

return {
  fields: validatedFields,
  meta: {
    // ...existing fields
    fieldCoverageRatio:
      totalFieldCount / (TIER_A_KEYS.length + TIER_B_KEYS.length),
    tierACoverageRatio: tierACovered / TIER_A_KEYS.length,
    tierBCoverageRatio: tierBCovered / TIER_B_KEYS.length,
    totalFieldCount,
  },
};
```

### 7.3 影响范围

- 修改 `worker/src/extractors/website-crawl.ts`
- 修改 `worker/src/types.ts` — meta 类型新增字段
- 无数据库变更（`extraction_logs.meta` 是 JSONB，自动兼容新字段）

---

## 8. 子页面 LLM 策略优化（修复 R9）

### 8.1 问题

`website-crawl.ts:316` 对每个 >100 字符的子页面无条件调用 LLM，导致：

- 3-6 个子页面 × 每次 14-24s LLM 调用 = 额外 42-144s
- Token 浪费（如果子页面内容和首页重复）

### 8.2 方案：按子页面标签决定是否需要 LLM

```typescript
// website-crawl.ts — crawlSubPages 优化

// 高价值子页面（值得 LLM 提取）
const LLM_WORTHY_LABELS: Set<PageLabel> = new Set([
  "pricing",
  "amenities",
  "floor-plans",
]);

// 低价值子页面（结构化提取即可，不需 LLM）
const STRUCTURED_ONLY_LABELS: Set<PageLabel> = new Set([
  "contact",
  "gallery",
  "apply",
]);

for (const subPage of subPages) {
  // ...scrape sub-page...

  const subFields = extractLayered(subScraped);

  // 仅对高价值子页面调用 LLM
  if (
    LLM_WORTHY_LABELS.has(subPage.label) &&
    subScraped.bodyText.trim().length > 200
  ) {
    const llmFields = await extractWithLlm(subScraped, subFields, signal);
    mergeFieldsInto(subFields, llmFields);
  }

  results.push(subFields);
}
```

### 8.3 影响范围

- 修改 `worker/src/extractors/website-crawl.ts` — `crawlSubPages` 函数
- 预期效果：减少 50%+ 的子页面 LLM 调用，总提取时间缩短 30-60s

---

## 9. Benchmark 扩展

### 9.1 问题

当前仅 8 个测试站点，不足以代表全球公寓市场的多样性。

### 9.2 方案：扩展到 30+ 站点

按市场和技术类型分类，确保每类至少 3 个代表：

| 市场   | 站点类型                  | 数量 |
| ------ | ------------------------- | ---- |
| US     | React SPA                 | 3    |
| US     | WordPress                 | 2    |
| US     | Entrata/RentCafe 平台模板 | 3    |
| UK     | Static                    | 3    |
| UK     | WordPress                 | 2    |
| AU     | Static/SPA                | 2    |
| CA     | WordPress/Wix             | 2    |
| EU     | Vue/Next.js               | 2    |
| Global | Cloudflare Protected      | 3    |

### 9.3 新增 Benchmark 指标

```typescript
// verify-pipeline.ts 新增验证维度
interface BenchmarkResult {
  // 已有
  siteId: string;
  strategy: string;
  totalFields: number;
  timings: { probe: number; scrape: number; llm: number; total: number };

  // 新增
  tierAFields: number; // Tier A 字段命中数
  tierATotal: number; // Tier A 字段总数
  tierBFields: number;
  tierBTotal: number;
  extractionSources: {
    // 每个字段的提取来源
    jsonLd: number;
    og: number;
    css: number; // 新增 CSS 层
    llm: number;
  };
  qualityScore: number; // 综合质量分 = tierA*0.6 + tierB*0.4
}
```

### 9.4 影响范围

- 修改 `worker/tests/benchmarks/fixtures/sample-sites.json` — 扩充站点
- 修改 `worker/tests/benchmarks/verify-pipeline.ts` — 新增指标
- 修改 `worker/tests/benchmarks/metrics.ts` — 新增聚合计算

---

## 10. 实施计划

### 10.1 优先级排序（按 ROI）

| 顺序 | 改动                                 | 预期效果                            | 复杂度 |
| ---- | ------------------------------------ | ----------------------------------- | ------ |
| P1   | §1 扩展链接发现 + §8 子页面 LLM 优化 | 子页面发现率 ↑ 300%，LLM 调用 ↓ 50% | 低     |
| P2   | §6 LLM Prompt 分层                   | Tier A 提取率 ↑ 30%+                | 低     |
| P3   | §2 CSS 选择器提取层                  | 无 JSON-LD 站点提取率从 0 → 5+ 字段 | 中     |
| P4   | §3 扩展 OG Mapper + §4 扩展 JSON-LD  | 结构化提取覆盖率 ↑ 50%              | 中     |
| P5   | §5 内容捕获优化                      | 联系方式/价格提取率 ↑               | 中     |
| P6   | §7 覆盖率指标修正                    | 遥测准确性                          | 低     |
| P7   | §9 Benchmark 扩展                    | 验证全部改进效果                    | 低     |

### 10.2 PR 规划

| PR   | 内容                                         | 依赖   |
| ---- | -------------------------------------------- | ------ |
| PR-1 | §1 链接发现 + §8 子页面优化                  | 无     |
| PR-2 | §6 Prompt 分层 + §5 内容捕获                 | 无     |
| PR-3 | §2 CSS 提取层 + §3 OG 扩展 + §4 JSON-LD 扩展 | 无     |
| PR-4 | §7 覆盖率修正 + §9 Benchmark 扩展 + 全量验证 | PR-1~3 |

### 10.3 风险评估

| 风险                            | 概率 | 影响             | 缓解                               |
| ------------------------------- | ---- | ---------------- | ---------------------------------- |
| CSS 选择器在不同站点 DOM 差异大 | 高   | 提取率波动       | 通用选择器 + 平台专用规则双轨      |
| 扩展链接发现引入噪音链接        | 中   | 子页面爬取量增加 | 关键词过滤 + MAX_SUB_PAGES 限制    |
| Prompt 变更导致已有站点回归     | 中   | 部分字段丢失     | Benchmark 全量对比 before/after    |
| 内容截断策略关键词匹配不准      | 低   | 重要段落被截断   | 保守策略：40% 头 + 30% 中 + 30% 尾 |

---

## 11. 测试计划

### 11.1 Unit Tests

| 模块                          | 测试文件                              | 用例数                            |
| ----------------------------- | ------------------------------------- | --------------------------------- |
| css-extractor                 | `css-extractor.test.ts`               | ~15（通用规则 + 平台规则 + 边界） |
| og-mapper (扩展)              | 更新 `og-mapper.test.ts`              | +8（新字段映射）                  |
| structured-data-mapper (扩展) | 更新 `structured-data-mapper.test.ts` | +12（新规则 + 数组路径）          |
| multi-page (链接发现)         | 更新 `multi-page.test.ts`             | +6（非 nav 链接发现）             |
| smart-truncate                | `llm-extractor.test.ts`               | +4（截断策略）                    |

### 11.2 Integration Tests

| 场景             | 描述                                                   |
| ---------------- | ------------------------------------------------------ |
| 静态站无 JSON-LD | CSS + OG + LLM 三层提取，验证 ≥ 8 字段                 |
| SPA 站有 JSON-LD | JSON-LD 覆盖 80%+ 后跳过 LLM                           |
| Entrata 平台模板 | 平台专用 CSS 规则命中                                  |
| 多子页面站点     | pricing + amenities 子页面 LLM，contact 子页面仅结构化 |

### 11.3 Benchmark 回归

所有改动完成后，在 30+ 站点上运行全量 Benchmark，对比 before/after 的：

- Tier A/B 覆盖率
- 平均字段数
- 0 字段站点比例
- 总提取时间

---

## 12. 国际化覆盖

| 市场 | 特殊处理                                         |
| ---- | ------------------------------------------------ |
| US   | USD 价格格式 `$1,200`，Entrata/RentCafe 平台规则 |
| UK   | GBP 周租 `£150/week`，需转换为月租提示           |
| AU   | AUD 周租，Campus Living Villages 等大型站点      |
| CA   | CAD + 法语页面（Quebec），双语内容提取           |
| EU   | 多币种（EUR/GBP），多语言 meta 标签              |

---

## 13. Sentry 监控

| 事件                           | 级别    | 描述                       |
| ------------------------------ | ------- | -------------------------- |
| `crawl.nav_discovery_empty`    | warning | 所有选择器均未发现导航链接 |
| `crawl.css_extraction_zero`    | info    | CSS 提取层未命中任何字段   |
| `crawl.smart_truncate_applied` | info    | 内容超过 60K 触发智能截断  |
| `crawl.subpage_llm_skipped`    | info    | 低价值子页面跳过 LLM       |
| `crawl.platform_rules_matched` | info    | 平台专用 CSS 规则命中      |
