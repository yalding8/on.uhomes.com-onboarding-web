/**
 * 页面爬取器 — 导航到目标 URL，提取文本、图片、JSON-LD 结构化数据
 *
 * 增强: SPA 智能等待 (DOM 稳定检测) + 懒加载图片提取 + Markdown 转换
 */

import { getBrowser, acquirePageSlot, releasePageSlot } from "./browser.js";
import { htmlToMarkdownBrowserScript } from "./html-to-markdown.js";
import { createStealthContext } from "./stealth.js";
import { getProxy } from "../proxy/manager.js";
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
}

interface ScrapeOptions {
  siteProfile?: SiteProfile;
  signal?: AbortSignal;
  /** 启用 stealth 上下文（隐藏 webdriver + 代理 + 反追踪） */
  useStealth?: boolean;
}

/** 根据站点类型决定等待策略的超时参数 */
function getTimeouts(profile?: SiteProfile) {
  const type = profile?.type ?? "unknown";
  switch (type) {
    case "static":
      return { navigation: 15_000, contentWait: 2_000 };
    case "wordpress":
      return { navigation: 20_000, contentWait: 3_000 };
    case "spa":
      return { navigation: 30_000, contentWait: 8_000 };
    case "platform_template":
      return { navigation: 25_000, contentWait: 5_000 };
    default:
      return { navigation: 30_000, contentWait: 5_000 };
  }
}

export async function scrapePage(
  url: string,
  options: ScrapeOptions = {},
): Promise<ScrapedContent> {
  const { siteProfile, signal, useStealth = false } = options;
  await acquirePageSlot();

  const browser = await getBrowser();
  const timeouts = getTimeouts(siteProfile);

  // Stealth 模式：创建带反检测的上下文 + 代理
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

    // 导航 — SPA 用 domcontentloaded，静态站可用 load
    const waitUntil =
      siteProfile?.type === "static" ? "load" : "domcontentloaded";
    const response = await page.goto(url, {
      waitUntil,
      timeout: timeouts.navigation,
    });

    if (response) {
      const httpStatus = response.status();
      if (httpStatus >= 400) {
        throw new Error(`Page returned HTTP ${httpStatus}: ${url}`);
      }
    }

    // SPA 智能等待: DOM 稳定检测
    await waitForContentReady(page, siteProfile, timeouts.contentWait);

    // 触发懒加载图片（SPA 和复杂站点需要滚动）
    if (siteProfile?.type === "spa" || siteProfile?.type === "unknown") {
      await triggerLazyImages(page);
    }

    // 提取页面内容
    const content = await page.evaluate(() => {
      const title = document.title || "";

      // 正文文本（移除 script/style/nav/footer）
      const clone = document.body.cloneNode(true) as HTMLElement;
      const removeSelectors = [
        "script",
        "style",
        "nav",
        "footer",
        "header",
        "noscript",
        "iframe",
      ];
      for (const sel of removeSelectors) {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      }
      const bodyText = clone.innerText || clone.textContent || "";

      // 图片 URL — 包含 data-src 和 srcset
      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => img.src || img.dataset.src || "")
        .filter((src) => {
          if (!src || src.startsWith("data:")) return false;
          if (src.includes("favicon") || src.includes("pixel")) return false;
          if (src.includes("1x1") || src.includes("spacer")) return false;
          return true;
        })
        .slice(0, 30);

      // picture > source srcset
      const pictureImages = Array.from(
        document.querySelectorAll("picture source"),
      )
        .map((s) => {
          const srcset = s.getAttribute("srcset") || "";
          return srcset.split(",")[0]?.trim().split(" ")[0] || "";
        })
        .filter((src) => src && !src.startsWith("data:"));

      const allImages = [...new Set([...images, ...pictureImages])].slice(
        0,
        30,
      );

      // JSON-LD 结构化数据
      const jsonLdScripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      );
      const jsonLd: Record<string, unknown>[] = [];
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent || "");
          jsonLd.push(data as Record<string, unknown>);
        } catch {
          // 忽略无法解析的 JSON-LD
        }
      }

      // OpenGraph 元数据
      const ogTags = Array.from(
        document.querySelectorAll('meta[property^="og:"]'),
      );
      const openGraph: Record<string, string> = {};
      for (const tag of ogTags) {
        const property = tag.getAttribute("property")?.replace("og:", "") ?? "";
        const content = tag.getAttribute("content") ?? "";
        if (property && content) openGraph[property] = content;
      }

      // 导航栏链接（用于多页面发现）
      const navElements = document.querySelectorAll("nav a[href]");
      const navLinks = Array.from(navElements)
        .map((a) => ({
          href: a.getAttribute("href") || "",
          text: (a.textContent || "").trim(),
        }))
        .filter((l) => l.href && l.text);

      return {
        title,
        bodyText,
        imageUrls: allImages,
        jsonLd,
        openGraph,
        navLinks,
      };
    });

    // Markdown 转换（在浏览器上下文中执行）
    let markdown = "";
    try {
      markdown = await page.evaluate(htmlToMarkdownBrowserScript());
    } catch {
      markdown = content.bodyText;
    }

    return { ...content, markdown };
  } finally {
    await page.close().catch(() => {});
    if (stealthContext) {
      await stealthContext.close().catch(() => {});
    }
    releasePageSlot();
  }
}

