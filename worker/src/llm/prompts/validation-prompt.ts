/**
 * LLM 自校验 prompt — 对提取结果进行交叉验证
 *
 * 用独立的 LLM 调用检查已提取字段的合理性：
 * - 价格范围是否符合当地市场
 * - 地址完整性
 * - 字段间一致性（货币 vs 价格、城市 vs 国家）
 * - 明显的幻觉检测
 */

import type { ExtractedFields } from "../../types.js";

export const VALIDATION_SYSTEM_PROMPT = `You are a quality assurance expert for rental property data extraction. Your job is to validate extracted property data against the original webpage content and flag any issues.

You will receive:
1. The original webpage text (truncated)
2. A JSON object of extracted fields with their values

For each field, assess whether the extracted value is:
- "correct": Value is clearly supported by the webpage content
- "suspect": Value seems plausible but cannot be confirmed from content, or has minor issues
- "wrong": Value contradicts the webpage content or is clearly fabricated

Also check cross-field consistency:
- currency should match the country/region (USD for US, GBP for UK, AUD for AU, CAD for CA)
- price_min should be less than price_max
- price_period should match the actual pricing shown on the page (look for "/mo", "/month", "/night", "/day", "/week"). If price_period is "monthly" but prices seem too low (<$100), flag as suspect — it may be a daily rate. If price_period is "daily" but prices seem too high (>$1000), flag as suspect — it may be a monthly rate.
- city + country should be geographically consistent
- building_address should match city/country
- total_units and number_of_floors should be reasonable for the building type

Output a JSON object with this structure:
{
  "verdicts": {
    "<field_key>": {
      "status": "correct" | "suspect" | "wrong",
      "reason": "brief explanation"
    }
  },
  "overall_quality": "high" | "medium" | "low",
  "cross_field_issues": ["description of any cross-field inconsistencies"]
}

Rules:
1. Return ONLY valid JSON — no explanations, no markdown
2. Only include fields that are present in the extracted data
3. Be strict: if a value cannot be verified from the content, mark it "suspect"
4. Be especially strict with numeric values (prices, units, floors)`;

export function buildValidationUserPrompt(
  title: string,
  bodyText: string,
  extractedFields: ExtractedFields,
): string {
  // Truncate body text for validation (shorter than extraction — we only need enough to verify)
  const maxLen = 20_000;
  const truncated =
    bodyText.length > maxLen
      ? bodyText.slice(0, maxLen) + "\n\n[... truncated ...]"
      : bodyText;

  const fieldsForValidation: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(extractedFields)) {
    fieldsForValidation[key] = fieldValue.value;
  }

  return [
    `Page title: ${title}`,
    `\nPage content:\n${truncated}`,
    `\nExtracted fields to validate:\n${JSON.stringify(fieldsForValidation, null, 2)}`,
  ].join("\n");
}
