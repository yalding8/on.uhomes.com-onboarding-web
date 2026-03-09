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
import { discoverSubPages } from "../crawl/multi-page.js";
import { chatCompletion } from "../llm/client.js";
import { getAllProviders } from "../llm/config.js";
import { mapLlmOutput } from "../llm/field-mapper.js";
import {
  WEBSITE_EXTRACTION_SYSTEM_PROMPT,
  buildWebsiteUserPrompt,
} from "../llm/prompts/website-fields.js";
import { mapStructuredData } from "./structured-data-mapper.js";
import { mapOpenGraphData } from "./og-mapper.js";
import { validateFields } from "../validators/field-validator.js";
import { captureError } from "../sentry.js";
import type { ExtractionResult } from "./index.js";
import type { ExtractedFields, ExtractionFieldValue } from "../types.js";

const MAX_TEXT_LENGTH = 60_000;

/** 跳过 LLM 的最低 JSON-LD 覆盖率阈值 */
const SKIP_LLM_COVERAGE = 0.8;

/** 子页面间请求间隔（ms） */
const SUB_PAGE_DELAY_MS = 2_000;

export async function extractFromWebsite(
  sourceUrl: string,
  signal: AbortSignal,
): Promise<ExtractionResult> {
  // 1. 快速预检
  const siteProfile = await probeSite(sourceUrl, signal);

  // 2. 策略路由 — 根据 Cloudflare 级别决定是否跳过
  const strategy = selectStrategy(siteProfile);
  if (strategy === "skip") {
    throw new Error(
      `Site protected by Cloudflare ${siteProfile.cloudflareLevel}, requires manual/API partnership`,
    );
  }

  // 3. 首页爬取（CF 站点启用 stealth）
  const useStealth = needsStealth(strategy);
  const scraped = await scrapePage(sourceUrl, {
    siteProfile,
    signal,
    useStealth,
  });

  if (!scraped.bodyText.trim() && scraped.jsonLd.length === 0) {
    throw new Error("Website contains no extractable content");
  }

  // 4. 多页面发现 + 子页面爬取
  const subPageFields = await crawlSubPages(
    sourceUrl,
    scraped.navLinks,
    siteProfile,
    signal,
    useStealth,
  );

  // 5. 分层提取（首页）
  let mergedFields = extractLayered(scraped);

  // 6. LLM 提取（首页，如需要）
  const needsLlm = !hasHighCoverage(scraped);
  if (needsLlm) {
    const llmFields = await extractWithLlm(scraped, mergedFields, signal);
    mergeFieldsInto(mergedFields, llmFields);
  }

  // 7. 合并子页面字段（高置信度优先）
  for (const subFields of subPageFields) {
    mergeByConfidence(mergedFields, subFields);
  }

  // 8. 提取后校验
  const validated = validateFields(mergedFields);
  logIssues(validated.issues, sourceUrl);

  return { fields: validated.fields };
}

type CrawlStrategy = "standard" | "stealth" | "skip";

/** 策略路由 — 按 Cloudflare 级别分流 */
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
  useStealth: boolean,
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

      const subScraped = await scrapePage(subPage.url, {
        siteProfile,
        signal,
        useStealth,
      });

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

/** 将 source 中的字段合并到 target（不覆盖已有字段） */
function mergeFieldsInto(
  target: ExtractedFields,
  source: ExtractedFields,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (!target[key]) {
      target[key] = value;
    }
  }
}

/** 按置信度合并 — 对同一字段保留置信度更高的值 */
function mergeByConfidence(
  target: ExtractedFields,
  source: ExtractedFields,
): void {
  const confidenceRank: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  for (const [key, value] of Object.entries(source)) {
    const existing = target[key] as ExtractionFieldValue | undefined;
    if (!existing) {
      target[key] = value;
      continue;
    }

    const existingRank = confidenceRank[existing.confidence] ?? 0;
    const newRank = confidenceRank[value.confidence] ?? 0;
    if (newRank > existingRank) {
      target[key] = value;
    }
  }
}

/** LLM 提取 — 带 provider fallback */
async function extractWithLlm(
  scraped: {
    title: string;
    bodyText: string;
    markdown: string;
    imageUrls: string[];
    jsonLd: Record<string, unknown>[];
  },
  existingFields: ExtractedFields,
  signal: AbortSignal,
): Promise<ExtractedFields> {
  const providers = getAllProviders();

  // 优先用 Markdown，回退用 bodyText
  const textContent = scraped.markdown || scraped.bodyText;
  const truncatedText =
    textContent.length > MAX_TEXT_LENGTH
      ? textContent.slice(0, MAX_TEXT_LENGTH) + "\n\n[... text truncated ...]"
      : textContent;

  const userPrompt = buildWebsiteUserPrompt(
    scraped.title,
    truncatedText,
    scraped.imageUrls,
    scraped.jsonLd,
    existingFields,
  );

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      const raw = await chatCompletion(
        provider,
        [
          { role: "system", content: WEBSITE_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        { jsonMode: true, maxTokens: 4096, temperature: 0.1, signal },
      );
      return mapLlmOutput(raw);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") throw lastError;
      console.error(
        `[website-crawl] Provider ${provider.name} failed:`,
        lastError.message,
      );
    }
  }

  throw lastError ?? new Error("All LLM providers failed");
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
