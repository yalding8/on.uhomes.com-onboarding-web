/**
 * Notifications API — GET /api/notifications
 *
 * Returns the logged-in user's notifications (newest first, max 50).
 * Auth: Supabase Session.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id, title, body, category, is_read, link, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[notifications]", error);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 },
      );
    }

    const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

    return NextResponse.json({
      notifications: notifications ?? [],
      unreadCount,
    });
  } catch (error) {
    console.error("[notifications]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
