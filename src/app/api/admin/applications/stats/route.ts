/**
 * Application Stats API
 *
 * GET /api/admin/applications/stats
 *   — Returns KPI metrics for the applications dashboard
 *
 * Auth: Session-based, BD role required. Admin sees global stats, BD sees own.
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const admin = createAdminClient();
    const { isAdmin, supplier } = authResult;

    // Week boundaries (Monday 00:00 UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const thisMonday = new Date(now);
    thisMonday.setUTCDate(now.getUTCDate() - mondayOffset);
    thisMonday.setUTCHours(0, 0, 0, 0);

    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);

    const thisMondayISO = thisMonday.toISOString();
    const lastMondayISO = lastMonday.toISOString();

    if (isAdmin) {
      // Admin: global stats
      const [pendingRes, unassignedRes, convertedWeekRes, lastWeekRes] =
        await Promise.all([
          admin
            .from("applications")
            .select("id", { count: "exact", head: true })
            .eq("status", "PENDING"),
          admin
            .from("applications")
            .select("id", { count: "exact", head: true })
            .eq("status", "PENDING")
            .is("assigned_bd_id", null),
          admin
            .from("applications")
            .select("id", { count: "exact", head: true })
            .eq("status", "CONVERTED")
            .gte("created_at", thisMondayISO),
          admin
            .from("applications")
            .select("id", { count: "exact", head: true })
            .eq("status", "PENDING")
            .gte("created_at", lastMondayISO)
            .lt("created_at", thisMondayISO),
        ]);

      // Total this week (all statuses)
      const { count: totalThisWeek } = await admin
        .from("applications")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thisMondayISO);

      return NextResponse.json({
        pending_total: pendingRes.count ?? 0,
        unassigned_count: unassignedRes.count ?? 0,
        converted_this_week: convertedWeekRes.count ?? 0,
        total_this_week: totalThisWeek ?? 0,
        pending_last_week: lastWeekRes.count ?? 0,
      });
    }

    // BD: personal stats
    const bdId = supplier.id;
    const [pendingRes, convertedWeekRes] = await Promise.all([
      admin
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING")
        .eq("assigned_bd_id", bdId),
      admin
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "CONVERTED")
        .eq("assigned_bd_id", bdId)
        .gte("created_at", thisMondayISO),
    ]);

    const { count: totalThisWeek } = await admin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("assigned_bd_id", bdId)
      .gte("created_at", thisMondayISO);

    return NextResponse.json({
      pending_total: pendingRes.count ?? 0,
      unassigned_count: 0,
      converted_this_week: convertedWeekRes.count ?? 0,
      total_this_week: totalThisWeek ?? 0,
      pending_last_week: 0,
    });
  } catch (error) {
    console.error("[applications/stats]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
