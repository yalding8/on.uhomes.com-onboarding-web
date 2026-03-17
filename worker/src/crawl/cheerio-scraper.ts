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

  // 联系信息 + 补充 meta
  const contactText = extractContactText($);
  const metaTags = extractMetaTags($);

  return {
    title,
    bodyText,
    markdown,
    imageUrls,
    jsonLd,
    openGraph,
    navLinks,
    contactText,
    metaTags,
  };
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
  const seen = new Set<string>();

  // 优先级 1: 语义化导航区域
  const NAV_SELECTORS = [
    "nav a[href]",
    '[role="navigation"] a[href]',
    "header a[href]",
    ".nav a[href]",
    ".navbar a[href]",
    ".navigation a[href]",
    ".menu a[href]",
    "#menu a[href]",
  ];

  for (const selector of NAV_SELECTORS) {
    $(selector).each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();
      if (href && text && !seen.has(href)) {
        seen.add(href);
        links.push({ href, text });
      }
    });
  }

  // 优先级 2: 语义化导航为空时 fallback 到全页面链接
  if (links.length === 0) {
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();
      if (!href || !text || seen.has(href)) return;
      if (/^(mailto:|tel:|javascript:|#|data:)/.test(href)) return;
      if (text.length > 60 || text.length < 2) return;
      seen.add(href);
      links.push({ href, text });
    });
  }

  return links;
}

/** 从 header/footer/contact 区域提取联系信息文本 */
function extractContactText($: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  const CONTACT_SELECTORS = [
    "header",
    "footer",
    ".contact",
    ".contact-info",
    '[id*="contact"]',
    '[class*="contact"]',
  ];
  for (const sel of CONTACT_SELECTORS) {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 5 && text.length < 2000) parts.push(text);
    });
  }
  return [...new Set(parts)].join("\n");
}

/** 提取 Twitter Card 和其他有用的 meta 标签 */
function extractMetaTags($: cheerio.CheerioAPI): Record<string, string> {
  const meta: Record<string, string> = {};

  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr("name")?.replace("twitter:", "") ?? "";
    const content = $(el).attr("content") ?? "";
    if (name && content) meta[`twitter_${name}`] = content;
  });
  $('meta[name="description"]').each((_, el) => {
    meta.meta_description = $(el).attr("content") ?? "";
  });
  $('meta[name="author"]').each((_, el) => {
    meta.meta_author = $(el).attr("content") ?? "";
  });
  $('meta[name="geo.placename"]').each((_, el) => {
    meta.geo_placename = $(el).attr("content") ?? "";
  });

  return meta;
}
