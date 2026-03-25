/**
 * 字段后处理 — 在 LLM 提取后、校验前统一清洗数据
 *
 * 1. building_name: 去除 "|" / " - " 分隔的 tagline
 * 2. images/cover_image: 相对 URL → 绝对 URL
 * 3. description: 去除 HTML 标签
 * 4. building_address: 去除混入的电话/email
 */

import type { ExtractedFields } from "../types.js";

export function postprocessFields(
  fields: ExtractedFields,
  sourceUrl: string,
): void {
  cleanBuildingName(fields);
  resolveImageUrls(fields, sourceUrl);
  stripHtmlFields(fields);
  cleanAddress(fields);
}

function cleanBuildingName(fields: ExtractedFields): void {
  const f = fields.building_name;
  if (!f || typeof f.value !== "string") return;
  // "Sable | Apartments in JC | Veris" → "Sable"
  // "The Beacon - Luxury Apartments - Jersey City" → "The Beacon"
  let name = f.value;
  for (const sep of [" | ", " - ", " — ", " – "]) {
    if (name.includes(sep)) {
      const first = name.split(sep)[0].trim();
      if (first.length >= 3) {
        name = first;
        break;
      }
    }
  }
  if (name !== f.value) {
    fields.building_name = { ...f, value: name };
  }
}

function resolveImageUrls(fields: ExtractedFields, baseUrl: string): void {
  // cover_image
  const cover = fields.cover_image;
  if (cover && typeof cover.value === "string") {
    const resolved = resolveUrl(cover.value, baseUrl);
    if (resolved !== cover.value) {
      fields.cover_image = { ...cover, value: resolved };
    }
  }
  // images array
  const imgs = fields.images;
  if (imgs && Array.isArray(imgs.value)) {
    const resolved = (imgs.value as string[]).map((u) =>
      typeof u === "string" ? resolveUrl(u, baseUrl) : u,
    );
    fields.images = { ...imgs, value: resolved };
  }
}

function resolveUrl(url: string, base: string): string {
  if (!url || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

function stripHtmlFields(fields: ExtractedFields): void {
  const textFields = ["description", "unit_types_summary"];
  for (const key of textFields) {
    const f = fields[key];
    if (!f || typeof f.value !== "string") continue;
    const stripped = stripHtml(f.value);
    if (stripped !== f.value) {
      fields[key] = { ...f, value: stripped };
    }
  }
}

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanAddress(fields: ExtractedFields): void {
  const f = fields.building_address;
  if (!f || typeof f.value !== "string") return;
  let addr = f.value;
  // 去除混入的电话号码
  addr = addr.replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "").trim();
  // 去除混入的 email
  addr = addr.replace(/\S+@\S+\.\S+/g, "").trim();
  // 清理多余逗号和空格
  addr = addr.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
  if (addr !== f.value) {
    fields.building_address = { ...f, value: addr };
  }
}
