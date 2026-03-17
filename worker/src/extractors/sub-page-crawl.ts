/**
 * 子页面爬取 — 从首页发现的导航链接中爬取高价值子页面
 *
 * 按子页面标签决定是否触发 LLM:
 * - pricing/amenities/floor-plans → 高价值，值得 LLM 提取
 * - contact/gallery/apply → 低价值，仅结构化提取
 */

import { scrapePage } from "../crawl/scraper.js";
import type { ScrapedContent } from "../crawl/scraper.js";
import { scrapeWithCheerio } from "../crawl/cheerio-scraper.js";
import { discoverSubPages } from "../crawl/multi-page.js";
import type { PageLabel } from "../crawl/multi-page.js";
import { extractWithLlm } from "./llm-extractor.js";
import { extractWithCss } from "./css-extractor.js";
import { mapStructuredData } from "./structured-data-mapper.js";
import { mapOpenGraphData } from "./og-mapper.js";
import { mergeFieldsInto } from "./field-merge.js";
import { captureError } from "../sentry.js";
import type { SiteProfile } from "../crawl/site-probe.js";
import type { ExtractedFields } from "../types.js";

type CrawlStrategy = "lightweight" | "standard" | "stealth";

const SUB_PAGE_DELAY_MS = 2_000;

/** 高价值子页面（值得 LLM 提取） */
const LLM_WORTHY: Set<PageLabel> = new Set([
  "pricing",
  "amenities",
  "floor-plans",
]);

/** 子页面分层提取（JSON-LD → OG → CSS） */
function extractSubPageLayered(scraped: ScrapedContent): ExtractedFields {
  let fields: ExtractedFields = {};
  if (scraped.jsonLd.length > 0) {
    fields = { ...fields, ...mapStructuredData(scraped.jsonLd).fields };
  }
  mergeFieldsInto(fields, mapOpenGraphData(scraped.openGraph));
  // 子页面也用 CSS 提取（通过 markdown 中的 HTML 片段）
  const htmlSource = scraped.markdown || scraped.bodyText;
  if (htmlSource) {
    mergeFieldsInto(fields, extractWithCss(htmlSource));
  }
  return fields;
}

/** 爬取子页面并提取字段 */
export async function crawlSubPages(
  baseUrl: string,
  navLinks: Array<{ href: string; text: string }>,
  siteProfile: SiteProfile,
  signal: AbortSignal,
  strategy: CrawlStrategy,
): Promise<ExtractedFields[]> {
  const subPages = discoverSubPages(baseUrl, navLinks);
  if (subPages.length === 0) return [];

  console.error(
    `[sub-page-crawl] Discovered ${subPages.length} sub-pages: ${subPages.map((p) => p.label).join(", ")}`,
  );

  const results: ExtractedFields[] = [];

  for (const subPage of subPages) {
    if (signal.aborted) break;

    try {
      await new Promise((r) => setTimeout(r, SUB_PAGE_DELAY_MS));

      let subScraped: ScrapedContent;
      if (strategy === "lightweight") {
        subScraped = await scrapeWithCheerio(subPage.url, signal);
      } else {
        subScraped = await scrapePage(subPage.url, {
          siteProfile,
          signal,
          useStealth: strategy === "stealth",
        });
      }

      const subFields = extractSubPageLayered(subScraped);

      // 仅对高价值子页面且有足够内容时调用 LLM
      const hasContent = subScraped.bodyText.trim().length > 200;
      if (LLM_WORTHY.has(subPage.label) && hasContent) {
        const llmFields = await extractWithLlm(subScraped, subFields, signal);
        mergeFieldsInto(subFields, llmFields);
      }

      results.push(subFields);
    } catch (err) {
      captureError(err, { subPageUrl: subPage.url, label: subPage.label });
      console.error(
        `[sub-page-crawl] ${subPage.label} failed:`,
        (err as Error).message,
      );
    }
  }

  return results;
}
