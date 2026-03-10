/**
 * Worker dispatch helpers for extraction trigger.
 *
 * Extracted from route.ts to keep under 300-line limit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleKey } from "@/lib/env";

export type ExtractionSource =
  | "contract_pdf"
  | "website_crawl"
  | "google_sheets";

export interface DomainHints {
  siteType: string;
  siteFramework: string;
  cloudflareLevel: string;
  strategyUsed: string;
  avgCoverageRatio: number;
  crawlCount: number;
}

/** 从 extraction_logs 查询域名历史经验 */
export async function lookupDomainHints(
  admin: SupabaseClient,
  sourceUrl: string,
): Promise<DomainHints | undefined> {
  let domain: string;
  try {
    domain = new URL(sourceUrl).hostname;
  } catch {
    return undefined;
  }

  const { data } = await admin
    .from("extraction_logs")
    .select("site_type, site_framework, strategy_used, field_coverage_ratio")
    .eq("url_domain", domain)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return undefined;

  const latest = data[0] as Record<string, unknown>;
  const avgCoverage =
    data.reduce(
      (sum, row) =>
        sum +
        (((row as Record<string, unknown>).field_coverage_ratio as number) ??
          0),
      0,
    ) / data.length;

  const strategy = (latest.strategy_used as string) ?? "standard";
  const cfLevel = strategy === "stealth" ? "free" : "none";

  return {
    siteType: (latest.site_type as string) ?? "unknown",
    siteFramework: (latest.site_framework as string) ?? "unknown",
    cloudflareLevel: cfLevel,
    strategyUsed: strategy,
    avgCoverageRatio: avgCoverage,
    crawlCount: data.length,
  };
}

/**
 * 向 External Worker 发送提取请求。
 * Worker 不可达时不阻塞主流程，仅记录错误。
 */
export async function dispatchToWorker(
  source: ExtractionSource,
  jobId: string,
  payload: {
    buildingId: string;
    supplierId: string;
    sourceUrl: string;
    domainHints?: DomainHints;
  },
): Promise<void> {
  const workerBaseUrl = process.env.EXTRACTION_WORKER_URL;
  if (!workerBaseUrl) return;

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const callbackUrl = `${baseUrl}/api/extraction/callback`;

  const MAX_RETRIES = 2;
  const requestBody: Record<string, unknown> = {
    jobId,
    source,
    buildingId: payload.buildingId,
    supplierId: payload.supplierId,
    sourceUrl: payload.sourceUrl,
    callbackUrl,
  };
  if (payload.domainHints) {
    requestBody.domainHints = payload.domainHints;
  }
  const body = JSON.stringify(requestBody);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${workerBaseUrl}/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getServiceRoleKey()}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
      console.error(
        `[extraction/trigger] Worker dispatch HTTP ${res.status} for ${source} (attempt ${attempt + 1})`,
      );
    } catch (err) {
      console.error(
        `[extraction/trigger] Worker dispatch failed for ${source} (attempt ${attempt + 1}):`,
        err instanceof Error ? err.message : err,
      );
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}