/** SPA 智能等待 — DOM 稳定检测 */
async function waitForContentReady(
  page: import("playwright").Page,
  profile: SiteProfile | undefined,
  maxWaitMs: number,
): Promise<void> {
  const isSpa =
    profile?.type === "spa" ||
    profile?.type === "unknown" ||
    profile?.estimatedComplexity === "complex";

  if (!isSpa) {
    // 非 SPA: 简单等待 body 子元素出现
    try {
      await page.waitForSelector("body *", { timeout: maxWaitMs });
    } catch {
      await page.waitForTimeout(2000);
    }
    return;
  }

  // SPA: 等待 DOM 稳定 — MutationObserver 监听变化停止
  try {
    await page.waitForSelector("body *", { timeout: 5000 });
  } catch {
    // body 未渲染任何内容，继续等待
  }

  await page.evaluate((waitMs) => {
    return new Promise<void>((resolve) => {
      let lastMutationTime = Date.now();
      const STABILITY_MS = 1500;

      const observer = new MutationObserver(() => {
        lastMutationTime = Date.now();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      const check = setInterval(() => {
        const elapsed = Date.now() - lastMutationTime;
        if (elapsed >= STABILITY_MS) {
          observer.disconnect();
          clearInterval(check);
          resolve();
        }
      }, 300);

      // 绝对超时保护
      setTimeout(() => {
        observer.disconnect();
        clearInterval(check);
        resolve();
      }, waitMs);
    });
  }, maxWaitMs);
}

/** 触发懒加载图片 — 平滑滚动到底部然后回到顶部 */
async function triggerLazyImages(
  page: import("playwright").Page,
): Promise<void> {
  try {
    await page.evaluate(async () => {
      const distance = 500;
      const delay = 100;
      const maxScrolls = 10;
      let scrolls = 0;

      while (scrolls < maxScrolls) {
        const before = window.scrollY;
        window.scrollBy(0, distance);
        await new Promise((r) => setTimeout(r, delay));
        if (window.scrollY === before) break;
        scrolls++;
      }
      // 回到顶部
      window.scrollTo(0, 0);
    });
    // 等待图片加载
    await page.waitForTimeout(1000);
  } catch {
    // 滚动失败不影响主流程
  }
}

/**
 * 兼容旧接口 — 支持 signal 参数的简化调用
 * @deprecated 使用 scrapePage(url, { signal }) 替代
 */
export async function scrapePageLegacy(
  url: string,
  signal?: AbortSignal,
): Promise<ScrapedContent> {
  return scrapePage(url, { signal });
}
