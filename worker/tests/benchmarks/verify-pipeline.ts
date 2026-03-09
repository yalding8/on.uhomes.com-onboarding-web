/**
 * 管线验证脚本 — 用真实公寓网站 URL 端到端测试提取管线
 *
 * 使用方式:
 *   # 仅结构化数据（不调用 LLM）
 *   npx tsx tests/benchmarks/verify-pipeline.ts
 *
 *   # 完整管线（含 LLM 提取）
 *   npx tsx tests/benchmarks/verify-pipeline.ts --with-llm
 *
 *   # 测试单个 URL（含 LLM）
 *   npx tsx tests/benchmarks/verify-pipeline.ts --with-llm https://example.com
 *
 *   # 仅测试指定分类
 *   npx tsx tests/benchmarks/verify-pipeline.ts --category static
 *
 * 环境变量 (--with-llm 时至少配一个):
 *   QWEN_API_KEY / DEEPSEEK_API_KEY / KIMI_API_KEY / MINIMAX_API_KEY
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { probeSite } from "../../src/crawl/site-probe.js";
import { scrapePage } from "../../src/crawl/scraper.js";
import { scrapeWithCheerio } from "../../src/crawl/cheerio-scraper.js";
import { mapStructuredData } from "../../src/extractors/structured-data-mapper.js";
import { mapOpenGraphData } from "../../src/extractors/og-mapper.js";
import { chatCompletion } from "../../src/llm/client.js";
import { getAllProviders } from "../../src/llm/config.js";
import { mapLlmOutput } from "../../src/llm/field-mapper.js";
import {
  WEBSITE_EXTRACTION_SYSTEM_PROMPT,
  buildWebsiteUserPrompt,
} from "../../src/llm/prompts/website-fields.js";
import { validateFields } from "../../src/validators/field-validator.js";
import { shutdownBrowser } from "../../src/crawl/browser.js";
import type { SiteProfile } from "../../src/crawl/site-probe.js";
import type { ExtractedFields } from "../../src/types.js";

/* ── Types ─────────────────────────────────────── */

type CrawlStrategy = "lightweight" | "standard" | "stealth" | "skip";

interface SiteFixture {
  id: string;
  category: string;
  url: string;
  description: string;
  expectedStrategy: CrawlStrategy;
  expectedSiteType: string;
}

interface PipelineResult {
  siteId: string;
  url: string;
  category: string;
  success: boolean;
  error?: string;
  actualStrategy: CrawlStrategy;
  expectedStrategy: CrawlStrategy;
  strategyMatch: boolean;
  timings: {
    probeMs: number;
    scrapeMs: number;
    structuredMapMs: number;
    llmMs: number;
    totalMs: number;
  };
  siteProfile: {
    type: string;
    framework: string;
    complexity: string;
    hasJsonLd: boolean;
    hasOpenGraph: boolean;
    cfLevel: string;
  };
  extraction: {
    jsonLdFieldCount: number;
    ogFieldCount: number;
    llmFieldCount: number;
    llmProvider: string;
    totalFieldCount: number;
    coverageRatio: number;
    llmNeeded: boolean;
    llmUsed: boolean;
    validationIssues: number;
    confidenceDist: { high: number; medium: number; low: number };
  };
  fields: ExtractedFields;
}

/* ── Constants ─────────────────────────────────── */

const SKIP_LLM_COVERAGE = 0.8;
const MAX_TEXT_LENGTH = 60_000;

/* ── Strategy routing (mirrors website-crawl.ts) ── */

function selectStrategy(profile: SiteProfile): CrawlStrategy {
  if (
    profile.cloudflareLevel === "enterprise" ||
    profile.cloudflareLevel === "business"
  ) {
    return "skip";
  }
  if (profile.cloudflareProtected) {
    return "stealth";
  }
  if (profile.type === "static") {
    return "lightweight";
  }
  return "standard";
}

/* ── Single-site test ─────────────────────────── */

