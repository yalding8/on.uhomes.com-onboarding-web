/**
 * Supplier Notes (Supplier-Facing) — GET /api/suppliers/notes
 *
 * Returns BD notes visible to the logged-in supplier (read-only).
 * Auth: Supabase Session (supplier role).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find supplier record for this user
    const { data: supplier, error: supplierErr } = await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (supplierErr || !supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }

    const admin = createAdminClient();
    const { data: notes, error } = await admin
      .from("supplier_notes")
      .select("id, author_email, content, created_at")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[supplier-notes-read]", error);
      return NextResponse.json(
        { error: "Failed to fetch notes" },
        { status: 500 },
      );
    }

    return NextResponse.json({ notes: notes ?? [] });
  } catch (error) {
    console.error("[supplier-notes-read]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
