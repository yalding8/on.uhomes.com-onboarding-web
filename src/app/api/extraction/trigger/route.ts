/**
 * Extraction Trigger API — POST /api/extraction/trigger
 *
 * 触发多源数据提取任务（由合同签署 webhook 或 BD 手动调用）。
 * 为指定 building 创建 3 个 extraction_jobs（contract_pdf / website_crawl / google_sheets），
 * 并向 External Worker 发送 HTTP 请求触发提取。
 *
 * 鉴权: SUPABASE_SERVICE_ROLE_KEY（仅内部服务调用）
 *
 * Requirements: 1.1
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, getServiceRoleKey } from "@/lib/env";

// ── Types ──

interface TriggerPayload {
  buildingId: string;
  supplierId: string;
  contractPdfUrl: string;
  websiteUrl?: string;
  googleSheetsUrl?: string;
}

type ExtractionSource = "contract_pdf" | "website_crawl" | "google_sheets";

interface ExtractionJob {
  building_id: string;
  source: ExtractionSource;
  status: "pending";
}

// ── Helpers ──

function getAdminClient() {
  return createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function verifyServiceKey(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  return token === getServiceRoleKey();
}

/** 域名级经验提示 */
interface DomainHints {
  siteType: string;
  siteFramework: string;
  cloudflareLevel: string;
  strategyUsed: string;
  avgCoverageRatio: number;
  crawlCount: number;
}

/** 从 extraction_logs 查询域名历史经验 */
async function lookupDomainHints(
  admin: ReturnType<typeof getAdminClient>,
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
    .select(
      "site_type, site_framework, strategy_used, field_coverage_ratio",
    )
    .eq("url_domain", domain)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return undefined;

  const latest = data[0] as Record<string, unknown>;
  const avgCoverage =
    data.reduce(
      (sum, row) =>
        sum +
        ((row as Record<string, unknown>).field_coverage_ratio as number ?? 0),
      0,
    ) / data.length;

  // Infer cloudflare level from strategy
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
async function dispatchToWorker(
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

// ── Route Handler ──

export async function POST(request: Request) {
  try {
    // 鉴权：仅允许内部服务调用
    if (!verifyServiceKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as TriggerPayload;
    const {
      buildingId,
      supplierId,
      contractPdfUrl,
      websiteUrl,
      googleSheetsUrl,
    } = body;

    if (!buildingId || !supplierId || !contractPdfUrl) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: buildingId, supplierId, contractPdfUrl",
        },
        { status: 400 },
      );
    }

    const admin = getAdminClient();

    // 创建 extraction_jobs（只为有有效来源 URL 的任务创建 job）
    const jobs: ExtractionJob[] = [
      { building_id: buildingId, source: "contract_pdf", status: "pending" },
    ];
    if (websiteUrl) {
      jobs.push({
        building_id: buildingId,
        source: "website_crawl",
        status: "pending",
      });
    }
    if (googleSheetsUrl) {
      jobs.push({
        building_id: buildingId,
        source: "google_sheets",
        status: "pending",
      });
    }

    const { data: insertedJobs, error: insertError } = await admin
      .from("extraction_jobs")
      .insert(jobs)
      .select("id, source");

    if (insertError || !insertedJobs) {
      return NextResponse.json(
        { error: "Failed to create extraction jobs" },
        { status: 500 },
      );
    }

    // 更新 building 状态为 extracting
    await admin
      .from("buildings")
      .update({ onboarding_status: "extracting" })
      .eq("id", buildingId);

    // 创建 building_onboarding_data 记录（如不存在）
    const { data: existingData } = await admin
      .from("building_onboarding_data")
      .select("id")
      .eq("building_id", buildingId)
      .single();

    if (!existingData) {
      await admin.from("building_onboarding_data").insert({
        building_id: buildingId,
        field_values: {},
        version: 1,
      });
    }

    // 构建来源 URL 映射
    const sourceUrls: Record<ExtractionSource, string> = {
      contract_pdf: contractPdfUrl,
      website_crawl: websiteUrl ?? "",
      google_sheets: googleSheetsUrl ?? "",
    };

    // 查询域名历史经验（仅 website_crawl）
    let domainHints: DomainHints | undefined;
    if (websiteUrl) {
      domainHints = await lookupDomainHints(admin, websiteUrl);
      if (domainHints) {
        console.error(
          `[extraction/trigger] Domain hints found: ${domainHints.crawlCount} prior crawls, strategy=${domainHints.strategyUsed}, coverage=${domainHints.avgCoverageRatio.toFixed(3)}`,
        );
      }
    }

    // 向 External Worker 发送提取请求（不阻塞响应）
    const dispatchPromises = insertedJobs.map((job) => {
      const source = job.source as ExtractionSource;
      return dispatchToWorker(source, job.id as string, {
        buildingId,
        supplierId,
        sourceUrl: sourceUrls[source],
        domainHints: source === "website_crawl" ? domainHints : undefined,
      });
    });

    // 并行触发所有 worker，等待完成并记录失败
    const results = await Promise.allSettled(dispatchPromises);
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(
        `[extraction/trigger] ${failures.length}/${results.length} worker dispatches failed`,
      );
    }

    return NextResponse.json({
      message: "Extraction triggered",
      buildingId,
      jobs: insertedJobs.map((j) => ({ id: j.id, source: j.source })),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
