import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkDeletionEligibility,
  markForDeletion,
} from "@/lib/compliance/account-deletion";

/**
 * POST /api/account/delete
 * Request account deletion (starts 30-day cooling period).
 * Auth: Session (supplier only)
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get supplier record
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  if (supplier.status === "DELETION_PENDING") {
    return NextResponse.json(
      { error: "Account deletion already in progress" },
      { status: 409 },
    );
  }

  // Pre-check: active bookings or unsettled commissions
  const check = await checkDeletionEligibility(supabase, supplier.id);

  if (!check.canDelete) {
    return NextResponse.json(
      { error: "Cannot delete account", blockers: check.blockers },
      { status: 422 },
    );
  }

  // Mark for deletion (30-day cooling period)
  const result = await markForDeletion(supabase, supplier.id);

  return NextResponse.json({
    message: "Account marked for deletion",
    deletionDate: result.deletionDate,
    cooldownDays: 30,
  });
}
