/**
 * OpenGraph 元数据 → ExtractedFields 映射
 *
 * 从 og:title, og:description, og:image 等标准 OG 标签提取字段。
 * 作为 JSON-LD 映射之后、LLM 提取之前的补充层。
 */

import type { ExtractedFields } from "../types.js";

export function mapOpenGraphData(og: Record<string, string>): ExtractedFields {
  const fields: ExtractedFields = {};

  if (og.title) {
    fields.building_name = { value: og.title, confidence: "medium" };
  }

  if (og.description) {
    fields.description = { value: og.description, confidence: "medium" };
  }

  if (og.image) {
    fields.cover_image = { value: og.image, confidence: "medium" };
  }

  if (og.url) {
    fields.application_link = { value: og.url, confidence: "low" };
  }

  return fields;
}
