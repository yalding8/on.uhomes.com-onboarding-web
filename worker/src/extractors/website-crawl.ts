/**
 * 网页爬取提取器
 *
 * 流程: Playwright 爬取 → 提取文本/图片/JSON-LD → 截断 → LLM → 字段映射
 */

import { scrapePage } from "../crawl/scraper.js";
import { chatCompletion } from "../llm/client.js";
import { getProvider } from "../llm/config.js";
import { mapLlmOutput } from "../llm/field-mapper.js";
import {
  WEBSITE_EXTRACTION_SYSTEM_PROMPT,
  buildWebsiteUserPrompt,
} from "../llm/prompts/website-fields.js";
import type { ExtractionResult } from "./index.js";

const MAX_TEXT_LENGTH = 60_000;

export async function extractFromWebsite(
  sourceUrl: string,
  signal: AbortSignal,
): Promise<ExtractionResult> {
  // 1. 爬取页面
  const { title, bodyText, imageUrls, jsonLd } = await scrapePage(
    sourceUrl,
    signal,
  );

  if (!bodyText.trim() && jsonLd.length === 0) {
    throw new Error("Website contains no extractable content");
  }

  // 2. 截断文本（网页通常较大）
  const truncatedText =
    bodyText.length > MAX_TEXT_LENGTH
      ? bodyText.slice(0, MAX_TEXT_LENGTH) + "\n\n[... text truncated ...]"
      : bodyText;

  // 3. LLM 提取
  const provider = getProvider();
  const userPrompt = buildWebsiteUserPrompt(
    title,
    truncatedText,
    imageUrls,
    jsonLd,
  );

  const raw = await chatCompletion(
    provider,
    [
      { role: "system", content: WEBSITE_EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { jsonMode: true, maxTokens: 4096, temperature: 0.1 },
  );

  // 4. 字段映射
  const fields = mapLlmOutput(raw);

  return { fields };
}
