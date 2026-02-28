/**
 * 提取器分发 — 按 source 类型路由到对应提取器
 */

import type { ExtractionSource, ExtractedFields } from "../types.js";
import { extractFromContractPdf } from "./contract-pdf.js";
import { extractFromWebsite } from "./website-crawl.js";

export interface ExtractionResult {
  fields: ExtractedFields;
}

export async function extract(
  source: ExtractionSource,
  sourceUrl: string,
  signal: AbortSignal,
): Promise<ExtractionResult> {
  switch (source) {
    case "contract_pdf":
      return extractFromContractPdf(sourceUrl, signal);
    case "website_crawl":
      return extractFromWebsite(sourceUrl, signal);
    case "google_sheets":
      // 后续迭代实现
      return { fields: {} };
    default:
      throw new Error(`Unsupported extraction source: ${source}`);
  }
}
