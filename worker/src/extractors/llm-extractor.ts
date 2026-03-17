/**
 * LLM 提取 — 带 provider fallback + 智能截断
 *
 * 从页面内容中用 LLM 提取缺失字段，支持多 provider 自动降级
 */

import { chatCompletion } from "../llm/client.js";
import { getAllProviders } from "../llm/config.js";
import { mapLlmOutput } from "../llm/field-mapper.js";
import {
  WEBSITE_EXTRACTION_SYSTEM_PROMPT,
  buildWebsiteUserPrompt,
} from "../llm/prompts/website-fields.js";
import type { ExtractedFields } from "../types.js";

const MAX_TEXT_LENGTH = 60_000;

/** 含关键公寓信息的段落优先保留（多语言） */
const PRIORITY_KEYWORDS =
  /price|rent|cost|amenit|feature|contact|phone|email|address|floor.?plan|unit|bedroom|apply|prix|loyer|miete|kosten|precio|alquiler/i;

/**
 * 智能截断 — 保留头部 40% + 关键段落 30% + 尾部 30%
 * 比单纯头部截断多保留页面中部和底部的价格/设施信息
 */
export function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const headSize = Math.floor(maxLength * 0.4);
  const tailSize = Math.floor(maxLength * 0.3);
  const midBudget = maxLength - headSize - tailSize;

  const head = text.slice(0, headSize);
  const tail = text.slice(-tailSize);

  // 从中间提取含关键词的段落
  const middle = text.slice(headSize, -tailSize);
  const paragraphs = middle.split(/\n{2,}/);
  const prioritized = paragraphs
    .filter((p) => PRIORITY_KEYWORDS.test(p))
    .join("\n\n")
    .slice(0, midBudget);

  return [
    head,
    "\n\n[... content condensed ...]\n\n",
    prioritized,
    "\n\n[... content condensed ...]\n\n",
    tail,
  ].join("");
}

export async function extractWithLlm(
  scraped: {
    title: string;
    bodyText: string;
    markdown: string;
    imageUrls: string[];
    jsonLd: Record<string, unknown>[];
    contactText?: string;
  },
  existingFields: ExtractedFields,
  signal: AbortSignal,
): Promise<ExtractedFields> {
  const providers = getAllProviders();

  // 优先用 Markdown，回退用 bodyText
  const textContent = scraped.markdown || scraped.bodyText;
  const truncatedText = smartTruncate(textContent, MAX_TEXT_LENGTH);

  const userPrompt = buildWebsiteUserPrompt(
    scraped.title,
    truncatedText,
    scraped.imageUrls,
    scraped.jsonLd,
    existingFields,
    scraped.contactText,
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
