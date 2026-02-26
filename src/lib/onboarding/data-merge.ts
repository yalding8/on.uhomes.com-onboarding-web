/**
 * Data Merge — 多源数据融合模块。
 *
 * 1. mergeExtractionResults(): 将多个 External Worker 提取结果按优先级合并
 *    优先级: contract_pdf > google_sheets > website_crawl
 *
 * 2. mergeWithProtection(): 将新提取数据合并到已有字段，保护已确认字段
 *
 * Requirements: 1.6, 1.7, 8.3
 */

import type { FieldValue, DataSource, Confidence } from "./field-value";

// ── Types ──

export interface ExtractionFieldValue {
  value: unknown;
  confidence: Confidence;
}

export interface ExtractionResult {
  source: DataSource;
  fields: Record<string, ExtractionFieldValue>;
}

// ── Priority ──

/** 数据源优先级（数值越高越优先） */
const SOURCE_PRIORITY: Record<DataSource, number> = {
  contract_pdf: 3,
  google_sheets: 2,
  website_crawl: 1,
  manual_input: 0,
};

// ── Core Functions ──

/**
 * 将多个 External Worker 的提取结果按优先级融合为统一的 FieldValue 字典。
 *
 * 对于同一字段出现在多个来源中的情况，选择优先级最高的来源值。
 * 每个字段都携带 source、confidence、updatedBy、updatedAt 元数据。
 */
export function mergeExtractionResults(
  results: ExtractionResult[],
): Record<string, FieldValue> {
  const merged: Record<string, FieldValue> = {};
  const now = new Date().toISOString();

  // 按优先级从低到高排序，后写入的高优先级覆盖低优先级
  const sorted = [...results].sort(
    (a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source],
  );

  for (const result of sorted) {
    for (const [key, extracted] of Object.entries(result.fields)) {
      // 跳过空值
      if (extracted.value === null || extracted.value === undefined) continue;
      if (typeof extracted.value === "string" && extracted.value.trim() === "")
        continue;
      if (Array.isArray(extracted.value) && extracted.value.length === 0)
        continue;

      merged[key] = {
        value: extracted.value,
        source: result.source,
        confidence: extracted.confidence,
        updatedBy: "system",
        updatedAt: now,
      };
    }
  }

  return merged;
}

/**
 * 将新提取的数据合并到已有字段值中，保护已确认字段。
 *
 * 规则:
 * - 已确认字段（confirmedBy 不为空）不被覆盖
 * - 未确认字段按来源优先级决定是否覆盖
 * - 新字段（existing 中不存在的）直接写入
 */
export function mergeWithProtection(
  existing: Record<string, FieldValue>,
  incoming: Record<string, FieldValue>,
): Record<string, FieldValue> {
  const merged = { ...existing };

  for (const [key, incomingValue] of Object.entries(incoming)) {
    const existingValue = merged[key];

    // 新字段：直接写入
    if (!existingValue) {
      merged[key] = incomingValue;
      continue;
    }

    // 已确认字段：跳过，不覆盖
    if (existingValue.confirmedBy) {
      continue;
    }

    // 未确认字段：优先级更高或相同时覆盖
    const existingPriority = SOURCE_PRIORITY[existingValue.source] ?? 0;
    const incomingPriority = SOURCE_PRIORITY[incomingValue.source] ?? 0;

    if (incomingPriority >= existingPriority) {
      merged[key] = incomingValue;
    }
  }

  return merged;
}
