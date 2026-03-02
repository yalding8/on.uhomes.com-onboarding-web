/**
 * Extraction Job Helpers — shared utilities for extraction API routes.
 */

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, getServiceRoleKey } from "@/lib/env";
import { FIELD_SCHEMA } from "@/lib/onboarding/field-schema";
import { calculateScore } from "@/lib/onboarding/scoring-engine";
import type { FieldValue } from "@/lib/onboarding/field-value";

export type AdminClient = ReturnType<typeof createClient>;

/** Timeout threshold: jobs pending/running longer than this are auto-timed-out */
const JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const TERMINAL_STATUSES = ["completed", "failed", "timeout"];

export function getAdminClient(): AdminClient {
  return createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function verifyServiceKey(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  return token === getServiceRoleKey();
}

/**
 * Check if all extraction_jobs for a building are in terminal state.
 * Auto-timeouts stale jobs that have been pending/running too long.
 */
export async function areAllJobsDone(
  admin: AdminClient,
  buildingId: string,
): Promise<boolean> {
  const { data: jobs } = await admin
    .from("extraction_jobs")
    .select("id, status, created_at")
    .eq("building_id", buildingId);

  if (!jobs || jobs.length === 0) return true;

  const now = Date.now();

  for (const job of jobs) {
    if (TERMINAL_STATUSES.includes(job.status as string)) continue;
    const createdAt = new Date(job.created_at as string).getTime();
    if (now - createdAt > JOB_TIMEOUT_MS) {
      await admin
        .from("extraction_jobs")
        .update({
          status: "timeout",
          error_message: "Job timed out after 30 minutes",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      job.status = "timeout";
    }
  }

  return jobs.every((j: { status: string }) =>
    TERMINAL_STATUSES.includes(j.status),
  );
}

/**
 * If all extraction_jobs are done, transition building out of extracting.
 */
export async function checkAndFinalizeExtraction(
  admin: AdminClient,
  buildingId: string,
): Promise<void> {
  const allDone = await areAllJobsDone(admin, buildingId);
  if (!allDone) return;

  const { data: building } = await admin
    .from("buildings")
    .select("onboarding_status")
    .eq("id", buildingId)
    .single();

  if (building?.onboarding_status !== "extracting") return;

  const { data: onboardingData } = await admin
    .from("building_onboarding_data")
    .select("field_values")
    .eq("building_id", buildingId)
    .single();

  const fieldValues: Record<string, FieldValue> =
    onboardingData?.field_values ?? {};
  const score = calculateScore(FIELD_SCHEMA, fieldValues);
  const newStatus = score.score >= 80 ? "previewable" : "incomplete";

  await admin
    .from("buildings")
    .update({ score: score.score, onboarding_status: newStatus })
    .eq("id", buildingId);
}
