/**
 * Application Notes API
 *
 * GET  /api/admin/applications/[applicationId]/notes — List notes
 * POST /api/admin/applications/[applicationId]/notes — Add a note
 *
 * Auth: Session-based, BD role required.
 *   - Admin: can view/add notes on any application
 *   - BD: can view/add notes only on applications assigned to them
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ applicationId: string }>;
}

const noteSchema = z.object({
  content: z.string().trim().min(1, "Content is required").max(2000),
});

/** Check if the BD has access to this application */
async function checkAccess(
  applicationId: string,
  bdId: string,
  isAdmin: boolean,
): Promise<{ allowed: boolean; exists: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applications")
    .select("id, assigned_bd_id")
    .eq("id", applicationId)
    .single();

  if (error || !data) return { allowed: false, exists: false };
  if (isAdmin) return { allowed: true, exists: true };
  return { allowed: data.assigned_bd_id === bdId, exists: true };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const { applicationId } = await context.params;
    const access = await checkAccess(
      applicationId,
      authResult.supplier.id,
      authResult.isAdmin,
    );

    if (!access.exists) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: notes, error } = await admin
      .from("application_notes")
      .select("id, author_email, content, created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[application-notes] fetch error", error);
      return NextResponse.json(
        { error: "Failed to fetch notes" },
        { status: 500 },
      );
    }

    return NextResponse.json({ notes: notes ?? [] });
  } catch (error) {
    console.error("[application-notes]", error);
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

    const { applicationId } = await context.params;
    const access = await checkAccess(
      applicationId,
      authResult.supplier.id,
      authResult.isAdmin,
    );

    if (!access.exists) {
      return NextResponse.json(
        { error: "Application not found" },
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
      .from("application_notes")
      .insert({
        application_id: applicationId,
        author_id: authResult.supplier.id,
        author_email: authResult.supplier.contact_email,
        content: parsed.data.content,
      })
      .select("id, author_email, content, created_at")
      .single();

    if (error) {
      console.error("[application-notes] insert error", error);
      return NextResponse.json(
        { error: "Failed to add note" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (error) {
    console.error("[application-notes]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
