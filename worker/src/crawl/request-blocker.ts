/**
 * 请求拦截器 — 屏蔽 analytics/ads/fonts 等无用请求，加速页面加载
 */

/** 被屏蔽的域名/路径模式 */
export const BLOCKED_DOMAINS: string[] = [
  "google-analytics.com",
  "www.google-analytics.com",
  "googletagmanager.com",
  "www.googletagmanager.com",
  "connect.facebook.net",
  "www.facebook.com/tr",
  "doubleclick.net",
  "ad.doubleclick.net",
  "googlesyndication.com",
  "pagead2.googlesyndication.com",
  "adservice.google.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "youtube.com/embed",
  "player.vimeo.com",
  "hotjar.com",
  "clarity.ms",
  "sentry.io",
  "cdn.segment.com",
  "mixpanel.com",
  "intercom.io",
  "widget.intercom.io",
  "bat.bing.com",
  "snap.licdn.com",
];

/** 被屏蔽的资源类型 */
export const BLOCKED_RESOURCE_TYPES: string[] = ["font", "media"];

/**
 * 判断是否应该屏蔽该请求
 * @param url 请求 URL
 * @param resourceType Playwright 的 resourceType
 */
export function shouldBlockRequest(url: string, resourceType: string): boolean {
  if (BLOCKED_RESOURCE_TYPES.includes(resourceType)) return true;

  for (const domain of BLOCKED_DOMAINS) {
    if (url.includes(domain)) return true;
  }

  return false;
}
