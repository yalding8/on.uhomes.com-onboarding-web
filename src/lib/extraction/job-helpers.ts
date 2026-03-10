/**
 * Extraction Job Helpers — shared utilities for extraction API routes.
 */

import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, getServiceRoleKey } from "@/lib/env";
import { FIELD_SCHEMA } from "@/lib/onboarding/field-schema";
import { calculateScore } from "@/lib/onboarding/scoring-engine";
import type { FieldValue } from "@/lib/onboarding/field-value";
import { mergeWithProtection } from "@/lib/onboarding/data-merge";
import { getExcludedFields } from "@/lib/onboarding/field-applicability";

export type AdminClient = ReturnType<typeof createClient>;

/** Timeout threshold: jobs pending/running longer than this are auto-timed-out */
const JOB_TIMEOUT_MS = 6 * 60 * 1000; // 6 minutes (5-min target + 1-min buffer)

const TERMINAL_STATUSES = ["completed", "failed", "timeout"];

const MAX_MERGE_RETRIES = 3;

export function getAdminClient(): AdminClient {
  return createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function verifyServiceKey(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  const expected = Buffer.from(getServiceRoleKey(), "utf-8");
  const actual = Buffer.from(token, "utf-8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
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

  interface JobRow {
    id: string;
    status: string;
    created_at: string;
  }
  const typedJobs = jobs as unknown as JobRow[];

  for (const job of typedJobs) {
    if (TERMINAL_STATUSES.includes(job.status)) continue;
    const createdAt = new Date(job.created_at).getTime();
    if (now - createdAt > JOB_TIMEOUT_MS) {
      await admin
        .from("extraction_jobs")
        .update({
          status: "timeout",
          error_message: "Job timed out after 6 minutes",
          completed_at: new Date().toISOString(),
        } as never)
        .eq("id", job.id);
      job.status = "timeout";
    }
  }

  return typedJobs.every((j) => TERMINAL_STATUSES.includes(j.status));
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

  const { data: building } = (await admin
    .from("buildings")
    .select("onboarding_status")
    .eq("id", buildingId)
    .single()) as { data: { onboarding_status: string } | null };

  if (building?.onboarding_status !== "extracting") return;

  const { data: onboardingData } = (await admin
    .from("building_onboarding_data")
    .select("field_values")
    .eq("building_id", buildingId)
    .single()) as {
    data: { field_values: Record<string, FieldValue> } | null;
  };

  const fieldValues: Record<string, FieldValue> =
    onboardingData?.field_values ?? {};
  const excluded = getExcludedFields(fieldValues);
  const score = calculateScore(FIELD_SCHEMA, fieldValues, excluded);
  const newStatus = score.score >= 70 ? "previewable" : "incomplete";

  await admin
    .from("buildings")
    .update({
      score: score.score,
      onboarding_status: newStatus,
    } as never)
    .eq("id", buildingId);
}

interface OnboardingRow {
  field_values: Record<string, FieldValue>;
  version: number;
}

/**
 * Merge incoming field values into building_onboarding_data with optimistic
 * locking. Retries up to MAX_MERGE_RETRIES times on version conflicts.
 *
 * Returns true if the merge succeeded, false if all retries were exhausted.
 */
export async function mergeOnboardingDataWithRetry(
  admin: AdminClient,
  buildingId: string,
  incomingValues: Record<string, FieldValue>,
  initialData: OnboardingRow | null,
  initialMerged: Record<string, FieldValue>,
): Promise<boolean> {
  let finalMerged = initialMerged;
  let finalVersion = initialData?.version ?? 0;
  let hasExistingRow = initialData !== null;

  for (let retry = 0; retry < MAX_MERGE_RETRIES; retry++) {
    if (retry > 0) {
      const { data: fresh } = (await admin
        .from("building_onboarding_data")
        .select("field_values, version")
        .eq("building_id", buildingId)
        .single()) as { data: OnboardingRow | null };
      if (!fresh) break;
      finalVersion = fresh.version;
      finalMerged = mergeWithProtection(
        fresh.field_values ?? {},
        incomingValues,
      );
      hasExistingRow = true;
    }

    const newVersion = finalVersion + 1;
    if (hasExistingRow) {
      const { data: updated } = (await admin
        .from("building_onboarding_data")
        .update({
          field_values: finalMerged,
          version: newVersion,
        } as never)
        .eq("building_id", buildingId)
        .eq("version", finalVersion)
        .select("version")) as { data: Array<{ version: number }> | null };

      if (updated && updated.length > 0) return true;
      // Version conflict — retry
    } else {
      await admin.from("building_onboarding_data").insert({
        building_id: buildingId,
        field_values: finalMerged,
        version: 1,
      } as never);
      return true;
    }
  }

  console.error(
    `[extraction/callback] Failed to merge after ${MAX_MERGE_RETRIES} retries (version conflict) for building ${buildingId}`,
  );
  return false;
}
