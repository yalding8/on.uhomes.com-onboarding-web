/**
 * 子页面爬取 — 从首页发现的导航链接中爬取高价值子页面
 *
 * 返回两种结果：
 * 1. 结构化字段（JSON-LD/OG/CSS 提取）
 * 2. 子页面 markdown 内容（供主流程聚合后统一 LLM 提取）
 */

import { scrapePage } from "../crawl/scraper.js";
import type { ScrapedContent } from "../crawl/scraper.js";
import { scrapeWithCheerio } from "../crawl/cheerio-scraper.js";
import { discoverSubPages } from "../crawl/multi-page.js";
import type { PageLabel } from "../crawl/multi-page.js";
import { extractWithCss } from "./css-extractor.js";
import { mapStructuredData } from "./structured-data-mapper.js";
import { mapOpenGraphData } from "./og-mapper.js";
import { mergeFieldsInto } from "./field-merge.js";
import { captureError } from "../sentry.js";
import type { SiteProfile } from "../crawl/site-probe.js";
import type { ExtractedFields } from "../types.js";

type CrawlStrategy = "lightweight" | "standard" | "stealth";

const SUB_PAGE_DELAY_MS = 2_000;

export interface SubPageResult {
  label: PageLabel;
  fields: ExtractedFields;
  markdown: string;
}

/** 子页面分层提取（JSON-LD → OG → CSS） */
function extractSubPageLayered(scraped: ScrapedContent): ExtractedFields {
  let fields: ExtractedFields = {};
  if (scraped.jsonLd.length > 0) {
    fields = { ...fields, ...mapStructuredData(scraped.jsonLd).fields };
  }
  mergeFieldsInto(fields, mapOpenGraphData(scraped.openGraph));
  const htmlSource = scraped.markdown || scraped.bodyText;
  if (htmlSource) {
    mergeFieldsInto(fields, extractWithCss(htmlSource));
  }
  return fields;
}

/** 爬取子页面，返回结构化字段 + 原始 markdown 内容 */
export async function crawlSubPages(
  baseUrl: string,
  navLinks: Array<{ href: string; text: string }>,
  siteProfile: SiteProfile,
  signal: AbortSignal,
  strategy: CrawlStrategy,
): Promise<SubPageResult[]> {
  const subPages = discoverSubPages(baseUrl, navLinks);
  if (subPages.length === 0) return [];

  console.error(
    `[sub-page-crawl] Discovered ${subPages.length} sub-pages: ${subPages.map((p) => p.label).join(", ")}`,
  );

  const results: SubPageResult[] = [];

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
      const markdown = subScraped.markdown || subScraped.bodyText;

      results.push({ label: subPage.label, fields: subFields, markdown });
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
