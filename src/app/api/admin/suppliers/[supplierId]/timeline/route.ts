/**
 * Supplier Timeline API — GET /api/admin/suppliers/[supplierId]/timeline
 *
 * Returns 7 milestone nodes for the supplier detail page timeline.
 *
 * Auth: Session-based, BD role required.
 *   - Admin: can view timeline for any supplier
 *   - BD: can view timeline only for suppliers assigned to them
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ supplierId: string }>;
}

type MilestoneStatus = "completed" | "in_progress" | "pending";

interface TimelineNode {
  label: string;
  status: MilestoneStatus;
  date: string | null;
}

interface ContractRow {
  id: string;
  status: string;
  signed_at: string | null;
  updated_at: string;
  provider_metadata: Record<string, unknown> | null;
}

interface BuildingRow {
  id: string;
  onboarding_status: string;
  score: number | null;
}

interface ExtractionJobRow {
  id: string;
  building_id: string;
  status: string;
  completed_at: string | null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const { supplierId } = await context.params;
    const admin = createAdminClient();

    // 1. Fetch supplier + access check
    const { data: supplier, error: supplierError } = await admin
      .from("suppliers")
      .select("id, bd_user_id, created_at")
      .eq("id", supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }

    if (!authResult.isAdmin && supplier.bd_user_id !== authResult.supplier.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Fetch latest non-CANCELED contract
    const { data: contracts, error: contractError } = await admin
      .from("contracts")
      .select("id, status, signed_at, updated_at, provider_metadata")
      .eq("supplier_id", supplierId)
      .neq("status", "CANCELED")
      .order("created_at", { ascending: false })
      .limit(1);

    if (contractError) {
      console.error("[supplier-timeline] contract query error", contractError);
    }

    const contract: ContractRow | null =
      contracts && contracts.length > 0
        ? (contracts[0] as unknown as ContractRow)
        : null;

    // 3. Fetch all buildings for this supplier
    const { data: buildingsRaw, error: buildingsError } = await admin
      .from("buildings")
      .select("id, onboarding_status, score")
      .eq("supplier_id", supplierId);

    if (buildingsError) {
      console.error(
        "[supplier-timeline] buildings query error",
        buildingsError,
      );
    }

    const buildings: BuildingRow[] =
      (buildingsRaw as unknown as BuildingRow[]) ?? [];
    const buildingIds = buildings.map((b) => b.id);

    // 4. Fetch extraction jobs for all buildings
    let extractionJobs: ExtractionJobRow[] = [];
    if (buildingIds.length > 0) {
      const { data: jobsRaw, error: jobsError } = await admin
        .from("extraction_jobs")
        .select("id, building_id, status, completed_at")
        .in("building_id", buildingIds);

      if (jobsError) {
        console.error(
          "[supplier-timeline] extraction_jobs query error",
          jobsError,
        );
      }
      extractionJobs = (jobsRaw as unknown as ExtractionJobRow[]) ?? [];
    }

    // Build timeline nodes
    const timeline: TimelineNode[] = [
      buildApplicationApproved(supplier.created_at),
      buildContractSent(contract),
      buildSupplierSigned(contract),
      buildUhomesCountersigned(contract),
      buildDataExtraction(extractionJobs),
      buildOnboardingComplete(buildings),
      buildPublished(buildings),
    ];

    return NextResponse.json(timeline);
  } catch (error) {
    console.error("[supplier-timeline]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

// --- Milestone builders ---

function buildApplicationApproved(createdAt: string): TimelineNode {
  return {
    label: "Application approved",
    status: "completed",
    date: createdAt,
  };
}

function buildContractSent(contract: ContractRow | null): TimelineNode {
  const sentStatuses = ["SENT", "SIGNED"];
  if (contract && sentStatuses.includes(contract.status)) {
    return {
      label: "Contract sent",
      status: "completed",
      date: contract.updated_at,
    };
  }
  return { label: "Contract sent", status: "pending", date: null };
}

function buildSupplierSigned(contract: ContractRow | null): TimelineNode {
  if (!contract) {
    return { label: "Supplier signed", status: "pending", date: null };
  }

  const meta = contract.provider_metadata;
  const supplierSignedAt =
    meta && typeof meta.supplier_signed_at === "string"
      ? meta.supplier_signed_at
      : null;

  if (supplierSignedAt) {
    return {
      label: "Supplier signed",
      status: "completed",
      date: supplierSignedAt,
    };
  }

  if (contract.status === "SIGNED") {
    return {
      label: "Supplier signed",
      status: "completed",
      date: contract.signed_at,
    };
  }

  return { label: "Supplier signed", status: "pending", date: null };
}

function buildUhomesCountersigned(contract: ContractRow | null): TimelineNode {
  if (contract?.status === "SIGNED") {
    return {
      label: "uhomes countersigned",
      status: "completed",
      date: contract.signed_at,
    };
  }
  return { label: "uhomes countersigned", status: "pending", date: null };
}

function buildDataExtraction(jobs: ExtractionJobRow[]): TimelineNode {
  if (jobs.length === 0) {
    return { label: "Data extraction", status: "pending", date: null };
  }

  const allCompleted = jobs.every((j) => j.status === "completed");
  if (allCompleted) {
    const completedDates = jobs
      .map((j) => j.completed_at)
      .filter((d): d is string => d !== null);
    const maxDate =
      completedDates.length > 0 ? completedDates.sort().reverse()[0] : null;
    return {
      label: "Data extraction",
      status: "completed",
      date: maxDate ?? null,
    };
  }

  const hasActiveJob = jobs.some(
    (j) => j.status === "running" || j.status === "pending",
  );
  if (hasActiveJob) {
    return { label: "Data extraction", status: "in_progress", date: null };
  }

  // All jobs finished but not all completed (some failed/timeout)
  return { label: "Data extraction", status: "pending", date: null };
}

function buildOnboardingComplete(buildings: BuildingRow[]): TimelineNode {
  if (buildings.length === 0) {
    return { label: "Onboarding complete", status: "pending", date: null };
  }

  const allHighScore = buildings.every(
    (b) => b.score !== null && b.score >= 80,
  );
  if (allHighScore) {
    return {
      label: "Onboarding complete",
      status: "completed",
      date: null,
    };
  }

  return { label: "Onboarding complete", status: "pending", date: null };
}

function buildPublished(buildings: BuildingRow[]): TimelineNode {
  const published = buildings.some((b) => b.onboarding_status === "published");
  if (published) {
    return { label: "Published", status: "completed", date: null };
  }
  return { label: "Published", status: "pending", date: null };
}
