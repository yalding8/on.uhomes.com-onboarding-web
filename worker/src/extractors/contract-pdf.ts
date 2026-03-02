/**
 * 合同 PDF 提取器
 *
 * 流程: 下载 PDF → 解析文本 → 截断至 80K 字符 → LLM 提取 → 字段映射
 * 增强: LLM provider fallback chain
 */

import { downloadPdf } from "../pdf/downloader.js";
import { parsePdf } from "../pdf/parser.js";
import { chatCompletion } from "../llm/client.js";
import { getAllProviders } from "../llm/config.js";
import { mapLlmOutput } from "../llm/field-mapper.js";
import {
  CONTRACT_EXTRACTION_SYSTEM_PROMPT,
  buildContractUserPrompt,
} from "../llm/prompts/contract-fields.js";
import type { ExtractionResult } from "./index.js";

const MAX_TEXT_LENGTH = 80_000;

export async function extractFromContractPdf(
  sourceUrl: string,
  signal: AbortSignal,
): Promise<ExtractionResult> {
  // 1. 下载 PDF
  const pdfBuffer = await downloadPdf(sourceUrl, signal);

  // 2. 解析文本
  const { text } = await parsePdf(pdfBuffer);
  if (!text.trim()) {
    throw new Error("PDF contains no extractable text");
  }

  // 3. 截断至 80K 字符（避免超出 LLM 上下文窗口）
  const truncatedText =
    text.length > MAX_TEXT_LENGTH
      ? text.slice(0, MAX_TEXT_LENGTH) + "\n\n[... text truncated ...]"
      : text;

  // 4. LLM 提取（带 provider fallback）
  const providers = getAllProviders();
  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      const raw = await chatCompletion(
        provider,
        [
          { role: "system", content: CONTRACT_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: buildContractUserPrompt(truncatedText) },
        ],
        { jsonMode: true, maxTokens: 4096, temperature: 0.1, signal },
      );
      const fields = mapLlmOutput(raw);
      return { fields };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") throw lastError;
      console.error(
        `[contract-pdf] Provider ${provider.name} failed, trying next:`,
        lastError.message,
      );
    }
  }

  throw lastError ?? new Error("All LLM providers failed");
}
