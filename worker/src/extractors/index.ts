/**
 * 提取器分发 — 按 source 类型路由到对应提取器
 */

import type {
  ExtractionSource,
  ExtractedFields,
  ExtractionMeta,
} from "../types.js";
import { extractFromContractPdf } from "./contract-pdf.js";
import { extractFromWebsite } from "./website-crawl.js";

export interface ExtractionResult {
  fields: ExtractedFields;
  meta?: Partial<ExtractionMeta>;
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
      throw new Error(
        "Google Sheets extraction not yet implemented. Please use contract PDF or website extraction.",
      );
    default:
      throw new Error(`Unsupported extraction source: ${source}`);
  }
}