async function testSingleUrl(
  site: SiteFixture,
  withLlm: boolean,
): Promise<PipelineResult> {
  const totalStart = Date.now();

  const result: PipelineResult = {
    siteId: site.id,
    url: site.url,
    category: site.category,
    success: false,
    actualStrategy: "standard",
    expectedStrategy: site.expectedStrategy,
    strategyMatch: false,
    timings: {
      probeMs: 0,
      scrapeMs: 0,
      structuredMapMs: 0,
      llmMs: 0,
      totalMs: 0,
    },
    siteProfile: {
      type: "unknown",
      framework: "unknown",
      complexity: "moderate",
      hasJsonLd: false,
      hasOpenGraph: false,
      cfLevel: "none",
    },
    extraction: {
      jsonLdFieldCount: 0,
      ogFieldCount: 0,
      llmFieldCount: 0,
      llmProvider: "-",
      totalFieldCount: 0,
      coverageRatio: 0,
      llmNeeded: true,
      llmUsed: false,
      validationIssues: 0,
      confidenceDist: { high: 0, medium: 0, low: 0 },
    },
    fields: {},
  };

  try {
    // 1. Site Probe
    const probeStart = Date.now();
    const profile = await probeSite(site.url);
    result.timings.probeMs = Date.now() - probeStart;
    result.siteProfile = {
      type: profile.type,
      framework: profile.framework,
      complexity: profile.estimatedComplexity,
      hasJsonLd: profile.hasJsonLd,
      hasOpenGraph: profile.hasOpenGraph,
      cfLevel: profile.cloudflareLevel,
    };

    // 2. Strategy routing
    const strategy = selectStrategy(profile);
    result.actualStrategy = strategy;
    result.strategyMatch = strategy === site.expectedStrategy;

    // Skip sites that should be skipped
    if (strategy === "skip") {
      result.success = true;
      result.timings.totalMs = Date.now() - totalStart;
      return result;
    }

    // 3. Scrape — route to cheerio or Playwright
    const scrapeStart = Date.now();
    const scraped =
      strategy === "lightweight"
        ? await scrapeWithCheerio(site.url)
        : await scrapePage(site.url, {
            siteProfile: profile,
            useStealth: strategy === "stealth",
          });
    result.timings.scrapeMs = Date.now() - scrapeStart;

    // 4. Structured Data Mapping
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

    // 5. OpenGraph
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

    // 6. LLM extraction (if enabled and needed)
    if (withLlm && result.extraction.llmNeeded) {
      const llmStart = Date.now();
      try {
        const providers = getAllProviders();
        const textContent = scraped.markdown || scraped.bodyText;
        const truncatedText =
          textContent.length > MAX_TEXT_LENGTH
            ? textContent.slice(0, MAX_TEXT_LENGTH) +
              "\n\n[... text truncated ...]"
            : textContent;

        const userPrompt = buildWebsiteUserPrompt(
          scraped.title,
          truncatedText,
          scraped.imageUrls,
          scraped.jsonLd,
          mergedFields,
        );

        let llmFields: ExtractedFields = {};
        for (const provider of providers) {
          try {
            const raw = await chatCompletion(
              provider,
              [
                {
                  role: "system",
                  content: WEBSITE_EXTRACTION_SYSTEM_PROMPT,
                },
                { role: "user", content: userPrompt },
              ],
              { jsonMode: true, maxTokens: 4096, temperature: 0.1 },
            );
            llmFields = mapLlmOutput(raw);
            result.extraction.llmProvider = provider.name;
            break;
          } catch (err) {
            console.error(
              `  [LLM] Provider ${provider.name} failed:`,
              (err as Error).message,
            );
          }
        }

        let llmAdded = 0;
        for (const [key, value] of Object.entries(llmFields)) {
          if (!mergedFields[key]) {
            mergedFields[key] = value;
            llmAdded++;
          }
        }
        result.extraction.llmFieldCount = llmAdded;
        result.extraction.llmUsed = true;
      } catch (err) {
        console.error(
          `  [LLM] All providers failed:`,
          (err as Error).message,
        );
      }
      result.timings.llmMs = Date.now() - llmStart;
    }

    // 7. Validate
    const validated = validateFields(mergedFields);
    result.extraction.validationIssues = validated.issues.length;
    result.fields = validated.fields;
    result.extraction.totalFieldCount = Object.keys(validated.fields).length;

    // 8. Confidence distribution
    const dist = { high: 0, medium: 0, low: 0 };
    for (const field of Object.values(validated.fields)) {
      const c = field.confidence as keyof typeof dist;
      if (c in dist) dist[c]++;
    }
    result.extraction.confidenceDist = dist;

    result.success = true;
  } catch (err) {
    result.error = (err as Error).message;
  }

  result.timings.totalMs = Date.now() - totalStart;
  return result;
}

