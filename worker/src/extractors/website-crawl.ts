/** 网页爬取提取器 — 策略路由 + 多页面爬取 + 四层提取 + 校验 */

import { probeSite } from "../crawl/site-probe.js";
import type { SiteProfile } from "../crawl/site-probe.js";
import { scrapePage } from "../crawl/scraper.js";
import type { ScrapedContent } from "../crawl/scraper.js";
import { scrapeWithCheerio } from "../crawl/cheerio-scraper.js";
import { extractWithLlm } from "./llm-extractor.js";
import { extractWithCss } from "./css-extractor.js";
import { mapStructuredData } from "./structured-data-mapper.js";
import { mapOpenGraphData } from "./og-mapper.js";
import { crawlSubPages } from "./sub-page-crawl.js";
import type { SubPageResult } from "./sub-page-crawl.js";
import { validateFields } from "../validators/field-validator.js";
import { validateWithLlm } from "../validators/llm-validator.js";
import { mergeFieldsInto, mergeByConfidence } from "./field-merge.js";
import { inferGeoFields } from "./geo-inferrer.js";
import { postprocessFields } from "./field-postprocessor.js";
import { buildResult } from "./result-builder.js";
import type { ExtractionResult } from "./index.js";
import type { ExtractedFields, DomainHints } from "../types.js";
import type {
  SiteType,
  SiteFramework,
  CloudflareLevel,
} from "../crawl/site-probe.js";

const SKIP_LLM_COVERAGE = 0.8;
const HINTS_MIN_CRAWLS = 2;

export async function extractFromWebsite(
  sourceUrl: string,
  signal: AbortSignal,
  domainHints?: DomainHints,
): Promise<ExtractionResult> {
  const timings = { probe: 0, scrape: 0, llm: 0 };
  const totalStart = Date.now();

  // 1. 快速预检
  const { siteProfile, usedHints } = await probeOrHint(
    sourceUrl,
    signal,
    domainHints,
    timings,
  );

  // 2. 策略路由
  const strategy = usedHints
    ? (domainHints!.strategyUsed as CrawlStrategy)
    : selectStrategy(siteProfile);
  if (strategy === "skip") {
    throw new Error(
      `Site protected by Cloudflare ${siteProfile.cloudflareLevel}`,
    );
  }

  // 3. 首页爬取
  const scrapeStart = Date.now();
  const scraped = await scrapeHomepage(
    sourceUrl,
    strategy,
    siteProfile,
    signal,
  );
  timings.scrape = Date.now() - scrapeStart;

  if (!scraped.bodyText.trim() && scraped.jsonLd.length === 0) {
    throw new Error("Website contains no extractable content");
  }

  // 4. 子页面爬取（返回结构化字段 + markdown 内容）
  const subPageResults = await crawlSubPages(
    sourceUrl,
    scraped.navLinks,
    siteProfile,
    signal,
    strategy,
  );

  // 5. 分层提取（首页: JSON-LD → OG → API → CSS）
  const mergedFields = extractLayered(scraped, siteProfile);

  // 5a. 合并 API 拦截字段（高置信度）
  if (scraped.apiFields && Object.keys(scraped.apiFields).length > 0) {
    mergeByConfidence(mergedFields, scraped.apiFields);
  }

  // 5b. 合并子页面结构化字段（JSON-LD/OG/CSS）
  for (const sub of subPageResults) {
    mergeByConfidence(mergedFields, sub.fields);
  }

  // 5c. 从 URL/city 推断 country/currency
  mergeFieldsInto(mergedFields, inferGeoFields(mergedFields, sourceUrl));

  // 6. LLM 提取 — 聚合首页 + 子页面内容，单次调用
  const llmSkipped = hasHighCoverage(mergedFields);
  let llmProvider: string | null = null;
  if (!llmSkipped) {
    const llmStart = Date.now();
    const aggregatedScraped = aggregateContent(scraped, subPageResults);
    const llmFields = await extractWithLlm(
      aggregatedScraped,
      mergedFields,
      signal,
    );
    timings.llm = Date.now() - llmStart;
    mergeFieldsInto(mergedFields, llmFields);
    llmProvider = "auto";
  }

  // 7. 后处理：清洗字段数据
  postprocessFields(mergedFields, sourceUrl);

  // 8. 校验 + LLM 交叉验证
  const validated = validateFields(mergedFields);
  logIssues(validated.issues, sourceUrl);
  const {
    fields: finalFields,
    quality,
    adjustments,
    removals,
  } = await tryLlmValidation(validated.fields, scraped, signal);

  // 9. 构建元数据
  return buildResult({
    fields: finalFields,
    sourceUrl,
    profile: siteProfile,
    strategy,
    llmSkipped,
    llmProvider,
    validationIssues: validated.issues.length,
    llmValQuality: quality,
    llmValAdj: adjustments,
    llmValRem: removals,
    timings,
    totalStart,
  });
}

// ── 内部辅助 ──

type CrawlStrategy = "lightweight" | "standard" | "stealth" | "skip";

async function probeOrHint(
  url: string,
  signal: AbortSignal,
  hints: DomainHints | undefined,
  timings: { probe: number },
): Promise<{ siteProfile: SiteProfile; usedHints: boolean }> {
  if (hints && hints.crawlCount >= HINTS_MIN_CRAWLS) {
    return { siteProfile: buildProfileFromHints(hints), usedHints: true };
  }
  const start = Date.now();
  const profile = await probeSite(url, signal);
  timings.probe = Date.now() - start;
  return { siteProfile: profile, usedHints: false };
}

