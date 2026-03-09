/**
 * 网页爬取提取器 — 策略路由 + 多页面爬取 + 分层提取
 *
 * 流程:
 *  1. 快速预检 → 生成 SiteProfile（含 Cloudflare 检测）
 *  2. 策略路由 → 按站点类型 + CF 级别选择爬取策略
 *  3. 首页爬取 → 提取文本/图片/JSON-LD/OG/导航链接
 *  4. 多页面发现 → 从导航链接中提取高价值子页面
 *  5. 子页面爬取 → 每个子页面独立提取
 *  6. 分层提取 + 多页面合并:
 *     a. JSON-LD 直接映射（跳过 LLM，速度快、置信度高）
 *     b. OpenGraph 补充
 *     c. LLM 提取仅针对缺失字段
 *  7. 提取后校验 → 修复/降级/移除不合理字段
 */

import { probeSite } from "../crawl/site-probe.js";
import type { SiteProfile } from "../crawl/site-probe.js";
import { scrapePage } from "../crawl/scraper.js";
import type { ScrapedContent } from "../crawl/scraper.js";
import { scrapeWithCheerio } from "../crawl/cheerio-scraper.js";
import { discoverSubPages } from "../crawl/multi-page.js";
import { extractWithLlm } from "./llm-extractor.js";
import { mapStructuredData } from "./structured-data-mapper.js";
import { mapOpenGraphData } from "./og-mapper.js";
import { validateFields } from "../validators/field-validator.js";
import { validateWithLlm } from "../validators/llm-validator.js";
import { mergeFieldsInto, mergeByConfidence } from "./field-merge.js";
import { captureError } from "../sentry.js";
import type { ExtractionResult } from "./index.js";
import type { ExtractedFields, DomainHints } from "../types.js";
import type {
  SiteType,
  SiteFramework,
  CloudflareLevel,
} from "../crawl/site-probe.js";

/** 跳过 LLM 的最低 JSON-LD 覆盖率阈值 */
const SKIP_LLM_COVERAGE = 0.8;

/** 子页面间请求间隔（ms） */
const SUB_PAGE_DELAY_MS = 2_000;

/** 域名经验可信度阈值 — 至少 2 次成功爬取才跳过 probe */
const HINTS_MIN_CRAWLS = 2;

