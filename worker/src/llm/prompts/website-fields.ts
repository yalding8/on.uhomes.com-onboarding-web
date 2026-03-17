/**
 * 网页提取 prompt — 针对 Tier B 字段（楼盘详情、费用、设施等）
 *
 * 从网页 Markdown + JSON-LD + 图片 URL 中提取楼盘信息。
 * 增强: 上下文注入已提取字段 + 仅要求补充缺失字段
 */

import type { ExtractedFields } from "../../types.js";

export const WEBSITE_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured property information from rental property websites.

Extract ONLY information explicitly present on the page. Do NOT guess or infer.
Output a valid JSON object using the exact field keys listed below.

## PRIORITY 1 — Must Extract (if available on page):
- "building_name": Property/building name
- "building_address": Full street address
- "city": City name
- "country": Country name
- "postal_code": Postal/ZIP code
- "price_min": Minimum rental price (number, no currency symbol)
- "price_max": Maximum rental price (number, no currency symbol)
- "currency": Currency code (USD, CAD, GBP, EUR, AUD, JPY, CNY)
- "primary_contact_email": Contact email
- "primary_contact_phone": Contact phone
- "cover_image": Main/hero image URL
- "key_amenities": Array of amenity tags from: ["Gym", "Pool", "Laundry", "Parking", "Study Room", "Rooftop", "Pet Friendly", "Furnished", "WiFi", "Security", "Bike Storage", "Game Room"]

## PRIORITY 2 — Extract if found:
- "description": Property description (brief summary)
- "total_units": Total units/bedspaces (number)
- "images": Array of gallery image URLs (up to 10)
- "unit_types_summary": Summary of unit types (e.g. "Studio, 1BR, 2BR")
- "application_link": Application/booking URL
- "application_method": Array from: ["Online", "Offline", "Both"]
- "lease_type": "Individual", "Joint", or "Both"
- "rental_method": "Per Unit", "Per Bedroom", or "Both"
- "utilities_included": What utilities are included
- "furnished_options": Furnished options description

## PRIORITY 3 — Extract only if clearly stated:
- "number_of_floors": Number of floors (number)
- "year_built": Year built (number)
- "elevator_available": Has elevator (true/false)
- "shuttle_service": Has shuttle service (true/false)
- "in_unit_washer_dryer": Has in-unit washer/dryer (true/false)
- "ac_heating_type": "Central thermostat", "Individual bedroom control", or "Other"
- "bed_included": "Yes - Twin", "Yes - Full", "Yes - Queen", "Yes - Other", or "No"
- "floor_plans": Floor plan descriptions
- "primary_contact_name": Contact name
- "leasing_manager_name": Leasing/property manager name

## Rules:
1. Return ONLY a valid JSON object — no explanations, no markdown
2. Focus effort on PRIORITY 1 fields first
3. For number fields, return numbers without currency symbols or commas
4. For images, return full absolute URLs
5. For key_amenities, ONLY use tags from the allowed list
6. If a field is not found, do NOT include it`;

export function buildWebsiteUserPrompt(
  title: string,
  bodyText: string,
  imageUrls: string[],
  jsonLd: Record<string, unknown>[],
  existingFields?: ExtractedFields,
  contactText?: string,
): string {
  const parts = [`Page title: ${title}`, `\nPage content:\n${bodyText}`];

  if (contactText) {
    parts.push(`\nContact information found in header/footer:\n${contactText}`);
  }

  if (imageUrls.length > 0) {
    parts.push(`\nImage URLs found:\n${imageUrls.join("\n")}`);
  }

  if (jsonLd.length > 0) {
    parts.push(
      `\nJSON-LD structured data:\n${JSON.stringify(jsonLd, null, 2)}`,
    );
  }

  // 上下文注入: 告知 LLM 哪些字段已提取，仅要求补充缺失字段
  if (existingFields && Object.keys(existingFields).length > 0) {
    const alreadyExtracted: Record<string, unknown> = {};
    for (const [key, fieldValue] of Object.entries(existingFields)) {
      alreadyExtracted[key] = fieldValue.value;
    }
    parts.push(
      `\nALREADY EXTRACTED (skip these, focus on missing PRIORITY 1 & 2 fields):`,
      JSON.stringify(alreadyExtracted, null, 2),
    );
  }

  return parts.join("\n");
}
