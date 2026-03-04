/**
 * S5.1 Rate Limiting — Unit Tests
 * Test IDs: S5-U01, S5-U02, S5-U03
 *
 * Tests the pure functions: matchRule, extractKey, tooManyRequestsResponse.
 * Actual Redis calls are mocked at the Ratelimit layer.
 */
import { describe, it, expect } from "vitest";
import {
  matchRule,
  extractKey,
  tooManyRequestsResponse,
  attachRateLimitHeaders,
  type RateLimitResult,
} from "../rate-limit";
import { NextRequest, NextResponse } from "next/server";

// Helper: create a minimal NextRequest from pathname + headers
function makeRequest(
  pathname: string,
  headers: Record<string, string> = {},
): NextRequest {
  const url = new URL(pathname, "https://on.uhomes.com");
  return new NextRequest(url, { headers });
}

describe("matchRule", () => {
  it("matches /api/apply to apply rule (5/15min)", () => {
    const { rule, keyBy, label } = matchRule("/api/apply");
    expect(rule.limit).toBe(5);
    expect(rule.window).toBe("15 m");
    expect(rule.prefix).toBe("rl:apply");
    expect(keyBy).toBe("ip");
    expect(label).toBe("Public application form");
  });

  it("matches /login to OTP rule (3/5min)", () => {
    const { rule, keyBy } = matchRule("/login");
    expect(rule.limit).toBe(3);
    expect(rule.window).toBe("5 m");
    expect(keyBy).toBe("ip");
  });

  it("matches /api/extraction/trigger to extraction rule (10/hr)", () => {
    const { rule } = matchRule("/api/extraction/trigger");
    expect(rule.limit).toBe(10);
    expect(rule.window).toBe("1 h");
  });

  it("matches /api/buildings/uuid/fields to fields rule (60/min)", () => {
    const { rule } = matchRule(
      "/api/buildings/550e8400-e29b-41d4-a716-446655440000/fields",
    );
    expect(rule.limit).toBe(60);
    expect(rule.window).toBe("1 m");
  });

  it("matches /api/webhooks/docusign to webhooks rule (100/min)", () => {
    const { rule } = matchRule("/api/webhooks/docusign");
    expect(rule.limit).toBe(100);
    expect(rule.window).toBe("1 m");
  });

  it("falls back to default rule (120/min) for unknown paths", () => {
    const { rule, label } = matchRule("/api/admin/some-action");
    expect(rule.limit).toBe(120);
    expect(rule.window).toBe("1 m");
    expect(label).toBe("Default API");
  });
});

describe("extractKey", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const req = makeRequest("/api/apply", {
      "x-forwarded-for": "203.0.113.50, 70.41.3.18",
    });
    expect(extractKey(req, "ip")).toBe("203.0.113.50");
  });

  it("extracts IP from x-real-ip when x-forwarded-for is absent", () => {
    const req = makeRequest("/api/apply", { "x-real-ip": "10.0.0.1" });
    expect(extractKey(req, "ip")).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no IP header present", () => {
    const req = makeRequest("/api/apply");
    expect(extractKey(req, "ip")).toBe("unknown");
  });

  it("falls back to IP for user/supplier/email keyBy", () => {
    const req = makeRequest("/api/buildings/x/fields", {
      "x-forwarded-for": "192.168.1.1",
    });
    // Before auth resolution, middleware uses IP as key
    expect(extractKey(req, "user")).toBe("192.168.1.1");
    expect(extractKey(req, "supplier")).toBe("192.168.1.1");
  });
});

describe("tooManyRequestsResponse", () => {
  it("returns 429 with Retry-After header", () => {
    const result: RateLimitResult = {
      allowed: false,
      limit: 5,
      remaining: 0,
      retryAfterMs: 120_000, // 2 minutes
    };
    const resp = tooManyRequestsResponse(result);
    expect(resp.status).toBe(429);
    expect(resp.headers.get("Retry-After")).toBe("120");
    expect(resp.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(resp.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("rounds Retry-After up to next second", () => {
    const result: RateLimitResult = {
      allowed: false,
      limit: 3,
      remaining: 0,
      retryAfterMs: 500, // 0.5 seconds → ceil to 1
    };
    const resp = tooManyRequestsResponse(result);
    expect(resp.headers.get("Retry-After")).toBe("1");
  });
});

describe("attachRateLimitHeaders", () => {
  it("adds rate limit headers to successful response", () => {
    const response = NextResponse.json({ ok: true });
    const result: RateLimitResult = {
      allowed: true,
      limit: 120,
      remaining: 115,
      retryAfterMs: 0,
    };
    const updated = attachRateLimitHeaders(response, result);
    expect(updated.headers.get("X-RateLimit-Limit")).toBe("120");
    expect(updated.headers.get("X-RateLimit-Remaining")).toBe("115");
  });
});
