import { describe, it, expect } from "vitest";
import { getTimeouts } from "./page-helpers.js";
import type { SiteProfile } from "./site-probe.js";

function makeProfile(overrides: Partial<SiteProfile> = {}): SiteProfile {
  return {
    type: "unknown",
    framework: "unknown",
    cloudflareLevel: "none",
    cloudflareProtected: false,
    hasJsonLd: false,
    hasOpenGraph: false,
    estimatedComplexity: "moderate",
    httpStatus: 200,
    redirectUrl: null,
    contentType: "text/html",
    ...overrides,
  };
}

describe("getTimeouts", () => {
  it("should give static sites the shortest navigation timeout", () => {
    const t = getTimeouts(makeProfile({ type: "static" }));
    expect(t.navigation).toBeLessThanOrEqual(15_000);
  });

  it("should give wordpress sites longer timeout than static", () => {
    const wp = getTimeouts(makeProfile({ type: "wordpress" }));
    const st = getTimeouts(makeProfile({ type: "static" }));
    expect(wp.navigation).toBeGreaterThan(st.navigation);
  });

  it("should give SPA sites at least 45s navigation timeout", () => {
    const t = getTimeouts(makeProfile({ type: "spa" }));
    expect(t.navigation).toBeGreaterThanOrEqual(45_000);
  });

  it("should give platform_template at least 40s navigation timeout", () => {
    const t = getTimeouts(makeProfile({ type: "platform_template" }));
    expect(t.navigation).toBeGreaterThanOrEqual(40_000);
  });

  it("should give unknown sites the same as SPA (worst case)", () => {
    const unknown = getTimeouts(makeProfile({ type: "unknown" }));
    const spa = getTimeouts(makeProfile({ type: "spa" }));
    expect(unknown.navigation).toBe(spa.navigation);
  });
});
