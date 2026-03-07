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
    return NextResponse.next({ request });
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
