import { describe, it, expect } from "vitest";
import { buildResult } from "./result-builder.js";
import type { SiteProfile } from "../crawl/site-probe.js";

const mockProfile: SiteProfile = {
  type: "spa",
  framework: "react",
  cloudflareLevel: "none",
  cloudflareProtected: false,
  hasJsonLd: true,
  hasOpenGraph: true,
  estimatedComplexity: "moderate",
  httpStatus: 200,
  redirectUrl: null,
  contentType: "text/html",
};

describe("buildResult", () => {
  it("should calculate tier A coverage", () => {
    const result = buildResult({
      fields: {
        building_name: { value: "Test", confidence: "high" },
        city: { value: "Austin", confidence: "high" },
        country: { value: "US", confidence: "high" },
      },
      sourceUrl: "https://example.com",
      profile: mockProfile,
      strategy: "standard",
      llmSkipped: false,
      llmProvider: "auto",
      validationIssues: 0,
      llmValQuality: "skipped",
      llmValAdj: 0,
      llmValRem: 0,
      timings: { probe: 100, scrape: 500, llm: 0 },
      totalStart: Date.now() - 1000,
    });

    // 3 out of 8 Tier A fields
    expect(result.meta.tierACoverageRatio).toBeCloseTo(3 / 8);
    expect(result.meta.totalFieldCount).toBe(3);
    expect(result.meta.confidenceHigh).toBe(3);
  });

  it("should calculate tier B coverage", () => {
    const result = buildResult({
      fields: {
        price_min: { value: 1200, confidence: "medium" },
        price_max: { value: 3000, confidence: "medium" },
        cover_image: { value: "https://img.jpg", confidence: "low" },
      },
      sourceUrl: "https://example.com",
      profile: mockProfile,
      strategy: "lightweight",
      llmSkipped: true,
      llmProvider: null,
      validationIssues: 1,
      llmValQuality: "skipped",
      llmValAdj: 0,
      llmValRem: 0,
      timings: { probe: 50, scrape: 200, llm: 0 },
      totalStart: Date.now() - 500,
    });

    // 3 out of 10 Tier B fields
    expect(result.meta.tierBCoverageRatio).toBeCloseTo(3 / 10);
    expect(result.meta.tierACoverageRatio).toBe(0);
    expect(result.meta.confidenceMedium).toBe(2);
    expect(result.meta.confidenceLow).toBe(1);
  });

  it("should extract domain from URL", () => {
    const result = buildResult({
      fields: {},
      sourceUrl: "https://www.example.com/path",
      profile: mockProfile,
      strategy: "standard",
      llmSkipped: true,
      llmProvider: null,
      validationIssues: 0,
      llmValQuality: "skipped",
      llmValAdj: 0,
      llmValRem: 0,
      timings: { probe: 0, scrape: 0, llm: 0 },
      totalStart: Date.now(),
    });

    expect(result.meta.urlDomain).toBe("www.example.com");
  });

  it("should handle zero fields gracefully", () => {
    const result = buildResult({
      fields: {},
      sourceUrl: "https://example.com",
      profile: mockProfile,
      strategy: "standard",
      llmSkipped: false,
      llmProvider: "auto",
      validationIssues: 0,
      llmValQuality: "skipped",
      llmValAdj: 0,
      llmValRem: 0,
      timings: { probe: 0, scrape: 0, llm: 0 },
      totalStart: Date.now(),
    });

    expect(result.meta.fieldCoverageRatio).toBe(0);
    expect(result.meta.tierACoverageRatio).toBe(0);
    expect(result.meta.tierBCoverageRatio).toBe(0);
    expect(result.meta.totalFieldCount).toBe(0);
  });
});
