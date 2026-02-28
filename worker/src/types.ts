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

export interface CallbackPayload {
  jobId: string;
  buildingId: string;
  source: ExtractionSource;
  extractedFields: ExtractedFields;
  status: "success" | "partial" | "failed";
  errorMessage?: string;
}
