import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelDeletion } from "@/lib/compliance/account-deletion";

/**
 * POST /api/account/cancel-deletion
 * Cancel a pending account deletion during the 30-day cooling period.
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

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  if (supplier.status !== "DELETION_PENDING") {
    return NextResponse.json(
      { error: "No pending deletion to cancel" },
      { status: 400 },
    );
  }

  try {
    await cancelDeletion(supabase, supplier.id);
    return NextResponse.json({
      success: true,
      message: "Account deletion has been cancelled",
    });
  } catch (error) {
    console.error("[cancel-deletion]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
