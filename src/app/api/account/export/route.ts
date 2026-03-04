import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportSupplierData } from "@/lib/compliance/data-export";

/**
 * GET /api/account/export
 * Export all personal data (GDPR Data Portability).
 * Auth: Session (supplier only)
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, contact_email")
    .eq("user_id", user.id)
    .single();

  if (!supplier) {
    return NextResponse.json(
      { error: "Supplier not found" },
      { status: 404 },
    );
  }

  const exportData = await exportSupplierData(
    supabase,
    supplier.id,
    supplier.contact_email,
  );

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="uhomes-data-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