function buildProfileFromHints(hints: DomainHints): SiteProfile {
  return {
    type: (hints.siteType || "unknown") as SiteType,
    framework: (hints.siteFramework || "unknown") as SiteFramework,
    cloudflareLevel: (hints.cloudflareLevel || "none") as CloudflareLevel,
    cloudflareProtected: hints.cloudflareLevel !== "none",
    hasJsonLd: false,
    hasOpenGraph: false,
    estimatedComplexity: "moderate",
    httpStatus: 200,
    redirectUrl: null,
    contentType: "text/html",
  };
}

function selectStrategy(profile: SiteProfile): CrawlStrategy {
  if (
    profile.cloudflareLevel === "enterprise" ||
    profile.cloudflareLevel === "business"
  )
    return "skip";
  if (profile.cloudflareProtected) return "stealth";
  if (profile.type === "static") return "lightweight";
  return "standard";
}

async function scrapeHomepage(
  url: string,
  strategy: CrawlStrategy,
  profile: SiteProfile,
  signal: AbortSignal,
): Promise<ScrapedContent> {
  if (strategy === "lightweight") {
    return scrapeWithCheerio(url, signal);
  }

  try {
    return await scrapePage(url, {
      siteProfile: profile,
      signal,
      useStealth: strategy === "stealth",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const isTimeout = msg.includes("Timeout") || msg.includes("timeout");

    if (!isTimeout) throw err;

    // 超时重试：standard → stealth fallback，stealth → 原策略重试
    const retryAsStealth = strategy === "standard";
    console.error(
      `[website-crawl] ${strategy} timeout for ${url}, retrying${retryAsStealth ? " with stealth" : ""}...`,
    );

    return scrapePage(url, {
      siteProfile: profile,
      signal,
      useStealth: retryAsStealth || strategy === "stealth",
    });
  }
}

function extractLayered(
  scraped: ScrapedContent,
  profile?: SiteProfile,
): ExtractedFields {
  let fields: ExtractedFields = {};
  if (scraped.jsonLd.length > 0) {
    fields = { ...mapStructuredData(scraped.jsonLd).fields };
  }
  mergeFieldsInto(fields, mapOpenGraphData(scraped.openGraph));
  // CSS 选择器提取（优先用原始 HTML 以保留 itemprop/href 属性）
  const htmlSource = scraped.rawHtml || scraped.markdown || scraped.bodyText;
  if (htmlSource) {
    mergeFieldsInto(
      fields,
      extractWithCss(htmlSource, profile?.detectedPlatform),
    );
  }
  return fields;
}

/** Tier A+B 字段总数 ≈ 32。仅当已提取字段数足够多时才跳过 LLM。 */
const TIER_AB_FIELD_COUNT = 32;

function hasHighCoverage(mergedFields: ExtractedFields): boolean {
  const fieldCount = Object.keys(mergedFields).length;
  return fieldCount >= TIER_AB_FIELD_COUNT * SKIP_LLM_COVERAGE;
}

async function tryLlmValidation(
  fields: ExtractedFields,
  scraped: ScrapedContent,
  signal: AbortSignal,
) {
  let quality: "high" | "medium" | "low" | "skipped" = "skipped";
  let adjustments = 0;
  let removals = 0;
  const result = { ...fields };
  try {
    const text = scraped.markdown || scraped.bodyText;
    const v = await validateWithLlm(result, scraped.title, text, signal);
    quality = v.overallQuality;
    adjustments = v.adjustments;
    removals = v.removals;
    Object.assign(result, v.fields);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    console.error(
      "[website-crawl] LLM validation failed:",
      (err as Error).message,
    );
  }
  return { fields: result, quality, adjustments, removals };
}

/**
 * 聚合首页 + 子页面内容供 LLM 提取。
 * 首页占 50% token 预算，子页面按优先级分剩余 50%。
 */
function aggregateContent(
  homepage: ScrapedContent,
  subPages: SubPageResult[],
): {
  title: string;
  bodyText: string;
  markdown: string;
  imageUrls: string[];
  jsonLd: Record<string, unknown>[];
  contactText?: string;
} {
  if (subPages.length === 0) return homepage;

  const homeMd = homepage.markdown || homepage.bodyText;
  const parts: string[] = [`## [Homepage]\n\n${homeMd}`];

  const LABEL_HEADER: Record<string, string> = {
    pricing: "Pricing & Rates Page",
    amenities: "Amenities & Features Page",
    "floor-plans": "Floor Plans & Unit Types Page",
    gallery: "Photo Gallery Page",
    contact: "Contact Information Page",
    apply: "Application / Booking Page",
  };

  for (const sub of subPages) {
    if (sub.markdown.trim().length > 100) {
      const header = LABEL_HEADER[sub.label] ?? `${sub.label} page`;
      parts.push(`\n\n## [${header}]\n\n${sub.markdown}`);
    }
  }

  // 聚合首页 + 子页面的 contactText
  const contactParts: string[] = [];
  if (homepage.contactText) contactParts.push(homepage.contactText);
  for (const sub of subPages) {
    if (sub.contactText && !contactParts.includes(sub.contactText)) {
      contactParts.push(sub.contactText);
    }
  }

  return {
    title: homepage.title,
    bodyText: homepage.bodyText,
    markdown: parts.join(""),
    imageUrls: homepage.imageUrls,
    jsonLd: homepage.jsonLd,
    contactText: contactParts.join("\n") || undefined,
  };
}

function logIssues(
  issues: Array<{ fieldKey: string; issue: string; action: string }>,
  url: string,
): void {
  if (issues.length > 0) {
    console.error(
      `[website-crawl] ${issues.length} validation issues for ${url}:`,
      issues.map((i) => `${i.fieldKey}: ${i.issue}`).join("; "),
    );
  }
}
