/**
 * 管线验证脚本 — 用真实公寓网站 URL 端到端测试提取管线
 *
 * 使用方式:
 *   # 测试所有 fixture 站点
 *   npx tsx tests/benchmarks/verify-pipeline.ts
 *
 *   # 测试单个 URL
 *   npx tsx tests/benchmarks/verify-pipeline.ts https://example.com/apartments
 *
 * 环境变量 (至少配一个 LLM provider):
 *   QWEN_API_KEY / DEEPSEEK_API_KEY / KIMI_API_KEY / MINIMAX_API_KEY
 */

import { probeSite } from "../../src/crawl/site-probe.js";
import { scrapePage } from "../../src/crawl/scraper.js";
import { mapStructuredData } from "../../src/extractors/structured-data-mapper.js";
import { mapOpenGraphData } from "../../src/extractors/og-mapper.js";
import { validateFields } from "../../src/validators/field-validator.js";
import { shutdownBrowser } from "../../src/crawl/browser.js";
import type { ExtractedFields } from "../../src/types.js";

interface SiteFixture {
  id: string;
  category: string;
  url: string;
  description: string;
  expectedSiteType: string;
}

interface PipelineResult {
  siteId: string;
  url: string;
  success: boolean;
  error?: string;
  timings: {
    probeMs: number;
    scrapeMs: number;
    structuredMapMs: number;
    totalMs: number;
  };
  siteProfile: {
    type: string;
    framework: string;
    complexity: string;
    hasJsonLd: boolean;
    hasOpenGraph: boolean;
  };
  extraction: {
    jsonLdFieldCount: number;
    ogFieldCount: number;
    totalFieldCount: number;
    coverageRatio: number;
    llmNeeded: boolean;
    validationIssues: number;
  };
  fields: ExtractedFields;
}

const SKIP_LLM_COVERAGE = 0.8;

async function testSingleUrl(
  url: string,
  siteId: string,
): Promise<PipelineResult> {
  const totalStart = Date.now();

  const result: PipelineResult = {
    siteId,
    url,
    success: false,
    timings: { probeMs: 0, scrapeMs: 0, structuredMapMs: 0, totalMs: 0 },
    siteProfile: {
      type: "unknown",
      framework: "unknown",
      complexity: "moderate",
      hasJsonLd: false,
      hasOpenGraph: false,
    },
    extraction: {
      jsonLdFieldCount: 0,
      ogFieldCount: 0,
      totalFieldCount: 0,
      coverageRatio: 0,
      llmNeeded: true,
      validationIssues: 0,
    },
    fields: {},
  };

  try {
    // 1. Site Probe
    const probeStart = Date.now();
    const profile = await probeSite(url);
    result.timings.probeMs = Date.now() - probeStart;
    result.siteProfile = {
      type: profile.type,
      framework: profile.framework,
      complexity: profile.estimatedComplexity,
      hasJsonLd: profile.hasJsonLd,
      hasOpenGraph: profile.hasOpenGraph,
    };

    // 2. Scrape
    const scrapeStart = Date.now();
    const scraped = await scrapePage(url, { siteProfile: profile });
    result.timings.scrapeMs = Date.now() - scrapeStart;

    // 3. Structured Data Mapping
    const mapStart = Date.now();
    let mergedFields: ExtractedFields = {};

    if (scraped.jsonLd.length > 0) {
      const structured = mapStructuredData(scraped.jsonLd);
      mergedFields = { ...structured.fields };
      result.extraction.jsonLdFieldCount = structured.coveredCount;
      result.extraction.coverageRatio = structured.coverageRatio;
      result.extraction.llmNeeded =
        structured.coverageRatio < SKIP_LLM_COVERAGE;
    }

    // 4. OpenGraph
    const ogFields = mapOpenGraphData(scraped.openGraph);
    let ogAdded = 0;
    for (const [key, value] of Object.entries(ogFields)) {
      if (!mergedFields[key]) {
        mergedFields[key] = value;
        ogAdded++;
      }
    }
    result.extraction.ogFieldCount = ogAdded;
    result.timings.structuredMapMs = Date.now() - mapStart;

    // 5. Validate
    const validated = validateFields(mergedFields);
    result.extraction.validationIssues = validated.issues.length;
    result.fields = validated.fields;
    result.extraction.totalFieldCount = Object.keys(validated.fields).length;
    result.success = true;
  } catch (err) {
    result.error = (err as Error).message;
  }

  result.timings.totalMs = Date.now() - totalStart;
  return result;
}

