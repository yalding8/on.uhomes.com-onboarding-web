/**
 * OpenGraph + Twitter Card 元数据 → ExtractedFields 映射
 *
 * 从 og:*, twitter:* 等标签提取字段。
 * 作为 JSON-LD 映射之后、CSS/LLM 提取之前的补充层。
 */

import type { ExtractedFields } from "../types.js";

export function mapOpenGraphData(og: Record<string, string>): ExtractedFields {
  const fields: ExtractedFields = {};

  // 基础映射
  if (og.title) {
    fields.building_name = { value: og.title, confidence: "medium" };
  }
  if (og.description) {
    fields.description = { value: og.description, confidence: "medium" };
  }
  if (og.image) {
    fields.cover_image = { value: og.image, confidence: "medium" };
    fields.images = { value: [og.image], confidence: "low" };
  }

  // 地址信息（部分站点在 OG 中提供）
  const street = og["street-address"] || og["street_address"];
  if (street) {
    fields.building_address = { value: street, confidence: "medium" };
  }
  if (og.locality) {
    fields.city = { value: og.locality, confidence: "medium" };
  }
  const country = og["country-name"] || og["country_name"];
  if (country) {
    fields.country = { value: country, confidence: "medium" };
  }
  const postal = og["postal-code"] || og["postal_code"];
  if (postal) {
    fields.postal_code = { value: postal, confidence: "medium" };
  }

  // 联系信息
  if (og.phone_number) {
    fields.primary_contact_phone = {
      value: og.phone_number,
      confidence: "medium",
    };
  }
  if (og.email) {
    fields.primary_contact_email = {
      value: og.email,
      confidence: "medium",
    };
  }

  return fields;
}
