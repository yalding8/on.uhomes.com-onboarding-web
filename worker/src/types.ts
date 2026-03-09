/**
 * Worker 服务的请求/响应类型定义
 *
 * ExtractionRequest: 主应用 trigger → Worker 的请求体
 * ExtractionResponse: Worker → 主应用 callback 的响应体
 */

export type ExtractionSource =
  | "contract_pdf"
  | "website_crawl"
  | "google_sheets";

export type Confidence = "high" | "medium" | "low";

export interface ExtractionRequest {
  jobId: string;
  source: ExtractionSource;
  buildingId: string;
  supplierId: string;
  sourceUrl: string;
  callbackUrl: string;
}

export interface ExtractionFieldValue {
  value: unknown;
  confidence: Confidence;
}

export type ExtractedFields = Record<string, ExtractionFieldValue>;

/** 提取过程元数据 — 用于 extraction_logs 积累经验 */
export interface ExtractionMeta {
  sourceUrl: string;
  urlDomain: string;
  siteType: string;
  siteFramework: string;
  siteComplexity: string;
  strategyUsed: string;
  hasJsonLd: boolean;
  hasOpenGraph: boolean;
  cloudflareLevel: string;
  llmSkipped: boolean;
  llmProvider: string | null;
  fieldCoverageRatio: number;
  confidenceHigh: number;
  confidenceMedium: number;
  confidenceLow: number;
  validationIssues: number;
  llmValidationQuality: string;
  llmValidationAdjustments: number;
  llmValidationRemovals: number;
  probeDurationMs: number;
  scrapeDurationMs: number;
  llmDurationMs: number;
  totalDurationMs: number;
}

export interface CallbackPayload {
  jobId: string;
  buildingId: string;
  source: ExtractionSource;
  extractedFields: ExtractedFields;
  status: "success" | "partial" | "failed";
  errorMessage?: string;
  meta?: ExtractionMeta;
}
