/**
 * LLM 自校验器 — 用独立 LLM 调用交叉验证提取结果
 *
 * 流程:
 * 1. 将提取结果 + 原始网页内容发给 LLM
 * 2. LLM 对每个字段给出 correct/suspect/wrong 判定
 * 3. 根据判定调整置信度:
 *    - correct: 保持或升级（medium → high）
 *    - suspect: 降级（high → medium）
 *    - wrong: 降级到 low 或移除
 *
 * 设计原则:
 * - 验证是 best-effort，LLM 失败不阻断主流程
 * - 使用较低 maxTokens（2048）和短上下文，控制成本
 * - 仅在提取字段 >= 3 时触发（太少不值得验证）
 */

import { chatCompletion } from "../llm/client.js";
import { getProvider } from "../llm/config.js";
import {
  VALIDATION_SYSTEM_PROMPT,
  buildValidationUserPrompt,
} from "../llm/prompts/validation-prompt.js";
import type { ExtractedFields, Confidence } from "../types.js";

/** 最少字段数才触发验证（低于此数不值得一次 LLM 调用） */
const MIN_FIELDS_FOR_VALIDATION = 3;

interface FieldVerdict {
  status: "correct" | "suspect" | "wrong";
  reason: string;
}

interface ValidationResponse {
  verdicts: Record<string, FieldVerdict>;
  overall_quality: "high" | "medium" | "low";
  cross_field_issues: string[];
}

export interface LlmValidationResult {
  fields: ExtractedFields;
  validated: boolean;
  overallQuality: "high" | "medium" | "low" | "skipped";
  adjustments: number;
  removals: number;
}

const CONFIDENCE_UP: Record<Confidence, Confidence> = {
  low: "medium",
  medium: "high",
  high: "high",
};

const CONFIDENCE_DOWN: Record<Confidence, Confidence> = {
  high: "medium",
  medium: "low",
  low: "low",
};

/**
 * 用 LLM 交叉验证提取结果
 *
 * @param fields 已提取的字段
 * @param pageTitle 原始页面标题
 * @param bodyText 原始页面文本
 * @param signal AbortSignal
 * @returns 验证后的字段（置信度可能被调整）
 */
export async function validateWithLlm(
  fields: ExtractedFields,
  pageTitle: string,
  bodyText: string,
  signal: AbortSignal,
): Promise<LlmValidationResult> {
  const fieldCount = Object.keys(fields).length;

  // 字段太少，跳过验证
  if (fieldCount < MIN_FIELDS_FOR_VALIDATION) {
    return {
      fields,
      validated: false,
      overallQuality: "skipped",
      adjustments: 0,
      removals: 0,
    };
  }

  try {
    const provider = getProvider();
    const userPrompt = buildValidationUserPrompt(pageTitle, bodyText, fields);

    const raw = await chatCompletion(
      provider,
      [
        { role: "system", content: VALIDATION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { jsonMode: true, maxTokens: 2048, temperature: 0.1, signal },
    );

    const response = parseValidationResponse(raw);
    if (!response) {
      console.error("[llm-validator] Failed to parse validation response");
      return {
        fields,
        validated: false,
        overallQuality: "skipped",
        adjustments: 0,
        removals: 0,
      };
    }

    // 根据判定调整置信度
    return applyVerdicts(fields, response);
  } catch (err) {
    // 验证失败不阻断主流程
    if (err instanceof Error && err.name === "AbortError") throw err;
    console.error(
      "[llm-validator] Validation failed (non-blocking):",
      (err as Error).message,
    );
    return {
      fields,
      validated: false,
      overallQuality: "skipped",
      adjustments: 0,
      removals: 0,
    };
  }
}

function parseValidationResponse(raw: string): ValidationResponse | null {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline !== -1) cleaned = cleaned.slice(firstNewline + 1);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3).trim();
  }

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (!parsed.verdicts || typeof parsed.verdicts !== "object") return null;

    return {
      verdicts: parsed.verdicts as Record<string, FieldVerdict>,
      overall_quality:
        (parsed.overall_quality as "high" | "medium" | "low") ?? "medium",
      cross_field_issues: Array.isArray(parsed.cross_field_issues)
        ? (parsed.cross_field_issues as string[])
        : [],
    };
  } catch {
    return null;
  }
}

function applyVerdicts(
  fields: ExtractedFields,
  response: ValidationResponse,
): LlmValidationResult {
  const result: ExtractedFields = { ...fields };
  let adjustments = 0;
  let removals = 0;

  for (const [key, verdict] of Object.entries(response.verdicts)) {
    if (!result[key]) continue;

    const current = result[key].confidence;

    switch (verdict.status) {
      case "correct": {
        // 升级置信度（medium → high）
        const upgraded = CONFIDENCE_UP[current];
        if (upgraded !== current) {
          result[key] = { ...result[key], confidence: upgraded };
          adjustments++;
        }
        break;
      }
      case "suspect": {
        // 降级一级（high → medium, medium → low）
        const downgraded = CONFIDENCE_DOWN[current];
        if (downgraded !== current) {
          result[key] = { ...result[key], confidence: downgraded };
          adjustments++;
        }
        break;
      }
      case "wrong": {
        // 已经是 low 的直接移除，否则降到 low
        if (current === "low") {
          delete result[key];
          removals++;
        } else {
          result[key] = { ...result[key], confidence: "low" };
          adjustments++;
        }
        break;
      }
    }
  }

  // Log cross-field issues
  if (response.cross_field_issues.length > 0) {
    console.error(
      `[llm-validator] Cross-field issues: ${response.cross_field_issues.join("; ")}`,
    );
  }

  console.error(
    `[llm-validator] Quality=${response.overall_quality}, adjustments=${adjustments}, removals=${removals}`,
  );

  return {
    fields: result,
    validated: true,
    overallQuality: response.overall_quality,
    adjustments,
    removals,
  };
}
