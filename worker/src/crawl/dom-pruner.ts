/**
 * 文本密度 DOM 裁剪器 — 基于文本密度算法移除 boilerplate
 *
 * 算法思路（简化版 AXE 论文）：
 * 1. 遍历块级元素，计算文本密度（纯文本/HTML总长度）和链接密度
 * 2. 低密度 + 高链接密度 = 导航/boilerplate → 移除
 * 3. 匹配已知 boilerplate 选择器 → 移除
 * 4. 含 <table> 的元素保护不删（价格表/设施表）
 */

import * as cheerio from "cheerio";

/** 文本密度阈值（低于此值视为 boilerplate 候选） */
export const DENSITY_THRESHOLD = 0.25;

/** 链接密度阈值（高于此值视为导航密集区） */
export const LINK_DENSITY_THRESHOLD = 0.5;

/** 已知 boilerplate CSS 选择器 */
export const BOILERPLATE_SELECTORS: string[] = [
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[class*='ad-']",
  "[class*='ad_']",
  "[class*='ads-']",
  ".banner:not(.hero-banner)",
  "[class*='popup']",
  "[class*='modal']",
  "[class*='sidebar']",
  "[class*='widget']",
  "[role='banner']",
  "[role='navigation']",
  "[role='complementary']",
  "[class*='newsletter']",
  "[class*='subscribe']",
  "[class*='social-']",
  "[class*='share-']",
];

interface DensityResult {
  textDensity: number;
  linkDensity: number;
}

/** 计算 HTML 片段的文本密度和链接密度 */
export function computeTextDensity(html: string): DensityResult {
  const $ = cheerio.load(html, { xml: false });

  const textLength = $.root().text().replace(/\s+/g, " ").trim().length;
  const htmlLength = html.length;

  if (htmlLength === 0) return { textDensity: 0, linkDensity: 0 };

  const linkText = $("a")
    .map((_, el) => $(el).text())
    .get()
    .join("")
    .replace(/\s+/g, " ")
    .trim().length;

  return {
    textDensity: textLength / htmlLength,
    linkDensity: textLength > 0 ? linkText / textLength : 0,
  };
}

/**
 * 裁剪 HTML 中的 boilerplate 内容
 * @param html 原始 HTML 字符串
 * @returns 裁剪后的 HTML 字符串
 */
export function pruneBoilerplate(html: string): string {
  const $ = cheerio.load(html, { xml: false });

  // 1. 移除已知 boilerplate 选择器
  for (const selector of BOILERPLATE_SELECTORS) {
    try {
      $(selector).remove();
    } catch {
      // 部分选择器在某些 HTML 中可能无效
    }
  }

  // 2. 文本密度裁剪：遍历顶层块级元素
  const blockSelectors = "div, section, aside, article";
  $("body")
    .find(blockSelectors)
    .each((_, el) => {
      const $el = $(el);

      // 保护含 table 的元素
      if ($el.find("table").length > 0) return;

      // 跳过深层嵌套（只裁剪前两层）
      const depth = $el.parents(blockSelectors).length;
      if (depth > 2) return;

      const outerHtml = $.html(el) ?? "";
      if (outerHtml.length < 100) return; // 太短的元素不值得计算

      const density = computeTextDensity(outerHtml);

      if (
        density.textDensity < DENSITY_THRESHOLD &&
        density.linkDensity > LINK_DENSITY_THRESHOLD
      ) {
        $el.remove();
      }
    });

  return $.html() ?? html;
}
