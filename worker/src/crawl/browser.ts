/**
 * Playwright 浏览器单例管理
 *
 * 全局共享一个 Chromium 浏览器实例，使用信号量限制最多 3 个并发页面。
 * 增强: 断开检测 + 自动重启 + 优雅关闭
 */

import type { Browser } from "playwright";

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

/** 并发页面数限制 */
const MAX_CONCURRENT_PAGES = 3;
let activePagesCount = 0;
const waitQueue: Array<() => void> = [];

async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
}

export async function getBrowser(): Promise<Browser> {
  // Check existing instance
  if (browserInstance) {
    try {
      if (browserInstance.isConnected()) {
        return browserInstance;
      }
    } catch {
      // isConnected() can throw if process crashed
    }
    // Stale instance — clean up
    browserInstance = null;
  }

  // 防止并发启动
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = launchBrowser()
    .then((browser) => {
      browserInstance = browser;
      browserLaunchPromise = null;

      browser.on("disconnected", () => {
        console.error(
          "[browser] Browser disconnected, will restart on next use",
        );
        browserInstance = null;
      });

      return browser;
    })
    .catch((err) => {
      browserLaunchPromise = null;
      throw err;
    });

  return browserLaunchPromise;
}

/** 获取页面信号量 — 限制并发页面数 */
export async function acquirePageSlot(): Promise<void> {
  if (activePagesCount < MAX_CONCURRENT_PAGES) {
    activePagesCount++;
    return;
  }

  // 排队等待
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activePagesCount++;
      resolve();
    });
  });
}

/** 释放页面信号量 */
export function releasePageSlot(): void {
  activePagesCount = Math.max(0, activePagesCount - 1);
  const next = waitQueue.shift();
  if (next) next();
}

/** 关闭浏览器（优雅关闭时调用） */
export async function shutdownBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}
