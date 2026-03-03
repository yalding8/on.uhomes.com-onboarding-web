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
 * 环境变量 (--with-llm 时至少配一个):
 *   QWEN_API_KEY / DEEPSEEK_API_KEY / KIMI_API_KEY / MINIMAX_API_KEY
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { probeSite } from "../../src/crawl/site-probe.js";
import { scrapePage } from "../../src/crawl/scraper.js";
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
    llmMs: number;
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
    llmFieldCount: number;
    llmProvider: string;
    totalFieldCount: number;
    coverageRatio: number;
    llmNeeded: boolean;
    llmUsed: boolean;
    validationIssues: number;
  };
  fields: ExtractedFields;
}

const SKIP_LLM_COVERAGE = 0.8;
const MAX_TEXT_LENGTH = 60_000;

async function testSingleUrl(
  url: string,
  siteId: string,
  withLlm: boolean,
): Promise<PipelineResult> {
  const totalStart = Date.now();

  const result: PipelineResult = {
    siteId,
    url,
    success: false,
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

    // 5. LLM extraction (if enabled and needed)
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
              {
                jsonMode: true,
                maxTokens: 4096,
                temperature: 0.1,
              },
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

        // Merge LLM fields (don't overwrite existing)
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
        console.error(`  [LLM] All providers failed:`, (err as Error).message);
      }
      result.timings.llmMs = Date.now() - llmStart;
    }

    // 6. Validate
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
    `  Fields: JSON-LD=${r.extraction.jsonLdFieldCount} OG=${r.extraction.ogFieldCount} LLM=${r.extraction.llmFieldCount} Total=${r.extraction.totalFieldCount}`,
  );
  console.log(
    `  Coverage: ${(r.extraction.coverageRatio * 100).toFixed(0)}% | LLM needed: ${r.extraction.llmNeeded} | LLM used: ${r.extraction.llmUsed}${r.extraction.llmUsed ? ` (${r.extraction.llmProvider})` : ""}`,
  );
  console.log(`  Issues: ${r.extraction.validationIssues}`);
  console.log(
    `  Timing: probe=${r.timings.probeMs}ms scrape=${r.timings.scrapeMs}ms map=${r.timings.structuredMapMs}ms llm=${r.timings.llmMs}ms total=${r.timings.totalMs}ms`,
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
    const usedLlm = ok.filter((r) => r.extraction.llmUsed).length;

    console.log(`  Avg fields: ${avgFields.toFixed(1)}`);
    console.log(`  Avg time: ${(avgTime / 1000).toFixed(1)}s`);
    console.log(
      `  LLM skippable: ${skippedLlm}/${ok.length} (${((skippedLlm / ok.length) * 100).toFixed(0)}%)`,
    );
    console.log(`  LLM actually used: ${usedLlm}/${ok.length}`);

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
  const args = process.argv.slice(2);
  const withLlm = args.includes("--with-llm");
  const customUrl = args.find((a) => !a.startsWith("--"));

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
    `\nVerifying extraction pipeline with ${sites.length} site(s)...`,
  );
  if (withLlm) {
    console.log(
      `Mode: FULL PIPELINE (site probe → scrape → JSON-LD → OG → LLM → validate)`,
    );
  } else {
    console.log(
      `Mode: STRUCTURED ONLY (site probe → scrape → JSON-LD → OG → validate)`,
    );
    console.log(`  Tip: use --with-llm to enable LLM extraction`);
  }
  console.log();

  const results: PipelineResult[] = [];

  for (const site of sites) {
    console.log(`Testing: ${site.id} (${site.url})...`);
    const r = await testSingleUrl(site.url, site.id, withLlm);
    results.push(r);
    printResult(r);
  }

  printSummary(results);

  // Save results to JSON file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const resultsDir = join(__dirname, "results");
  mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const mode = withLlm ? "full" : "structured";
  const outputPath = join(resultsDir, `${timestamp}_${mode}.json`);

  const output = {
    timestamp: new Date().toISOString(),
    mode: withLlm ? "full_pipeline" : "structured_only",
    sites: results.map((r) => ({
      ...r,
      // Serialize field values for readability
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
      avgFields:
        results.filter((r) => r.success).length > 0
          ? results
              .filter((r) => r.success)
              .reduce((s, r) => s + r.extraction.totalFieldCount, 0) /
            results.filter((r) => r.success).length
          : 0,
      avgTimeMs:
        results.filter((r) => r.success).length > 0
          ? results
              .filter((r) => r.success)
              .reduce((s, r) => s + r.timings.totalMs, 0) /
            results.filter((r) => r.success).length
          : 0,
    },
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n📄 Results saved to: ${outputPath}`);

  // Cleanup
  await shutdownBrowser();
  process.exit(results.every((r) => r.success) ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
