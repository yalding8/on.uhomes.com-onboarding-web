/**
 * Supplier Pipeline Stats API
 *
 * GET /api/admin/suppliers/stats
 *   — Returns pipeline KPI metrics for the suppliers dashboard
 *
 * Auth: Session-based, BD role required. Admin sees global stats, BD sees own.
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { computePipelineStage } from "@/lib/suppliers/pipeline";

interface SupplierRecord {
  id: string;
  status: string;
}

interface ContractRecord {
  supplier_id: string;
  status: string;
  updated_at: string;
}

interface BuildingRecord {
  supplier_id: string;
  onboarding_status: string;
  score: number | null;
}

export async function GET() {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const admin = createAdminClient();
    const { isAdmin, supplier } = authResult;

    // 1. Fetch suppliers (role = supplier only)
    let supplierQuery = admin
      .from("suppliers")
      .select("id, status")
      .eq("role", "supplier");

    if (!isAdmin) {
      supplierQuery = supplierQuery.eq("bd_user_id", supplier.id);
    }

    const { data: suppliers, error: suppliersError } = await supplierQuery;
    if (suppliersError) {
      console.error("[suppliers/stats] suppliers query", suppliersError);
      return NextResponse.json(
        { error: "Failed to fetch suppliers" },
        { status: 500 },
      );
    }

    if (!suppliers || suppliers.length === 0) {
      return NextResponse.json({
        new_contract: 0,
        contract_in_progress: 0,
        awaiting_signature: 0,
        signed: 0,
        live: 0,
        overdue_count: 0,
        avg_onboarding_score: 0,
      });
    }

    const supplierIds = suppliers.map((s: SupplierRecord) => s.id);

    // 2. Fetch contracts and buildings in parallel
    const [contractsResult, buildingsResult] = await Promise.all([
      admin
        .from("contracts")
        .select("supplier_id, status, updated_at")
        .in("supplier_id", supplierIds),
      admin
        .from("buildings")
        .select("supplier_id, onboarding_status, score")
        .in("supplier_id", supplierIds),
    ]);

    if (contractsResult.error) {
      console.error("[suppliers/stats] contracts query", contractsResult.error);
    }
    if (buildingsResult.error) {
      console.error("[suppliers/stats] buildings query", buildingsResult.error);
    }

    const contracts = (contractsResult.data ?? []) as ContractRecord[];
    const buildings = (buildingsResult.data ?? []) as BuildingRecord[];

    // 3. Index contracts and buildings by supplier_id
    const contractMap = new Map<string, ContractRecord[]>();
    for (const c of contracts) {
      const list = contractMap.get(c.supplier_id) ?? [];
      list.push(c);
      contractMap.set(c.supplier_id, list);
    }

    const buildingMap = new Map<string, BuildingRecord[]>();
    for (const b of buildings) {
      const list = buildingMap.get(b.supplier_id) ?? [];
      list.push(b);
      buildingMap.set(b.supplier_id, list);
    }

    // 4. Compute pipeline stages and aggregate counts
    let newContract = 0;
    let contractInProgress = 0;
    let awaitingSignature = 0;
    let signed = 0;
    let live = 0;
    let overdueCount = 0;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const s of suppliers as SupplierRecord[]) {
      const supplierContracts = contractMap.get(s.id) ?? [];
      const supplierBuildings = buildingMap.get(s.id) ?? [];

      // Use the latest contract status (or null if none)
      const latestContract =
        supplierContracts.length > 0 ? supplierContracts[0] : null;
      const contractStatus = latestContract?.status ?? null;

      const stage = computePipelineStage(
        s.status,
        contractStatus,
        supplierBuildings.map((b) => ({
          onboarding_status: b.onboarding_status,
        })),
      );

      switch (stage) {
        case "NEW_CONTRACT":
          newContract++;
          break;
        case "CONTRACT_IN_PROGRESS":
          contractInProgress++;
          break;
        case "AWAITING_SIGNATURE":
          awaitingSignature++;
          // Check overdue: contract updated_at > 7 days ago
          if (
            latestContract &&
            new Date(latestContract.updated_at).getTime() < sevenDaysAgo
          ) {
            overdueCount++;
          }
          break;
        case "SIGNED":
          signed++;
          break;
        case "LIVE":
          live++;
          break;
      }
    }

    // 5. Compute avg onboarding score for SIGNED suppliers
    const signedSupplierIds = new Set(
      (suppliers as SupplierRecord[])
        .filter((s) => s.status === "SIGNED")
        .map((s) => s.id),
    );

    let scoreSum = 0;
    let scoreCount = 0;
    for (const b of buildings) {
      if (signedSupplierIds.has(b.supplier_id) && b.score != null) {
        scoreSum += b.score;
        scoreCount++;
      }
    }

    const avgOnboardingScore =
      scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0;

    return NextResponse.json({
      new_contract: newContract,
      contract_in_progress: contractInProgress,
      awaiting_signature: awaitingSignature,
      signed,
      live,
      overdue_count: overdueCount,
      avg_onboarding_score: avgOnboardingScore,
    });
  } catch (error) {
    console.error("[suppliers/stats]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
