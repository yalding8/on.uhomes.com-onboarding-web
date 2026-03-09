/**
 * LLM 提取 — 带 provider fallback
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

export async function extractWithLlm(
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