export async function extractFromWebsite(
  sourceUrl: string,
  signal: AbortSignal,
  domainHints?: DomainHints,
): Promise<ExtractionResult> {
  const timings = { probe: 0, scrape: 0, llm: 0 };
  const totalStart = Date.now();

  // 1. 快速预检（有可信域名经验时跳过，直接复用历史 profile）
  let siteProfile: SiteProfile;
  let usedHints = false;

  if (domainHints && domainHints.crawlCount >= HINTS_MIN_CRAWLS) {
    console.error(
      `[website-crawl] Using domain hints (${domainHints.crawlCount} prior crawls, strategy=${domainHints.strategyUsed})`,
    );
    siteProfile = buildProfileFromHints(domainHints);
    usedHints = true;
  } else {
    const probeStart = Date.now();
    siteProfile = await probeSite(sourceUrl, signal);
    timings.probe = Date.now() - probeStart;
  }

  // 2. 策略路由 — 按站点类型 + CF 级别选择策略
  const strategy = usedHints
    ? (domainHints!.strategyUsed as CrawlStrategy)
    : selectStrategy(siteProfile);
  if (strategy === "skip") {
    throw new Error(
      `Site protected by Cloudflare ${siteProfile.cloudflareLevel}, requires manual/API partnership`,
    );
  }

  // 3. 首页爬取 — lightweight 用 cheerio，其余用 Playwright
  const scrapeStart = Date.now();
  let scraped: ScrapedContent;
  if (strategy === "lightweight") {
    console.error(
      `[website-crawl] Using cheerio lightweight extraction for ${sourceUrl}`,
    );
    scraped = await scrapeWithCheerio(sourceUrl, signal);
  } else {
    const useStealth = needsStealth(strategy);
    scraped = await scrapePage(sourceUrl, {
      siteProfile,
      signal,
      useStealth,
    });
  }
  timings.scrape = Date.now() - scrapeStart;

  if (!scraped.bodyText.trim() && scraped.jsonLd.length === 0) {
    throw new Error("Website contains no extractable content");
  }

  // 4. 多页面发现 + 子页面爬取
  const subPageFields = await crawlSubPages(
    sourceUrl,
    scraped.navLinks,
    siteProfile,
    signal,
    strategy,
  );

  // 5. 分层提取（首页）
  let mergedFields = extractLayered(scraped);

  // 6. LLM 提取（首页，如需要）
  const llmSkipped = hasHighCoverage(scraped);
  let llmProvider: string | null = null;
  if (!llmSkipped) {
    const llmStart = Date.now();
    const llmFields = await extractWithLlm(scraped, mergedFields, signal);
    timings.llm = Date.now() - llmStart;
    mergeFieldsInto(mergedFields, llmFields);
    llmProvider = "deepseek"; // TODO: extract actual provider from llm-extractor
  }

  // 7. 合并子页面字段（高置信度优先）
  for (const subFields of subPageFields) {
    mergeByConfidence(mergedFields, subFields);
  }

  // 8. 提取后校验（规则引擎）
  const validated = validateFields(mergedFields);
  logIssues(validated.issues, sourceUrl);

  // 8b. LLM 自校验 — 交叉验证提取结果的合理性
  let llmValidationQuality: "high" | "medium" | "low" | "skipped" = "skipped";
  let llmValidationAdjustments = 0;
  let llmValidationRemovals = 0;
  const validatedFields = validated.fields;

  try {
    const textForValidation = scraped.markdown || scraped.bodyText;
    const llmValidation = await validateWithLlm(
      validatedFields,
      scraped.title,
      textForValidation,
      signal,
    );
    llmValidationQuality = llmValidation.overallQuality;
    llmValidationAdjustments = llmValidation.adjustments;
    llmValidationRemovals = llmValidation.removals;
    // Use LLM-validated fields for final output
    Object.assign(validatedFields, llmValidation.fields);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    console.error(
      "[website-crawl] LLM validation failed (non-blocking):",
      (err as Error).message,
    );
  }

  // 9. 构建提取元数据 — 为自适应进化积累经验
  const confidenceDist = { high: 0, medium: 0, low: 0 };
  for (const field of Object.values(validatedFields)) {
    const c = field.confidence as keyof typeof confidenceDist;
    if (c in confidenceDist) confidenceDist[c]++;
  }

  let domain = "";
  try {
    domain = new URL(sourceUrl).hostname;
  } catch {
    domain = sourceUrl;
  }

  const coverageRatio = scraped.jsonLd.length > 0
    ? mapStructuredData(scraped.jsonLd).coverageRatio
    : 0;

  return {
    fields: validatedFields,
    meta: {
      sourceUrl,
      urlDomain: domain,
      siteType: siteProfile.type,
      siteFramework: siteProfile.framework,
      siteComplexity: siteProfile.estimatedComplexity,
      strategyUsed: strategy,
      hasJsonLd: siteProfile.hasJsonLd,
      hasOpenGraph: siteProfile.hasOpenGraph,
      cloudflareLevel: siteProfile.cloudflareLevel,
      llmSkipped,
      llmProvider,
      fieldCoverageRatio: coverageRatio,
      confidenceHigh: confidenceDist.high,
      confidenceMedium: confidenceDist.medium,
      confidenceLow: confidenceDist.low,
      validationIssues: validated.issues.length,
      llmValidationQuality,
      llmValidationAdjustments,
      llmValidationRemovals,
      probeDurationMs: timings.probe,
      scrapeDurationMs: timings.scrape,
      llmDurationMs: timings.llm,
      totalDurationMs: Date.now() - totalStart,
    },
  };
}

type CrawlStrategy = "lightweight" | "standard" | "stealth" | "skip";

