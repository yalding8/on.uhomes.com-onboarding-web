/**
 * 页面辅助函数 — SPA 智能等待 + 懒加载图片触发
 */

import type { Page } from "playwright";
import type { SiteProfile } from "./site-probe.js";

/** 根据站点类型决定等待策略的超时参数 */
export function getTimeouts(profile?: SiteProfile) {
  const type = profile?.type ?? "unknown";
  switch (type) {
    case "static":
      return { navigation: 15_000, contentWait: 2_000 };
    case "wordpress":
      return { navigation: 30_000, contentWait: 4_000 };
    case "spa":
      return { navigation: 45_000, contentWait: 8_000 };
    case "platform_template":
      return { navigation: 40_000, contentWait: 6_000 };
    default:
      return { navigation: 45_000, contentWait: 8_000 };
  }
}

/** SPA 智能等待 — DOM 稳定检测 */
export async function waitForContentReady(
  page: Page,
  profile: SiteProfile | undefined,
  maxWaitMs: number,
): Promise<void> {
  const isSpa =
    profile?.type === "spa" ||
    profile?.type === "unknown" ||
    profile?.estimatedComplexity === "complex";

  if (!isSpa) {
    try {
      await page.waitForSelector("body *", { timeout: maxWaitMs });
    } catch {
      await page.waitForTimeout(2000);
    }
    return;
  }

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
        if (Date.now() - lastMutationTime >= STABILITY_MS) {
          observer.disconnect();
          clearInterval(check);
          resolve();
        }
      }, 300);
      setTimeout(() => {
        observer.disconnect();
        clearInterval(check);
        resolve();
      }, waitMs);
    });
  }, maxWaitMs);
}

/** 触发懒加载图片 — 平滑滚动到底部然后回到顶部 */
export async function triggerLazyImages(page: Page): Promise<void> {
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
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);
  } catch {
    // 滚动失败不影响主流程
  }
}
