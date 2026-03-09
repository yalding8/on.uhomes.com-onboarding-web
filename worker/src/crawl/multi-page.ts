/**
 * 多页面发现 — 从首页导航链接中提取高价值子页面
 *
 * 按关键词匹配 + 优先级排序，最多返回 6 个子页面。
 * 用于多页面爬取策略：每个子页面独立提取后合并结果。
 */

export interface PageDiscovery {
  url: string;
  label: PageLabel;
  priority: number;
}

export type PageLabel =
  | "pricing"
  | "amenities"
  | "contact"
  | "floor-plans"
  | "gallery"
  | "apply";

const MAX_SUB_PAGES = 6;

/** 关键词 → 页面标签映射（按优先级排列） */
const KEYWORD_RULES: Array<{
  label: PageLabel;
  priority: number;
  pattern: RegExp;
}> = [
  {
    label: "pricing",
    priority: 1,
    pattern: /pricing|rates?|cost|rent/i,
  },
  {
    label: "amenities",
    priority: 2,
    pattern: /amenities|features?|facilities/i,
  },
  {
    label: "contact",
    priority: 3,
    pattern: /contact|reach|get.?in.?touch/i,
  },
  {
    label: "floor-plans",
    priority: 4,
    pattern: /floor.?plans?|units?|rooms?|layouts?/i,
  },
  {
    label: "gallery",
    priority: 5,
    pattern: /gallery|photos?|images?|tour/i,
  },
  {
    label: "apply",
    priority: 6,
    pattern: /apply|application/i,
  },
];

/**
 * 从导航链接中发现高价值子页面
 *
 * @param baseUrl   - 站点基础 URL
 * @param navLinks  - 从 <nav> 元素中提取的链接列表
 * @returns 去重、排序、限量后的子页面列表
 */
export function discoverSubPages(
  baseUrl: string,
  navLinks: Array<{ href: string; text: string }>,
): PageDiscovery[] {
  const baseOrigin = safeOrigin(baseUrl);
  if (!baseOrigin) return [];

  const seen = new Set<string>();
  const discoveries: PageDiscovery[] = [];

  for (const link of navLinks) {
    const resolved = resolveUrl(link.href, baseUrl);
    if (!resolved) continue;

    // 跳过外部域名
    if (safeOrigin(resolved) !== baseOrigin) continue;

    // 规范化 URL（去尾部斜杠）
    const normalized = resolved.replace(/\/+$/, "");
    if (seen.has(normalized)) continue;

    // 匹配关键词（同时检查 href 路径和链接文本）
    const matchText = `${link.href} ${link.text}`;
    const rule = KEYWORD_RULES.find((r) => r.pattern.test(matchText));
    if (!rule) continue;

    // 同标签去重（保留第一个匹配）
    if (discoveries.some((d) => d.label === rule.label)) continue;

    seen.add(normalized);
    discoveries.push({
      url: resolved,
      label: rule.label,
      priority: rule.priority,
    });
  }

  // 按优先级排序，限量
  return discoveries
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_SUB_PAGES);
}

function resolveUrl(href: string, base: string): string | null {
  if (/^(mailto:|tel:|javascript:|#)/.test(href)) return null;

  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
