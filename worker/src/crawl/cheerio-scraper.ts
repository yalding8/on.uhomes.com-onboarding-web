/**
 * cheerio 轻量提取器 — 静态站点跳过 Playwright，直接用 HTTP + cheerio 解析
 *
 * 适用条件：site-probe 检测为 static 且无 Cloudflare 保护
 * 优势：无需启动浏览器，速度快、资源占用低
 */

import * as cheerio from "cheerio";
import { simpleHtmlToMarkdown } from "./html-to-markdown.js";
import type { ScrapedContent } from "./scraper.js";

const FETCH_TIMEOUT_MS = 15_000;

const USER_AGENT =
  "Mozilla/5.0 (compatible; UHomesBot/1.0; +https://uhomes.com)";

/**
 * 用 HTTP fetch + cheerio 提取静态页面内容
 * 返回与 Playwright scrapePage 相同的 ScrapedContent 结构
 */
export async function scrapeWithCheerio(
  url: string,
  signal?: AbortSignal,
): Promise<ScrapedContent> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const html = await res.text();
  return parseHtml(html);
}

/** 解析 HTML 字符串，提取结构化内容 */
export function parseHtml(html: string): ScrapedContent {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();

  // 移除噪音元素后提取正文
  const bodyClone = $("body").clone();
  bodyClone
    .find("script, style, nav, footer, header, noscript, iframe")
    .remove();
  const bodyText = bodyClone.text().replace(/\s+/g, " ").trim();

  // 图片提取
  const imageUrls = extractImages($);

  // JSON-LD 结构化数据
  const jsonLd = extractJsonLd($);

  // OpenGraph 元数据
  const openGraph = extractOpenGraph($);

  // 导航栏链接
  const navLinks = extractNavLinks($);

  // Markdown 转换
  const markdown = simpleHtmlToMarkdown(html);

  return { title, bodyText, markdown, imageUrls, jsonLd, openGraph, navLinks };
}

function extractImages($: cheerio.CheerioAPI): string[] {
  const images: string[] = [];

  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (!src || src.startsWith("data:")) return;
    if (src.includes("favicon") || src.includes("pixel")) return;
    if (src.includes("1x1") || src.includes("spacer")) return;
    images.push(src);
  });

  // picture > source srcset
  $("picture source").each((_, el) => {
    const srcset = $(el).attr("srcset") || "";
    const first = srcset.split(",")[0]?.trim().split(" ")[0] || "";
    if (first && !first.startsWith("data:")) {
      images.push(first);
    }
  });

  return [...new Set(images)].slice(0, 30);
}

function extractJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "");
      results.push(data as Record<string, unknown>);
    } catch {
      // 忽略无法解析的 JSON-LD
    }
  });
  return results;
}

function extractOpenGraph($: cheerio.CheerioAPI): Record<string, string> {
  const og: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const property = $(el).attr("property")?.replace("og:", "") ?? "";
    const content = $(el).attr("content") ?? "";
    if (property && content) og[property] = content;
  });
  return og;
}

function extractNavLinks(
  $: cheerio.CheerioAPI,
): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  $("nav a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (href && text) links.push({ href, text });
  });
  return links;
}