/** 从域名经验提示构建 SiteProfile（跳过实际 probe） */
function buildProfileFromHints(hints: DomainHints): SiteProfile {
  return {
    type: (hints.siteType || "unknown") as SiteType,
    framework: (hints.siteFramework || "unknown") as SiteFramework,
    cloudflareLevel: (hints.cloudflareLevel || "none") as CloudflareLevel,
    cloudflareProtected: hints.cloudflareLevel !== "none",
    hasJsonLd: false, // Conservative — will be determined during scrape
    hasOpenGraph: false,
    estimatedComplexity: "moderate",
    httpStatus: 200,
    redirectUrl: null,
    contentType: "text/html",
  };
}

/** 策略路由 — 按站点类型 + Cloudflare 级别分流 */
function selectStrategy(profile: SiteProfile): CrawlStrategy {
  if (
    profile.cloudflareLevel === "enterprise" ||
    profile.cloudflareLevel === "business"
  ) {
    return "skip";
  }
  if (profile.cloudflareProtected) {
    return "stealth";
  }
  // 静态站点无 CF 保护 → cheerio 轻量提取
  if (profile.type === "static") {
    return "lightweight";
  }
  return "standard";
}

/** 是否需要 stealth 模式 */
function needsStealth(strategy: CrawlStrategy): boolean {
  return strategy === "stealth";
}

/** 分层提取（JSON-LD + OpenGraph），不含 LLM */
function extractLayered(scraped: ScrapedContent): ExtractedFields {
  let fields: ExtractedFields = {};

  // JSON-LD 直接映射
  if (scraped.jsonLd.length > 0) {
    const structuredResult = mapStructuredData(scraped.jsonLd);
    fields = { ...fields, ...structuredResult.fields };
  }

  // OpenGraph 补充（不覆盖已有字段）
  const ogFields = mapOpenGraphData(scraped.openGraph);
  mergeFieldsInto(fields, ogFields);

  return fields;
}

/** 检查 JSON-LD 覆盖率是否足够高（可跳过 LLM） */
function hasHighCoverage(scraped: ScrapedContent): boolean {
  if (scraped.jsonLd.length === 0) return false;
  const structuredResult = mapStructuredData(scraped.jsonLd);
  return structuredResult.coverageRatio >= SKIP_LLM_COVERAGE;
}

/** 爬取子页面并提取字段 */
async function crawlSubPages(
  baseUrl: string,
  navLinks: Array<{ href: string; text: string }>,
  siteProfile: SiteProfile,
  signal: AbortSignal,
  strategy: CrawlStrategy,
): Promise<ExtractedFields[]> {
  const subPages = discoverSubPages(baseUrl, navLinks);
  if (subPages.length === 0) return [];

  console.error(
    `[website-crawl] Discovered ${subPages.length} sub-pages: ${subPages.map((p) => p.label).join(", ")}`,
  );

  const results: ExtractedFields[] = [];

  for (const subPage of subPages) {
    if (signal.aborted) break;

    try {
      // Rate limiting: 延迟 2s
      await new Promise((r) => setTimeout(r, SUB_PAGE_DELAY_MS));

      let subScraped: ScrapedContent;
      if (strategy === "lightweight") {
        subScraped = await scrapeWithCheerio(subPage.url, signal);
      } else {
        const useStealth = needsStealth(strategy);
        subScraped = await scrapePage(subPage.url, {
          siteProfile,
          signal,
          useStealth,
        });
      }

      // 子页面分层提取
      const subFields = extractLayered(subScraped);

      // 子页面 LLM 提取（如有内容）
      if (subScraped.bodyText.trim().length > 100) {
        const llmFields = await extractWithLlm(subScraped, subFields, signal);
        mergeFieldsInto(subFields, llmFields);
      }

      results.push(subFields);
    } catch (err) {
      captureError(err, { subPageUrl: subPage.url, label: subPage.label });
      console.error(
        `[website-crawl] Sub-page ${subPage.label} failed:`,
        (err as Error).message,
      );
    }
  }

  return results;
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
