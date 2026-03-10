/**
 * Data Source by ID — DELETE /api/data-sources/[id]
 *
 * P1-G4: Delete a pending data source.
 * Auth: Supabase Session (supplier role, own records only)
 */

import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: supplier } = await admin
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "supplier")
      .single();

    if (!supplier) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Only allow deleting own pending records
    const { data: record } = await admin
      .from("supplier_data_sources")
      .select("id, status, file_path, supplier_id")
      .eq("id", id)
      .single();

    if (!record || record.supplier_id !== supplier.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (record.status !== "pending") {
      return NextResponse.json(
        { error: "Can only delete pending data sources" },
        { status: 400 },
      );
    }

    // Clean up storage file if exists
    if (record.file_path) {
      await admin.storage.from("data-sources").remove([record.file_path]);
    }

    await admin.from("supplier_data_sources").delete().eq("id", id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[data-sources]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