function printResult(r: PipelineResult): void {
  const divider = "─".repeat(60);
  console.log(`\n${divider}`);
  console.log(`  ${r.siteId} | ${r.url}`);
  console.log(divider);

  if (!r.success) {
    console.log(`  STATUS: FAILED — ${r.error}`);
    return;
  }

  console.log(`  STATUS: OK`);
  console.log(
    `  Site:   ${r.siteProfile.type} | ${r.siteProfile.framework} | ${r.siteProfile.complexity}`,
  );
  console.log(
    `  Detect: JSON-LD=${r.siteProfile.hasJsonLd} OG=${r.siteProfile.hasOpenGraph}`,
  );
  console.log(
    `  Fields: JSON-LD=${r.extraction.jsonLdFieldCount} OG=${r.extraction.ogFieldCount} Total=${r.extraction.totalFieldCount}`,
  );
  console.log(
    `  Coverage: ${(r.extraction.coverageRatio * 100).toFixed(0)}% | LLM needed: ${r.extraction.llmNeeded}`,
  );
  console.log(`  Issues: ${r.extraction.validationIssues}`);
  console.log(
    `  Timing: probe=${r.timings.probeMs}ms scrape=${r.timings.scrapeMs}ms map=${r.timings.structuredMapMs}ms total=${r.timings.totalMs}ms`,
  );

  // Print extracted fields
  console.log(`  ── Extracted Fields ──`);
  const sorted = Object.entries(r.fields).sort(
    ([, a], [, b]) =>
      confidenceOrder(a.confidence) - confidenceOrder(b.confidence),
  );
  for (const [key, field] of sorted) {
    const val =
      typeof field.value === "string" && field.value.length > 60
        ? field.value.slice(0, 60) + "..."
        : Array.isArray(field.value)
          ? `[${field.value.length} items]`
          : field.value;
    const icon =
      field.confidence === "high"
        ? "H"
        : field.confidence === "medium"
          ? "M"
          : "L";
    console.log(`    [${icon}] ${key}: ${val}`);
  }
}

function confidenceOrder(c: string): number {
  return c === "high" ? 0 : c === "medium" ? 1 : 2;
}

function printSummary(results: PipelineResult[]): void {
  console.log("\n" + "=".repeat(60));
  console.log("  SUMMARY");
  console.log("=".repeat(60));

  const ok = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(
    `  Total: ${results.length} | OK: ${ok.length} | Failed: ${failed.length}`,
  );

  if (ok.length > 0) {
    const avgFields =
      ok.reduce((sum, r) => sum + r.extraction.totalFieldCount, 0) / ok.length;
    const avgTime =
      ok.reduce((sum, r) => sum + r.timings.totalMs, 0) / ok.length;
    const skippedLlm = ok.filter((r) => !r.extraction.llmNeeded).length;

    console.log(`  Avg fields: ${avgFields.toFixed(1)}`);
    console.log(`  Avg time: ${(avgTime / 1000).toFixed(1)}s`);
    console.log(
      `  LLM skippable: ${skippedLlm}/${ok.length} (${((skippedLlm / ok.length) * 100).toFixed(0)}%)`,
    );

    // Per site type breakdown
    const byType = new Map<string, PipelineResult[]>();
    for (const r of ok) {
      const type = r.siteProfile.type;
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(r);
    }
    console.log(`  ── By Site Type ──`);
    for (const [type, items] of byType) {
      const avg =
        items.reduce((s, r) => s + r.extraction.totalFieldCount, 0) /
        items.length;
      console.log(
        `    ${type}: ${items.length} sites, avg ${avg.toFixed(1)} fields`,
      );
    }
  }

  if (failed.length > 0) {
    console.log(`  ── Failures ──`);
    for (const r of failed) {
      console.log(`    ${r.siteId}: ${r.error}`);
    }
  }
}

async function main() {
  const customUrl = process.argv[2];

  let sites: SiteFixture[];

  if (customUrl) {
    sites = [
      {
        id: "custom",
        category: "unknown",
        url: customUrl,
        description: "Custom URL",
        expectedSiteType: "unknown",
      },
    ];
  } else {
    const fixtureData = await import("./fixtures/sample-sites.json", {
      with: { type: "json" },
    });
    sites = fixtureData.default.sites as SiteFixture[];
  }

  console.log(
    `\nVerifying extraction pipeline with ${sites.length} site(s)...\n`,
  );
  console.log(`NOTE: This test runs WITHOUT LLM — only site probe,`);
  console.log(`scraping, JSON-LD mapping, OpenGraph, and validation.`);
  console.log(
    `To test full LLM extraction, use the Worker /extract endpoint.\n`,
  );

  const results: PipelineResult[] = [];

  for (const site of sites) {
    console.log(`Testing: ${site.id} (${site.url})...`);
    const r = await testSingleUrl(site.url, site.id);
    results.push(r);
    printResult(r);
  }

  printSummary(results);

  // Cleanup
  await shutdownBrowser();
  process.exit(results.every((r) => r.success) ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