/* ── Output: per-site detail ──────────────────── */

function printResult(r: PipelineResult): void {
  const divider = "-".repeat(60);
  console.log(`\n${divider}`);
  console.log(`  ${r.siteId} | ${r.url}`);
  console.log(divider);

  if (!r.success) {
    console.log(`  STATUS: FAILED -- ${r.error}`);
    return;
  }

  if (r.actualStrategy === "skip") {
    const match = r.strategyMatch ? "OK" : "MISMATCH";
    console.log(
      `  STATUS: SKIPPED (CF ${r.siteProfile.cfLevel}) [strategy ${match}]`,
    );
    return;
  }

  const strategyIcon = r.strategyMatch ? "OK" : "MISMATCH";
  console.log(`  STATUS: OK`);
  console.log(
    `  Strategy: ${r.actualStrategy} (expected: ${r.expectedStrategy}) [${strategyIcon}]`,
  );
  console.log(
    `  Site:   ${r.siteProfile.type} | ${r.siteProfile.framework} | ${r.siteProfile.complexity} | CF=${r.siteProfile.cfLevel}`,
  );
  console.log(
    `  Detect: JSON-LD=${r.siteProfile.hasJsonLd} OG=${r.siteProfile.hasOpenGraph}`,
  );
  console.log(
    `  Fields: JSON-LD=${r.extraction.jsonLdFieldCount} OG=${r.extraction.ogFieldCount} LLM=${r.extraction.llmFieldCount} Total=${r.extraction.totalFieldCount}`,
  );
  console.log(
    `  Confidence: H=${r.extraction.confidenceDist.high} M=${r.extraction.confidenceDist.medium} L=${r.extraction.confidenceDist.low}`,
  );
  console.log(
    `  Coverage: ${(r.extraction.coverageRatio * 100).toFixed(0)}% | LLM needed: ${r.extraction.llmNeeded} | LLM used: ${r.extraction.llmUsed}${r.extraction.llmUsed ? ` (${r.extraction.llmProvider})` : ""}`,
  );
  console.log(`  Issues: ${r.extraction.validationIssues}`);
  console.log(
    `  Timing: probe=${r.timings.probeMs}ms scrape=${r.timings.scrapeMs}ms map=${r.timings.structuredMapMs}ms llm=${r.timings.llmMs}ms total=${r.timings.totalMs}ms`,
  );
}

/* ── Output: comparison table ─────────────────── */

function printComparisonTable(results: PipelineResult[]): void {
  console.log("\n" + "=".repeat(120));
  console.log("  COMPARISON TABLE");
  console.log("=".repeat(120));

  // Header
  const cols = [
    pad("Site", 24),
    pad("Category", 12),
    pad("Strategy", 18),
    pad("Match", 6),
    pad("Time(s)", 8),
    pad("Fields", 7),
    pad("H/M/L", 10),
    pad("Issues", 7),
  ];
  console.log("  " + cols.join(" | "));
  console.log("  " + "-".repeat(cols.join(" | ").length));

  for (const r of results) {
    const strategy =
      r.actualStrategy === r.expectedStrategy
        ? r.actualStrategy
        : `${r.actualStrategy}(!=${r.expectedStrategy})`;

    const row = [
      pad(r.siteId, 24),
      pad(r.category, 12),
      pad(strategy, 18),
      pad(r.strategyMatch ? "Y" : "N", 6),
      pad(r.success ? (r.timings.totalMs / 1000).toFixed(1) : "ERR", 8),
      pad(
        r.actualStrategy === "skip"
          ? "-"
          : String(r.extraction.totalFieldCount),
        7,
      ),
      pad(
        r.actualStrategy === "skip"
          ? "-"
          : `${r.extraction.confidenceDist.high}/${r.extraction.confidenceDist.medium}/${r.extraction.confidenceDist.low}`,
        10,
      ),
      pad(
        r.actualStrategy === "skip"
          ? "-"
          : String(r.extraction.validationIssues),
        7,
      ),
    ];
    console.log("  " + row.join(" | "));
  }
}

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

