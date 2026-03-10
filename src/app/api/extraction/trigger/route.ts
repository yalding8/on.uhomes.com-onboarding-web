/**
 * Extraction Trigger API — POST /api/extraction/trigger
 *
 * 触发多源数据提取任务（由合同 Confirm 或 DocuSign 签署 webhook 调用）。
 * 为指定 building 创建 extraction_jobs 并向 External Worker 发送 HTTP 请求。
 *
 * 鉴权: SUPABASE_SERVICE_ROLE_KEY（仅内部服务调用）
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, getServiceRoleKey } from "@/lib/env";
import {
  lookupDomainHints,
  dispatchToWorker,
  type ExtractionSource,
  type DomainHints,
} from "./worker-dispatch";

// ── Types ──

interface TriggerPayload {
  buildingId: string;
  supplierId: string;
  contractPdfUrl?: string;
  websiteUrl?: string;
  googleSheetsUrl?: string;
  /** When set, only create job for this specific source */
  sourceFilter?: ExtractionSource;
}

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

// ── Route Handler ──

export async function POST(request: Request) {
  try {
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
      sourceFilter,
    } = body;

    if (!buildingId || !supplierId) {
      return NextResponse.json(
        { error: "Missing required fields: buildingId, supplierId" },
        { status: 400 },
      );
    }

    if (!contractPdfUrl && !websiteUrl && !googleSheetsUrl) {
      return NextResponse.json(
        { error: "At least one source URL is required" },
        { status: 400 },
      );
    }

    const admin = getAdminClient();

    // Build jobs list — sourceFilter limits to a single source
    const jobs: ExtractionJob[] = [];

    if (contractPdfUrl && (!sourceFilter || sourceFilter === "contract_pdf")) {
      jobs.push({
        building_id: buildingId,
        source: "contract_pdf",
        status: "pending",
      });
    }
    if (websiteUrl && (!sourceFilter || sourceFilter === "website_crawl")) {
      jobs.push({
        building_id: buildingId,
        source: "website_crawl",
        status: "pending",
      });
    }
    if (
      googleSheetsUrl &&
      (!sourceFilter || sourceFilter === "google_sheets")
    ) {
      jobs.push({
        building_id: buildingId,
        source: "google_sheets",
        status: "pending",
      });
    }

    if (jobs.length === 0) {
      return NextResponse.json({
        message: "No matching sources to extract",
        buildingId,
        jobs: [],
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

    await admin
      .from("buildings")
      .update({ onboarding_status: "extracting" })
      .eq("id", buildingId);

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

    const sourceUrls: Record<ExtractionSource, string> = {
      contract_pdf: contractPdfUrl ?? "",
      website_crawl: websiteUrl ?? "",
      google_sheets: googleSheetsUrl ?? "",
    };

    let domainHints: DomainHints | undefined;
    if (websiteUrl) {
      domainHints = await lookupDomainHints(admin, websiteUrl);
      if (domainHints) {
        console.error(
          `[extraction/trigger] Domain hints: ${domainHints.crawlCount} crawls, strategy=${domainHints.strategyUsed}`,
        );
      }
    }

    const dispatchPromises = insertedJobs.map((job) => {
      const source = job.source as ExtractionSource;
      return dispatchToWorker(source, job.id as string, {
        buildingId,
        supplierId,
        sourceUrl: sourceUrls[source],
        domainHints: source === "website_crawl" ? domainHints : undefined,
      });
    });

    const results = await Promise.allSettled(dispatchPromises);
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(
        `[extraction/trigger] ${failures.length}/${results.length} dispatches failed`,
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
