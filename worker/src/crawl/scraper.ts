/**
 * 页面爬取器 — 导航到目标 URL，提取文本、图片、JSON-LD 结构化数据
 */

import { getBrowser, acquirePageSlot, releasePageSlot } from "./browser.js";

export interface ScrapedContent {
  title: string;
  bodyText: string;
  imageUrls: string[];
  jsonLd: Record<string, unknown>[];
}

export async function scrapePage(
  url: string,
  signal?: AbortSignal,
): Promise<ScrapedContent> {
  await acquirePageSlot();

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // 监听 abort 信号
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          page.close().catch(() => {});
        },
        { once: true },
      );
    }

    // 导航（等待网络空闲）
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    // 等待主内容加载
    await page.waitForTimeout(2000);

    // 提取页面内容
    const content = await page.evaluate(() => {
      // 标题
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

      // 图片 URL（过滤小图标）
      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => img.src)
        .filter((src) => {
          if (!src || src.startsWith("data:")) return false;
          // 过滤常见小图标/追踪像素
          if (src.includes("favicon") || src.includes("pixel")) return false;
          return true;
        })
        .slice(0, 20);

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

      return { title, bodyText, imageUrls: images, jsonLd };
    });

    return content;
  } finally {
    await page.close().catch(() => {});
    releasePageSlot();
  }
}
