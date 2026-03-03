/**
 * 站点快速预检 — 在启动完整 Playwright 之前，通过轻量 HTTP 请求判断站点类型
 *
 * 输出 SiteProfile 用于策略路由，决定最优的抓取方式。
 */

export type SiteType =
  | "static"
  | "spa"
  | "wordpress"
  | "platform_template"
  | "unknown";

export type SiteFramework =
  | "react"
  | "vue"
  | "next"
  | "nuxt"
  | "angular"
  | "unknown";

export type SiteComplexity = "simple" | "moderate" | "complex";

export interface SiteProfile {
  type: SiteType;
  hasJsonLd: boolean;
  hasOpenGraph: boolean;
  framework: SiteFramework;
  estimatedComplexity: SiteComplexity;
  httpStatus: number;
  redirectUrl: string | null;
  contentType: string;
}

const PROBE_TIMEOUT_MS = 8_000;

/** SPA 框架指纹特征 */
const SPA_MARKERS = [
  '<div id="root"',
  '<div id="app"',
  '<div id="__next"',
  '<div id="__nuxt"',
  "app-root",
  "ng-app",
];

const REACT_MARKERS = ['id="root"', "react", "_reactRoot", "__NEXT_DATA__"];
const VUE_MARKERS = ['id="app"', "vue", "__NUXT__", "nuxt"];
const ANGULAR_MARKERS = ["ng-app", "ng-version", "app-root"];

/** WordPress 指纹 */
const WP_MARKERS = ["/wp-content/", "/wp-json/", "wp-includes"];

/** 物管平台模板指纹 */
const PLATFORM_MARKERS = [
  "entrata.com",
  "rentcafe.com",
  "appfolio.com",
  "realpage.com",
  "yardi.com",
  "on-site.com",
  "leasehawk.com",
  "myresman.com",
  "buildium.com",
];

export async function probeSite(
  url: string,
  signal?: AbortSignal,
): Promise<SiteProfile> {
  const profile: SiteProfile = {
    type: "unknown",
    hasJsonLd: false,
    hasOpenGraph: false,
    framework: "unknown",
    estimatedComplexity: "moderate",
    httpStatus: 0,
    redirectUrl: null,
    contentType: "",
  };

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; UHomesBot/1.0; +https://uhomes.com)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: signal ?? AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    profile.httpStatus = res.status;
    profile.contentType = res.headers.get("content-type") ?? "";

    if (res.url !== url) {
      profile.redirectUrl = res.url;
    }

    if (res.status >= 400) {
      profile.estimatedComplexity = "complex";
      return profile;
    }

    const html = await res.text();
    classifySite(html, profile);
  } catch (err) {
    console.error("[site-probe] Probe failed:", (err as Error).message);
    profile.estimatedComplexity = "complex";
  }

  return profile;
}

function classifySite(html: string, profile: SiteProfile): void {
  const lower = html.toLowerCase();

  // JSON-LD detection
  profile.hasJsonLd = lower.includes('type="application/ld+json"');

  // OpenGraph detection
  profile.hasOpenGraph =
    lower.includes('property="og:') || lower.includes("property='og:");

  // Framework detection
  profile.framework = detectFramework(lower);

  // Site type classification (ordered by specificity)
  if (isPlatformTemplate(lower)) {
    profile.type = "platform_template";
    profile.estimatedComplexity = profile.hasJsonLd ? "simple" : "moderate";
  } else if (isWordPress(lower)) {
    profile.type = "wordpress";
    profile.estimatedComplexity = "simple";
  } else if (isSpa(html, lower)) {
    profile.type = "spa";
    profile.estimatedComplexity = "complex";
  } else {
    profile.type = "static";
    profile.estimatedComplexity = "simple";
  }
}

function detectFramework(lower: string): SiteFramework {
  if (lower.includes("__next_data__") || lower.includes("_next/static")) {
    return "next";
  }
  if (lower.includes("__nuxt__") || lower.includes("_nuxt/")) {
    return "nuxt";
  }
  if (ANGULAR_MARKERS.some((m) => lower.includes(m.toLowerCase()))) {
    return "angular";
  }
  if (VUE_MARKERS.some((m) => lower.includes(m.toLowerCase()))) {
    return "vue";
  }
  if (REACT_MARKERS.some((m) => lower.includes(m.toLowerCase()))) {
    return "react";
  }
  return "unknown";
}

function isWordPress(lower: string): boolean {
  return WP_MARKERS.some((m) => lower.includes(m));
}

function isPlatformTemplate(lower: string): boolean {
  return PLATFORM_MARKERS.some((m) => lower.includes(m));
}

/** SPA 判定：空壳 HTML（正文文本极少）+ JS 框架标记 */
function isSpa(html: string, lower: string): boolean {
  // Check for explicit SPA markers
  if (SPA_MARKERS.some((m) => lower.includes(m.toLowerCase()))) {
    // Verify body is mostly empty (SPA shell)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1]
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, "")
        .trim();
      // If body text is short, it's likely a SPA shell
      if (bodyContent.length < 200) return true;
    }
    return true;
  }
  return false;
}
