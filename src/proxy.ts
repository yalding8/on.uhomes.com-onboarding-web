import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  checkRateLimit,
  tooManyRequestsResponse,
  attachRateLimitHeaders,
} from "@/lib/security/rate-limit";
import * as Sentry from "@sentry/nextjs";

/** Whether Upstash rate limiting is configured */
const RATE_LIMIT_ENABLED =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

export async function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Rate limit API routes and login (skip static pages)
    if (
      RATE_LIMIT_ENABLED &&
      (pathname.startsWith("/api/") || pathname.startsWith("/login"))
    ) {
      const result = await checkRateLimit(request);
      if (!result.allowed) {
        return tooManyRequestsResponse(result);
      }
      // Continue to auth middleware; attach headers to final response
      const response = await updateSession(request);
      return attachRateLimitHeaders(response, result);
    }

    // Non-API routes: skip rate limiting, proceed to auth
    return await updateSession(request);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: "proxy" },
      extra: { path: request.nextUrl.pathname },
    });
    console.error("[proxy]", error);

    // Fail-closed: deny access when auth cannot be verified.
    // Exempt public routes and webhooks that handle their own auth.
    const { pathname } = request.nextUrl;
    const isPublicRoute =
      pathname === "/" ||
      pathname === "/login" ||
      pathname.startsWith("/auth/") ||
      pathname === "/api/apply" ||
      pathname.startsWith("/api/webhooks/") ||
      pathname === "/terms" ||
      pathname === "/privacy";

    if (isPublicRoute) {
      return NextResponse.next({ request });
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 },
      );
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
