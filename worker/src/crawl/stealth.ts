/**
 * Stealth 浏览器上下文 — 反检测增强
 *
 * 为 Playwright 浏览器上下文注入反检测措施：
 *  - 隐藏 navigator.webdriver
 *  - 随机化 viewport / locale / timezone
 *  - 注入代理配置
 *  - 拦截追踪脚本
 */

import type { Browser, BrowserContext } from "playwright";
import type { ProxyConfig } from "../proxy/manager.js";

const SUPPORTED_LOCALES = ["en-US", "en-GB", "en-AU"] as const;

const TRACKING_PATTERNS = [
  "**/google-analytics.com/**",
  "**/googletagmanager.com/**",
  "**/facebook.net/**",
  "**/connect.facebook.com/**",
  "**/analytics.tiktok.com/**",
  "**/hotjar.com/**",
];

/** navigator.webdriver 隐藏脚本 */
const WEBDRIVER_HIDE_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });
  // Chrome DevTools protocol detection
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });
  // Permissions override
  const origQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (params) => (
    params.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : origQuery(params)
  );
`;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 创建带反检测措施的浏览器上下文
 */
export async function createStealthContext(
  browser: Browser,
  proxyConfig?: ProxyConfig,
): Promise<BrowserContext> {
  const locale = randomPick(SUPPORTED_LOCALES);
  const width = randomInt(1280, 1920);
  const height = randomInt(720, 1080);

  const contextOptions: Record<string, unknown> = {
    viewport: { width, height },
    locale,
    userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`,
    timezoneId: "America/New_York",
    deviceScaleFactor: randomPick([1, 2]),
  };

  if (proxyConfig) {
    contextOptions.proxy = {
      server: proxyConfig.server,
      username: proxyConfig.username,
      password: proxyConfig.password,
    };
  }

  const context = await browser.newContext(contextOptions);

  // 隐藏 webdriver 标记
  await context.addInitScript(WEBDRIVER_HIDE_SCRIPT);

  // 拦截追踪脚本（逐条注册）
  for (const pattern of TRACKING_PATTERNS) {
    await context.route(pattern, (route) => route.abort());
  }

  return context;
}
