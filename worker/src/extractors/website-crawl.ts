/**
 * 网页爬取提取器 — 策略路由 + 分层提取
 *
 * 流程:
 *  1. 快速预检 → 生成 SiteProfile
 *  2. 策略路由 → 按站点类型选择爬取策略
 *  3. Playwright 爬取 → 提取文本/图片/JSON-LD/OpenGraph
 *  4. 分层提取:
 *     a. JSON-LD 直接映射（跳过 LLM，速度快、置信度高）
 *     b. OpenGraph 补充
 *     c. LLM 提取仅针对缺失字段
 *  5. 提取后校验 → 修复/降级/移除不合理字段
 */

import { probeSite } from "../crawl/site-probe.js";
import { scrapePage } from "../crawl/scraper.js";
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
import type { ExtractionResult } from "./index.js";
import type { ExtractedFields } from "../types.js";

const MAX_TEXT_LENGTH = 60_000;

/** 跳过 LLM 的最低 JSON-LD 覆盖率阈值 */
const SKIP_LLM_COVERAGE = 0.8;

export async function extractFromWebsite(
  sourceUrl: string,
  signal: AbortSignal,
): Promise<ExtractionResult> {
  // 1. 快速预检
  const siteProfile = await probeSite(sourceUrl, signal);

  // 2. Playwright 爬取（按站点类型调整策略）
  const scraped = await scrapePage(sourceUrl, { siteProfile, signal });

  if (!scraped.bodyText.trim() && scraped.jsonLd.length === 0) {
    throw new Error("Website contains no extractable content");
  }

  // 3. 分层提取
  let mergedFields: ExtractedFields = {};

  // 3a. JSON-LD 直接映射
  if (scraped.jsonLd.length > 0) {
    const structuredResult = mapStructuredData(scraped.jsonLd);
    mergedFields = { ...mergedFields, ...structuredResult.fields };

    // 如果覆盖率足够高，跳过 LLM
    if (structuredResult.coverageRatio >= SKIP_LLM_COVERAGE) {
      const ogFields = mapOpenGraphData(scraped.openGraph);
      mergedFields = { ...mergedFields, ...ogFields };
      const validated = validateFields(mergedFields);
      logIssues(validated.issues, sourceUrl);
      return { fields: validated.fields };
    }
  }

  // 3b. OpenGraph 补充（不覆盖已有字段）
  const ogFields = mapOpenGraphData(scraped.openGraph);
  for (const [key, value] of Object.entries(ogFields)) {
    if (!mergedFields[key]) {
      mergedFields[key] = value;
    }
  }

  // 3c. LLM 提取（仅补充缺失字段）
  const llmFields = await extractWithLlm(scraped, mergedFields, signal);
  for (const [key, value] of Object.entries(llmFields)) {
    if (!mergedFields[key]) {
      mergedFields[key] = value;
    }
  }

  // 4. 提取后校验
  const validated = validateFields(mergedFields);
  logIssues(validated.issues, sourceUrl);

  return { fields: validated.fields };
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
