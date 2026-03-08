/**
 * Supplier Notes API
 *
 * GET  /api/admin/suppliers/[supplierId]/notes — List notes
 * POST /api/admin/suppliers/[supplierId]/notes — Add a note
 *
 * Auth: Session-based, BD role required.
 *   - Admin: can view/add notes on any supplier
 *   - BD: can view/add notes only on suppliers assigned to them
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ supplierId: string }>;
}

const noteSchema = z.object({
  content: z.string().trim().min(1, "Content is required").max(2000),
});

/** Check if the BD has access to this supplier */
async function checkAccess(
  supplierId: string,
  bdId: string,
  isAdmin: boolean,
): Promise<{ allowed: boolean; exists: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("suppliers")
    .select("id, bd_user_id")
    .eq("id", supplierId)
    .single();

  if (error || !data) return { allowed: false, exists: false };
  if (isAdmin) return { allowed: true, exists: true };
  return { allowed: data.bd_user_id === bdId, exists: true };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const { supplierId } = await context.params;
    const access = await checkAccess(
      supplierId,
      authResult.supplier.id,
      authResult.isAdmin,
    );

    if (!access.exists) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: notes, error } = await admin
      .from("supplier_notes")
      .select("id, author_email, content, created_at")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[supplier-notes] fetch error", error);
      return NextResponse.json(
        { error: "Failed to fetch notes" },
        { status: 500 },
      );
    }

    return NextResponse.json({ notes: notes ?? [] });
  } catch (error) {
    console.error("[supplier-notes]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const { supplierId } = await context.params;
    const access = await checkAccess(
      supplierId,
      authResult.supplier.id,
      authResult.isAdmin,
    );

    if (!access.exists) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: note, error } = await admin
      .from("supplier_notes")
      .insert({
        supplier_id: supplierId,
        author_id: authResult.supplier.id,
        author_email: authResult.supplier.contact_email,
        content: parsed.data.content,
      })
      .select("id, author_email, content, created_at")
      .single();

    if (error) {
      console.error("[supplier-notes] insert error", error);
      return NextResponse.json(
        { error: "Failed to add note" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (error) {
    console.error("[supplier-notes]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
