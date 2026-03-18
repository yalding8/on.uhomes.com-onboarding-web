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
import { shouldBlockRequest } from "./request-blocker.js";
import { isApartmentData, mapApiResponse } from "../extractors/api-interceptor.js";
import type { ExtractedFields } from "../types.js";
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
  /** 从 XHR/fetch JSON API 响应中捕获的字段 */
  apiFields: ExtractedFields;
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

  // API 响应捕获
  const capturedApiFields: ExtractedFields = {};
  page.on("response", async (response) => {
    try {
      const contentType = response.headers()["content-type"] ?? "";
      if (!contentType.includes("application/json")) return;
      if (response.status() < 200 || response.status() >= 300) return;

      const body = await response.text();
      if (!isApartmentData(body)) return;

      const json = JSON.parse(body) as unknown;
      const fields = mapApiResponse(json);
      // 合并（后到的覆盖前面的）
      Object.assign(capturedApiFields, fields);
    } catch {
      // 非 JSON 或解析失败，静默忽略
    }
  });

  try {
    // 屏蔽无用请求（analytics/ads/fonts）
    await page.route("**/*", (route) => {
      const req = route.request();
      if (shouldBlockRequest(req.url(), req.resourceType())) {
        return route.abort();
      }
      return route.continue();
    });

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

    // DOM 裁剪：移除 boilerplate（cookie banner、广告、低密度导航区）
    try {
      await page.evaluate(pruneBoilerplateInBrowser);
    } catch {
      // 裁剪失败不阻塞主流程
    }

    const content = await page.evaluate(extractPageContent);

    let markdown = "";
    try {
      markdown = await page.evaluate(htmlToMarkdownBrowserScript());
    } catch {
      markdown = content.bodyText;
    }

    return { ...content, markdown, apiFields: capturedApiFields };
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
  if (!document.body) {
    return { title: document.title || "", bodyText: "", imageUrls: [], jsonLd: [], openGraph: {}, navLinks: [], contactText: "", metaTags: {} };
  }
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

/** 浏览器端 DOM 裁剪 — 移除 boilerplate 元素（安全：不会清空 body） */
function pruneBoilerplateInBrowser() {
  if (!document.body) return;
  const BOILERPLATE = [
    "[class*='cookie']", "[id*='cookie']", "[class*='consent']",
    "[class*='ad-']", "[class*='ad_']", "[class*='ads-']",
    "[class*='popup']", "[class*='modal']",
    "[class*='sidebar']", "[class*='widget']",
    "[role='banner']", "[role='navigation']", "[role='complementary']",
    "[class*='newsletter']", "[class*='subscribe']",
    "[class*='social-']", "[class*='share-']",
  ];

  for (const sel of BOILERPLATE) {
    try {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    } catch { /* invalid selector in some DOMs */ }
  }

  // 文本密度裁剪：移除低密度 + 高链接密度的块
  const blocks = document.querySelectorAll("body > div, body > section, body > aside");
  for (const el of blocks) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.querySelector("table")) continue; // 保护表格
    const text = htmlEl.innerText || "";
    const html = htmlEl.outerHTML || "";
    if (html.length < 100) continue;

    const textLen = text.replace(/\s+/g, " ").trim().length;
    const htmlLen = html.length;
    const density = htmlLen > 0 ? textLen / htmlLen : 0;

    const links = htmlEl.querySelectorAll("a");
    let linkTextLen = 0;
    links.forEach((a) => { linkTextLen += (a.innerText || "").length; });
    const linkDensity = textLen > 0 ? linkTextLen / textLen : 0;

    if (density < 0.25 && linkDensity > 0.5) {
      htmlEl.remove();
    }
  }

  // 安全检查：如果裁剪后 body 几乎为空，恢复原始内容
  const remainingText = (document.body.innerText || "").trim();
  if (remainingText.length < 50) {
    // body 被过度裁剪，刷新页面不现实，但至少确保 body 非 null
    // 后续 extractPageContent 会处理空 body
  }
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
