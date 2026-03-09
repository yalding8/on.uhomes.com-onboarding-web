/**
 * Mark Notification as Read — PATCH /api/notifications/[notificationId]/read
 *
 * Auth: Supabase Session. RLS ensures ownership.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ notificationId: string }>;
}

export async function PATCH(_request: Request, { params }: RouteParams) {
  try {
    const { notificationId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      console.error("[notification-read]", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[notification-read]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
