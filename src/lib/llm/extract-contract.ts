/**
 * 合同 PDF 文本 → LLM 提取 9 个合同字段
 */

import { getProvider } from "./config";
import { chatCompletion } from "./client";
import type { ChatMessage } from "./types";
import type { ContractFields } from "@/lib/contracts/types";
import { CONTRACT_FIELD_KEYS } from "@/lib/contracts/types";

const SYSTEM_PROMPT = `You are a contract analysis expert. Your task is to extract structured fields from a contract document.

Return a JSON object with these exact keys:
- partner_company_name: The partner/client company name (the other party, not uhomes)
- partner_contact_name: The contact person's name for the partner
- partner_address: The partner's street address
- partner_city: The partner's city
- partner_country: The partner's country
- commission_rate: The commission rate as a plain number string (e.g. "15" for 15%, "7.5" for 7.5%)
- contract_start_date: Contract start date in ISO format YYYY-MM-DD
- contract_end_date: Contract end date in ISO format YYYY-MM-DD
- covered_properties: List of properties/buildings covered, one per line

Rules:
1. If a field cannot be determined from the document, use empty string ""
2. For dates, always convert to YYYY-MM-DD format
3. For commission_rate, extract only the numeric value without % sign
4. Return ONLY the JSON object, no markdown fences or extra text`;

export interface ExtractionResult {
  fields: Partial<ContractFields>;
  provider: string;
  raw: string;
}

/**
 * 从合同文本中提取 9 个结构化字段
 */
export async function extractContractFields(
  pdfText: string,
): Promise<ExtractionResult> {
  const provider = getProvider();

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Please extract the contract fields from the following document:\n\n${pdfText}`,
    },
  ];

  const raw = await chatCompletion(provider, messages, {
    temperature: 0.1,
    jsonMode: true,
  });

  const fields = parseExtractedFields(raw);

  return { fields, provider: provider.name, raw };
}

/**
 * 解析 LLM 返回的 JSON，只保留合法字段
 */
function parseExtractedFields(raw: string): Partial<ContractFields> {
  const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const result: Partial<ContractFields> = {};
  for (const key of CONTRACT_FIELD_KEYS) {
    const val = parsed[key];
    if (typeof val === "string" && val.trim()) {
      result[key] = val.trim();
    }
  }

  return result;
}
