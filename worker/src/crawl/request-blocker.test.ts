import { describe, it, expect } from "vitest";
import { BLOCKED_DOMAINS, BLOCKED_RESOURCE_TYPES, shouldBlockRequest } from "./request-blocker.js";

describe("shouldBlockRequest", () => {
  it("should block Google Analytics requests", () => {
    expect(shouldBlockRequest("https://www.google-analytics.com/analytics.js", "script")).toBe(true);
    expect(shouldBlockRequest("https://www.googletagmanager.com/gtm.js", "script")).toBe(true);
  });

  it("should block Facebook tracking", () => {
    expect(shouldBlockRequest("https://connect.facebook.net/en_US/fbevents.js", "script")).toBe(true);
  });

  it("should block ad networks", () => {
    expect(shouldBlockRequest("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", "script")).toBe(true);
    expect(shouldBlockRequest("https://ad.doubleclick.net/some-ad", "xhr")).toBe(true);
  });

  it("should block font requests by resource type", () => {
    expect(shouldBlockRequest("https://example.com/font.woff2", "font")).toBe(true);
  });

  it("should block media requests by resource type", () => {
    expect(shouldBlockRequest("https://example.com/video.mp4", "media")).toBe(true);
  });

  it("should NOT block apartment site HTML/API requests", () => {
    expect(shouldBlockRequest("https://555ten.com/api/units", "xhr")).toBe(false);
    expect(shouldBlockRequest("https://555ten.com/", "document")).toBe(false);
    expect(shouldBlockRequest("https://555ten.com/assets/main.js", "script")).toBe(false);
  });

  it("should NOT block images (needed for extraction)", () => {
    expect(shouldBlockRequest("https://example.com/hero.jpg", "image")).toBe(false);
  });

  it("should export blocklist arrays for extensibility", () => {
    expect(Array.isArray(BLOCKED_DOMAINS)).toBe(true);
    expect(BLOCKED_DOMAINS.length).toBeGreaterThan(5);
    expect(Array.isArray(BLOCKED_RESOURCE_TYPES)).toBe(true);
    expect(BLOCKED_RESOURCE_TYPES).toContain("font");
  });
});
