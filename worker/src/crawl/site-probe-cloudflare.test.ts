/**
 * site-probe.ts Cloudflare 检测增强 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { probeSite } from "./site-probe.js";

function htmlResponseWithHeaders(
  html: string,
  headers: Record<string, string>,
  status = 200,
) {
  return {
    status,
    url: "https://example.com",
    headers: new Headers({
      "content-type": "text/html",
      ...headers,
    }),
    text: () => Promise.resolve(html),
  };
}

const BASIC_HTML = `<html><body><p>Apartment content here with enough text.</p></body></html>`;

describe("probeSite — Cloudflare detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect Cloudflare by cf-ray header", async () => {
    mockFetch.mockResolvedValue(
      htmlResponseWithHeaders(BASIC_HTML, {
        "cf-ray": "abc123-IAD",
        server: "cloudflare",
      }),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.cloudflareProtected).toBe(true);
  });

  it("should set cloudflareLevel to none when no CF headers", async () => {
    mockFetch.mockResolvedValue(
      htmlResponseWithHeaders(BASIC_HTML, { server: "nginx" }),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.cloudflareProtected).toBe(false);
    expect(profile.cloudflareLevel).toBe("none");
  });

  it("should detect free tier (cf-ray only)", async () => {
    mockFetch.mockResolvedValue(
      htmlResponseWithHeaders(BASIC_HTML, {
        "cf-ray": "abc123-IAD",
        server: "cloudflare",
      }),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.cloudflareProtected).toBe(true);
    expect(profile.cloudflareLevel).toBe("free");
  });

  it("should detect pro+ tier with cf-mitigated header", async () => {
    mockFetch.mockResolvedValue(
      htmlResponseWithHeaders(BASIC_HTML, {
        "cf-ray": "abc123-IAD",
        server: "cloudflare",
        "cf-mitigated": "challenge",
      }),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.cloudflareProtected).toBe(true);
    expect(["pro", "business", "enterprise"]).toContain(
      profile.cloudflareLevel,
    );
  });

  it("should set defaults when fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const profile = await probeSite("https://unreachable.com");
    expect(profile.cloudflareProtected).toBe(false);
    expect(profile.cloudflareLevel).toBe("none");
  });

  it("should detect Cloudflare by server header alone", async () => {
    mockFetch.mockResolvedValue(
      htmlResponseWithHeaders(BASIC_HTML, { server: "cloudflare" }),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.cloudflareProtected).toBe(true);
  });
});