/* ── Output: strategy summary ─────────────────── */

function printStrategySummary(results: PipelineResult[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("  STRATEGY SUMMARY");
  console.log("=".repeat(80));

  const byStrategy = new Map<string, PipelineResult[]>();
  for (const r of results) {
    const key = r.actualStrategy;
    if (!byStrategy.has(key)) byStrategy.set(key, []);
    byStrategy.get(key)!.push(r);
  }

  for (const [strategy, items] of byStrategy) {
    const ok = items.filter((r) => r.success);
    const avgTime =
      ok.length > 0
        ? ok.reduce((s, r) => s + r.timings.totalMs, 0) / ok.length
        : 0;
    const avgFields =
      ok.filter((r) => r.actualStrategy !== "skip").length > 0
        ? ok
            .filter((r) => r.actualStrategy !== "skip")
            .reduce((s, r) => s + r.extraction.totalFieldCount, 0) /
          ok.filter((r) => r.actualStrategy !== "skip").length
        : 0;
    const mismatches = items.filter((r) => !r.strategyMatch);

    console.log(`\n  [${strategy.toUpperCase()}] ${items.length} site(s)`);
    console.log(`    OK: ${ok.length} | Failed: ${items.length - ok.length}`);
    console.log(
      `    Avg time: ${(avgTime / 1000).toFixed(1)}s | Avg fields: ${avgFields.toFixed(1)}`,
    );
    if (mismatches.length > 0) {
      console.log(
        `    Strategy MISMATCHES: ${mismatches.map((r) => `${r.siteId}(expected=${r.expectedStrategy})`).join(", ")}`,
      );
    }
  }

  // Overall strategy accuracy
  const totalMatches = results.filter((r) => r.strategyMatch).length;
  console.log(
    `\n  Strategy accuracy: ${totalMatches}/${results.length} (${((totalMatches / results.length) * 100).toFixed(0)}%)`,
  );
}

/* ── Output: overall summary ──────────────────── */

function printSummary(results: PipelineResult[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("  OVERALL SUMMARY");
  console.log("=".repeat(80));

  const ok = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const scraped = ok.filter((r) => r.actualStrategy !== "skip");

  console.log(
    `  Total: ${results.length} | OK: ${ok.length} | Failed: ${failed.length} | Skipped: ${ok.length - scraped.length}`,
  );

  if (scraped.length > 0) {
    const avgFields =
      scraped.reduce((s, r) => s + r.extraction.totalFieldCount, 0) /
      scraped.length;
    const avgTime =
      scraped.reduce((s, r) => s + r.timings.totalMs, 0) / scraped.length;
    const skippedLlm = scraped.filter((r) => !r.extraction.llmNeeded).length;
    const usedLlm = scraped.filter((r) => r.extraction.llmUsed).length;

    console.log(`  Avg fields (scraped): ${avgFields.toFixed(1)}`);
    console.log(`  Avg time (scraped): ${(avgTime / 1000).toFixed(1)}s`);
    console.log(
      `  LLM skippable: ${skippedLlm}/${scraped.length} (${((skippedLlm / scraped.length) * 100).toFixed(0)}%)`,
    );
    console.log(`  LLM actually used: ${usedLlm}/${scraped.length}`);
  }

  if (failed.length > 0) {
    console.log(`  -- Failures --`);
    for (const r of failed) {
      console.log(`    ${r.siteId}: ${r.error}`);
    }
  }
}

/* ── Main ─────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2);
  const withLlm = args.includes("--with-llm");
  const categoryFilter = args
    .find((a) => a.startsWith("--category=") || a.startsWith("--category "))
    ?.split("=")[1];
  const categoryIdx = args.indexOf("--category");
  const category =
    categoryFilter ?? (categoryIdx >= 0 ? args[categoryIdx + 1] : undefined);
  const customUrl = args.find((a) => !a.startsWith("--") && a.includes("://"));

  let sites: SiteFixture[];

  if (customUrl) {
    sites = [
      {
        id: "custom",
        category: "custom",
        url: customUrl,
        description: "Custom URL",
        expectedStrategy: "standard",
        expectedSiteType: "unknown",
      },
    ];
  } else {
    const fixtureData = await import("./fixtures/sample-sites.json", {
      with: { type: "json" },
    });
    sites = fixtureData.default.sites as SiteFixture[];
    if (category) {
      sites = sites.filter((s) => s.category === category);
      if (sites.length === 0) {
        console.error(`No sites match category "${category}"`);
        process.exit(1);
      }
    }
  }

  console.log(
    `\nVerifying extraction pipeline with ${sites.length} site(s)...`,
  );
  if (withLlm) {
    console.log(
      `Mode: FULL PIPELINE (probe -> strategy -> scrape -> JSON-LD -> OG -> LLM -> validate)`,
    );
  } else {
    console.log(
      `Mode: STRUCTURED ONLY (probe -> strategy -> scrape -> JSON-LD -> OG -> validate)`,
    );
    console.log(`  Tip: use --with-llm to enable LLM extraction`);
  }
  if (category) {
    console.log(`  Filter: category=${category}`);
  }
  console.log();

  const results: PipelineResult[] = [];

  for (const site of sites) {
    console.log(`Testing: ${site.id} [${site.category}] (${site.url})...`);
    const r = await testSingleUrl(site, withLlm);
    results.push(r);
    printResult(r);
  }

  printComparisonTable(results);
  printStrategySummary(results);
  printSummary(results);

  // Save results to JSON file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const resultsDir = join(__dirname, "results");
  mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const mode = withLlm ? "full" : "structured";
  const outputPath = join(resultsDir, `${timestamp}_${mode}.json`);

  const output = {
    timestamp: new Date().toISOString(),
    mode: withLlm ? "full_pipeline" : "structured_only",
    categoryFilter: category ?? "all",
    strategyAccuracy:
      results.filter((r) => r.strategyMatch).length + "/" + results.length,
    sites: results.map((r) => ({
      ...r,
      fields: Object.fromEntries(
        Object.entries(r.fields).map(([k, v]) => [
          k,
          { value: v.value, confidence: v.confidence },
        ]),
      ),
    })),
    summary: {
      total: results.length,
      ok: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      skipped: results.filter(
        (r) => r.success && r.actualStrategy === "skip",
      ).length,
      strategyMatches: results.filter((r) => r.strategyMatch).length,
      avgFields:
        results.filter(
          (r) => r.success && r.actualStrategy !== "skip",
        ).length > 0
          ? results
              .filter((r) => r.success && r.actualStrategy !== "skip")
              .reduce((s, r) => s + r.extraction.totalFieldCount, 0) /
            results.filter(
              (r) => r.success && r.actualStrategy !== "skip",
            ).length
          : 0,
      avgTimeMs:
        results.filter(
          (r) => r.success && r.actualStrategy !== "skip",
        ).length > 0
          ? results
              .filter((r) => r.success && r.actualStrategy !== "skip")
              .reduce((s, r) => s + r.timings.totalMs, 0) /
            results.filter(
              (r) => r.success && r.actualStrategy !== "skip",
            ).length
          : 0,
    },
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nResults saved to: ${outputPath}`);

  // Cleanup
  await shutdownBrowser();
  process.exit(results.every((r) => r.success) ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
