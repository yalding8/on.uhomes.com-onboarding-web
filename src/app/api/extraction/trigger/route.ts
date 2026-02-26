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
  },
): Promise<void> {
  const workerBaseUrl = process.env.EXTRACTION_WORKER_URL;
  if (!workerBaseUrl) return;

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const callbackUrl = `${baseUrl}/api/extraction/callback`;

  try {
    await fetch(`${workerBaseUrl}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getServiceRoleKey()}`,
      },
      body: JSON.stringify({
        jobId,
        source,
        buildingId: payload.buildingId,
        supplierId: payload.supplierId,
        sourceUrl: payload.sourceUrl,
        callbackUrl,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Worker 不可达时不阻塞，job 保持 pending 状态
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
    const { buildingId, supplierId, contractPdfUrl, websiteUrl, googleSheetsUrl } = body;

    if (!buildingId || !supplierId || !contractPdfUrl) {
      return NextResponse.json(
        { error: "Missing required fields: buildingId, supplierId, contractPdfUrl" },
        { status: 400 },
      );
    }

    const admin = getAdminClient();

    // 创建 3 个 extraction_jobs（pending 状态）
    const jobs: ExtractionJob[] = [
      { building_id: buildingId, source: "contract_pdf", status: "pending" },
      { building_id: buildingId, source: "website_crawl", status: "pending" },
      { building_id: buildingId, source: "google_sheets", status: "pending" },
    ];

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

    // 向 External Worker 发送提取请求（不阻塞响应）
    const dispatchPromises = insertedJobs.map((job) =>
      dispatchToWorker(
        job.source as ExtractionSource,
        job.id as string,
        {
          buildingId,
          supplierId,
          sourceUrl: sourceUrls[job.source as ExtractionSource],
        },
      ),
    );

    // 并行触发所有 worker，但不等待完成
    Promise.allSettled(dispatchPromises);

    return NextResponse.json({
      message: "Extraction triggered",
      buildingId,
      jobs: insertedJobs.map((j) => ({ id: j.id, source: j.source })),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
