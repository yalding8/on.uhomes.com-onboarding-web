import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // IMPORTANT: We must pass cookie reading and writing to Supabase SSR Client
  // to ensure session persists and cookies are updated when refreshing tokens.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );

  // CRITICAL: Must use getUser(), NOT getSession() to securely validate session server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected Routes & 3-stage user state resolution rules
  if (user) {
    // Attempt to query the suppliers table for this user id
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("status")
      .eq("user_id", user.id)
      .single();

    const status = supplier?.status || "NEW";

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
      !pathname.startsWith("/auth")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Condition 3: NEW User -> Redirect to / (Landing Page) if they try to access internal pages
    // This also catches logged-in NEW users hitting /login — they should go to /
    if (status === "NEW" && pathname !== "/" && !pathname.startsWith("/auth")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } else {
    // Unauthenticated access policies
    // Let public pages flow (landing page, login page, and api auth endpoints)
    const isPublicRoute =
      pathname === "/" ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api/");
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return supabaseResponse;
}
