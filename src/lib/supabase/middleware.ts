import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // IMPORTANT: We must pass cookie reading and writing to Supabase SSR Client
  // to ensure session persists and cookies are updated when refreshing tokens.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // CRITICAL: Must use getUser(), NOT getSession() to securely validate session server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Legal pages are always accessible regardless of auth state
  if (pathname === "/terms" || pathname === "/privacy") {
    return supabaseResponse;
  }

  // Protected Routes & role-based + 3-stage user state resolution rules
  if (user) {
    // Query suppliers table for role and status (Requirements 1.5)
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("status, role")
      .eq("user_id", user.id)
      .single();

    const role = supplier?.role || "supplier";
    const status = supplier?.status || "NEW";

    // BD role routing (Requirements 1.1, 1.2)
    if (role === "bd") {
      if (
        !pathname.startsWith("/admin") &&
        !pathname.startsWith("/auth") &&
        !pathname.startsWith("/api/")
      ) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      // Allow /admin/*, /auth/*, /api/* to pass through
      return supabaseResponse;
    }

    // Non-BD users cannot access /admin (Requirements 1.3)
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // --- Original 3-stage supplier routing (unchanged) ---

    // Condition 1: SIGNED User -> Can access /dashboard and /onboarding/*
    // Redirect to /dashboard if visiting / or /login
    if (status === "SIGNED") {
      if (pathname === "/" || pathname.startsWith("/login")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      // Allow /dashboard, /onboarding/*, /auth/* to pass through
    }

    // Condition 2: PENDING_CONTRACT -> Redirect to /dashboard if trying to access other pages
    // This also catches logged-in users hitting /login — they should go to /dashboard
    if (
      status === "PENDING_CONTRACT" &&
      pathname !== "/dashboard" &&
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/api/")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Condition 3: NEW User — check if they have submitted an application
    if (status === "NEW") {
      const admin = createAdminClient();
      const { data: apps } = await admin
        .from("applications")
        .select("id")
        .eq("contact_email", user.email ?? "")
        .limit(1);
      const hasApplication = (apps?.length ?? 0) > 0;

      if (hasApplication) {
        // Has application → route to /dashboard
        if (
          pathname !== "/dashboard" &&
          !pathname.startsWith("/auth") &&
          !pathname.startsWith("/api/")
        ) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      } else {
        // No application → route to / (Landing Page)
        if (
          pathname !== "/" &&
          !pathname.startsWith("/auth") &&
          !pathname.startsWith("/api/")
        ) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }
    }
  } else {
    // Unauthenticated access policies
    // Let public pages flow (landing page, login page, and api auth endpoints)
    // Unauthenticated users accessing /admin/* are redirected to /login (Requirements 1.4)
    const isPublicRoute =
      pathname === "/" ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api/") ||
      pathname === "/terms" ||
      pathname === "/privacy";
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return supabaseResponse;
}
