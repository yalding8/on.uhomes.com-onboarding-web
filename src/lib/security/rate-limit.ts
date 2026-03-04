import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

/** Upstash Redis client — reads UPSTASH_REDIS_REST_URL + TOKEN from env */
function getRedis(): Redis {
  return Redis.fromEnv();
}

type RateLimitRule = {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration string, e.g. "15 m", "5 m", "1 h", "1 m" */
  window: `${number} ${"s" | "m" | "h" | "d"}`;
  /** Key prefix for Redis namespace isolation */
  prefix: string;
};

/**
 * Rate limit rules per endpoint pattern.
 * Checked in order — first match wins.
 */
export const RATE_LIMIT_RULES: Array<{
  /** RegExp pattern to match pathname */
  pattern: RegExp;
  /** Human-readable description */
  label: string;
  rule: RateLimitRule;
  /** Key extraction strategy */
  keyBy: "ip" | "email" | "user" | "supplier";
}> = [
  {
    pattern: /^\/api\/apply$/,
    label: "Public application form",
    rule: { limit: 5, window: "15 m", prefix: "rl:apply" },
    keyBy: "ip",
  },
  {
    pattern: /^\/login/,
    label: "OTP login",
    rule: { limit: 3, window: "5 m", prefix: "rl:otp" },
    keyBy: "ip",
  },
  {
    pattern: /^\/api\/extraction\//,
    label: "Extraction triggers",
    rule: { limit: 10, window: "1 h", prefix: "rl:extraction" },
    keyBy: "user",
  },
  {
    pattern: /^\/api\/buildings\/[^/]+\/fields$/,
    label: "Building field updates",
    rule: { limit: 60, window: "1 m", prefix: "rl:fields" },
    keyBy: "user",
  },
  {
    pattern: /^\/api\/webhooks\//,
    label: "Webhook endpoints",
    rule: { limit: 100, window: "1 m", prefix: "rl:webhooks" },
    keyBy: "ip",
  },
];

/** Default catch-all rule for any other API route */
export const DEFAULT_RULE: RateLimitRule = {
  limit: 120,
  window: "1 m",
  prefix: "rl:default",
};

/**
 * Find the matching rate limit rule for a given pathname.
 * Returns the first match or the default rule.
 */
export function matchRule(pathname: string): {
  rule: RateLimitRule;
  keyBy: "ip" | "email" | "user" | "supplier";
  label: string;
} {
  for (const entry of RATE_LIMIT_RULES) {
    if (entry.pattern.test(pathname)) {
      return { rule: entry.rule, keyBy: entry.keyBy, label: entry.label };
    }
  }
  return { rule: DEFAULT_RULE, keyBy: "ip", label: "Default API" };
}

/**
 * Extract the rate-limit identifier from the request.
 */
export function extractKey(
  request: NextRequest,
  keyBy: "ip" | "email" | "user" | "supplier",
): string {
  if (keyBy === "ip") {
    return (
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"
    );
  }
  // For user/supplier/email, fall back to IP when no auth info available.
  // The actual user ID is resolved after Supabase session validation,
  // which happens downstream. Middleware uses IP as best-effort key.
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Create an Upstash Ratelimit instance for a given rule */
export function createLimiter(rule: RateLimitRule): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
    prefix: rule.prefix,
    analytics: true,
  });
}

/** Result of a rate limit check */
export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
};

/**
 * Check rate limit for a request.
 * Returns whether the request is allowed and metadata.
 */
export async function checkRateLimit(
  request: NextRequest,
): Promise<RateLimitResult> {
  const { pathname } = request.nextUrl;
  const { rule, keyBy } = matchRule(pathname);
  const key = extractKey(request, keyBy);
  const limiter = createLimiter(rule);

  const result = await limiter.limit(key);

  return {
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    retryAfterMs: result.success ? 0 : result.reset - Date.now(),
  };
}

/**
 * Build a 429 Too Many Requests response with standard headers.
 */
export function tooManyRequestsResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      retryAfterSeconds: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

/**
 * Attach rate-limit headers to a successful response.
 */
export function attachRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}
