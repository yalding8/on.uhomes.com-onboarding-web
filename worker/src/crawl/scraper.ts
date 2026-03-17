/**
 * 页面爬取器 — 导航到目标 URL，提取文本、图片、JSON-LD、OG、联系信息
 *
 * 增强: SPA 智能等待 + 懒加载图片 + Markdown + 扩展链接发现 + contactText
 */

import { getBrowser, acquirePageSlot, releasePageSlot } from "./browser.js";
import { htmlToMarkdownBrowserScript } from "./html-to-markdown.js";
import { createStealthContext } from "./stealth.js";
import { getProxy } from "../proxy/manager.js";
import {
  getTimeouts,
  waitForContentReady,
  triggerLazyImages,
} from "./page-helpers.js";
import type { SiteProfile } from "./site-probe.js";

export interface ScrapedContent {
  title: string;
  bodyText: string;
  /** Markdown 格式的页面内容（比 bodyText 保留更多结构） */
  markdown: string;
  imageUrls: string[];
  jsonLd: Record<string, unknown>[];
  /** OpenGraph 元数据 */
  openGraph: Record<string, string>;
  /** 导航栏链接（用于多页面发现） */
  navLinks: Array<{ href: string; text: string }>;
  /** header/footer/contact 区域的联系信息文本 */
  contactText: string;
  /** Twitter Card / meta 等补充标签 */
  metaTags: Record<string, string>;
}

interface ScrapeOptions {
  siteProfile?: SiteProfile;
  signal?: AbortSignal;
  useStealth?: boolean;
}

export async function scrapePage(
  url: string,
  options: ScrapeOptions = {},
): Promise<ScrapedContent> {
  const { siteProfile, signal, useStealth = false } = options;
  await acquirePageSlot();

  const browser = await getBrowser();
  const timeouts = getTimeouts(siteProfile);

  let stealthContext: import("playwright").BrowserContext | null = null;
  let page: import("playwright").Page;

  if (useStealth) {
    const domain = new URL(url).hostname;
    const proxyConfig = getProxy(domain) ?? undefined;
    stealthContext = await createStealthContext(browser, proxyConfig);
    page = await stealthContext.newPage();
  } else {
    page = await browser.newPage();
  }

  try {
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          page.close().catch(() => {});
        },
        { once: true },
      );
    }

    const waitUntil =
      siteProfile?.type === "static" ? "load" : "domcontentloaded";
    const response = await page.goto(url, {
      waitUntil,
      timeout: timeouts.navigation,
    });
    if (response && response.status() >= 400) {
      throw new Error(`Page returned HTTP ${response.status()}: ${url}`);
    }

    await waitForContentReady(page, siteProfile, timeouts.contentWait);

    if (siteProfile?.type === "spa" || siteProfile?.type === "unknown") {
      await triggerLazyImages(page);
    }

    const content = await page.evaluate(extractPageContent);

    let markdown = "";
    try {
      markdown = await page.evaluate(htmlToMarkdownBrowserScript());
    } catch {
      markdown = content.bodyText;
    }

    return { ...content, markdown };
  } finally {
    await page.close().catch(() => {});
    if (stealthContext) await stealthContext.close().catch(() => {});
    releasePageSlot();
  }
}

/** 浏览器内执行的内容提取脚本 */
function extractPageContent() {
  const title = document.title || "";

  // 正文文本
  const clone = document.body.cloneNode(true) as HTMLElement;
  for (const sel of ["script", "style", "noscript", "iframe"]) {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  }
  const bodyText = clone.innerText || clone.textContent || "";

  // 图片
  const images = Array.from(document.querySelectorAll("img"))
    .map((img) => img.src || img.dataset.src || "")
    .filter(
      (s) =>
        s &&
        !s.startsWith("data:") &&
        !s.includes("favicon") &&
        !s.includes("1x1"),
    )
    .slice(0, 30);
  const pictureImages = Array.from(document.querySelectorAll("picture source"))
    .map(
      (s) =>
        (s.getAttribute("srcset") || "").split(",")[0]?.trim().split(" ")[0] ||
        "",
    )
    .filter((s) => s && !s.startsWith("data:"));
  const imageUrls = [...new Set([...images, ...pictureImages])].slice(0, 30);

  // JSON-LD
  const jsonLd: Record<string, unknown>[] = [];
  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      jsonLd.push(
        JSON.parse(script.textContent || "") as Record<string, unknown>,
      );
    } catch {
      /* skip */
    }
  }

  // OpenGraph
  const openGraph: Record<string, string> = {};
  for (const tag of document.querySelectorAll('meta[property^="og:"]')) {
    const p = tag.getAttribute("property")?.replace("og:", "") ?? "";
    const c = tag.getAttribute("content") ?? "";
    if (p && c) openGraph[p] = c;
  }

  // 导航链接 — 扩展选择器覆盖 SPA/现代站点
  const NAV_SELS = [
    "nav a[href]",
    '[role="navigation"] a[href]',
    "header a[href]",
    ".nav a[href]",
    ".navbar a[href]",
    ".navigation a[href]",
    ".menu a[href]",
    "#menu a[href]",
  ];
  const seenHrefs = new Set<string>();
  const navLinks: Array<{ href: string; text: string }> = [];
  for (const sel of NAV_SELS) {
    for (const a of document.querySelectorAll(sel)) {
      const href = a.getAttribute("href") || "";
      const text = (a.textContent || "").trim();
      if (href && text && !seenHrefs.has(href)) {
        seenHrefs.add(href);
        navLinks.push({ href, text });
      }
    }
  }
  if (navLinks.length === 0) {
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      const text = (a.textContent || "").trim();
      if (!href || !text || seenHrefs.has(href)) continue;
      if (/^(mailto:|tel:|javascript:|#|data:)/.test(href)) continue;
      if (text.length > 60 || text.length < 2) continue;
      seenHrefs.add(href);
      navLinks.push({ href, text });
    }
  }

  // 联系信息文本
  const contactParts: string[] = [];
  for (const sel of [
    "header",
    "footer",
    ".contact",
    ".contact-info",
    '[id*="contact"]',
    '[class*="contact"]',
  ]) {
    for (const el of document.querySelectorAll(sel)) {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length > 5 && t.length < 2000) contactParts.push(t);
    }
  }
  const contactText = [...new Set(contactParts)].join("\n");

  // 补充 meta 标签
  const metaTags: Record<string, string> = {};
  for (const m of document.querySelectorAll('meta[name^="twitter:"]')) {
    const n = m.getAttribute("name")?.replace("twitter:", "") ?? "";
    const c = m.getAttribute("content") ?? "";
    if (n && c) metaTags[`twitter_${n}`] = c;
  }
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta)
    metaTags.meta_description = descMeta.getAttribute("content") ?? "";

  return {
    title,
    bodyText,
    imageUrls,
    jsonLd,
    openGraph,
    navLinks,
    contactText,
    metaTags,
  };
}

/**
 * 兼容旧接口
 * @deprecated 使用 scrapePage(url, { signal }) 替代
 */
export async function scrapePageLegacy(
  url: string,
  signal?: AbortSignal,
): Promise<ScrapedContent> {
  return scrapePage(url, { signal });
}
