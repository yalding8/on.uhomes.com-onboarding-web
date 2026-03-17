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

/** 域名级经验提示 — 来自 extraction_logs 历史记录 */
export interface DomainHints {
  siteType: string;
  siteFramework: string;
  cloudflareLevel: string;
  strategyUsed: string;
  avgCoverageRatio: number;
  crawlCount: number;
}

export interface ExtractionRequest {
  jobId: string;
  source: ExtractionSource;
  buildingId: string;
  supplierId: string;
  sourceUrl: string;
  callbackUrl: string;
  domainHints?: DomainHints;
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
  /** Tier A 字段覆盖率（核心必填字段） */
  tierACoverageRatio: number;
  /** Tier B 字段覆盖率（详细信息字段） */
  tierBCoverageRatio: number;
  /** 最终提取字段总数 */
  totalFieldCount: number;
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
