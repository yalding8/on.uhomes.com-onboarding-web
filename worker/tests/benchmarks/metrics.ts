/**
 * 基准测试评价指标
 *
 * 参考 ScrapeGraphAI-100k 基准，计算提取质量和性能指标。
 */

import type { ExtractedFields } from "../../src/types.js";

export interface BenchmarkMetrics {
  /** 字段覆盖率 = 成功提取字段数 / 预期字段数 */
  fieldCoverage: number;
  /** 字段准确率 = 提取值与预期一致的字段数 / 总提取数 */
  fieldAccuracy: number;
  /** 幻觉率 = 页面不存在但 LLM 编造的字段数 / 总提取数 */
  hallucinationRate: number;
  /** 置信度分布 */
  confidenceDistribution: { high: number; medium: number; low: number };
  /** 提取耗时 (ms) */
  latencyMs: number;
}

interface ExpectedField {
  key: string;
  value: unknown;
  /** 该字段在源页面上是否确实存在 */
  presentOnPage: boolean;
}

/** 计算单次提取的评价指标 */
export function computeMetrics(
  extracted: ExtractedFields,
  expected: ExpectedField[],
  latencyMs: number,
): BenchmarkMetrics {
  const extractedKeys = new Set(Object.keys(extracted));
  const expectedPresent = expected.filter((f) => f.presentOnPage);
  // 覆盖率
  const covered = expectedPresent.filter((f) => extractedKeys.has(f.key));
  const fieldCoverage =
    expectedPresent.length > 0 ? covered.length / expectedPresent.length : 0;

  // 准确率
  let accurateCount = 0;
  for (const exp of covered) {
    const extracted_value = extracted[exp.key]?.value;
    if (valuesMatch(extracted_value, exp.value)) {
      accurateCount++;
    }
  }
  const fieldAccuracy = covered.length > 0 ? accurateCount / covered.length : 0;

  // 幻觉率 — 提取了但页面上不存在的字段
  const notOnPage = expected.filter((f) => !f.presentOnPage);
  const notOnPageKeys = new Set(notOnPage.map((f) => f.key));
  let hallucinatedCount = 0;
  for (const key of extractedKeys) {
    if (notOnPageKeys.has(key)) hallucinatedCount++;
  }
  const hallucinationRate =
    extractedKeys.size > 0 ? hallucinatedCount / extractedKeys.size : 0;

  // 置信度分布
  const dist = { high: 0, medium: 0, low: 0 };
  for (const field of Object.values(extracted)) {
    if (field.confidence in dist) {
      dist[field.confidence]++;
    }
  }

  return {
    fieldCoverage,
    fieldAccuracy,
    hallucinationRate,
    confidenceDistribution: dist,
    latencyMs,
  };
}

/** 值比较 — 支持 string/number/boolean/array 的模糊匹配 */
function valuesMatch(extracted: unknown, expected: unknown): boolean {
  if (extracted === expected) return true;

  // 数字比较（允许 ±1% 误差）
  if (typeof extracted === "number" && typeof expected === "number") {
    if (expected === 0) return extracted === 0;
    return Math.abs(extracted - expected) / Math.abs(expected) < 0.01;
  }

  // 字符串比较（忽略大小写和首尾空白）
  if (typeof extracted === "string" && typeof expected === "string") {
    return extracted.trim().toLowerCase() === expected.trim().toLowerCase();
  }

  // 数组比较（集合相等）
  if (Array.isArray(extracted) && Array.isArray(expected)) {
    const setA = new Set(extracted.map(String));
    const setB = new Set(expected.map(String));
    if (setA.size !== setB.size) return false;
    for (const item of setA) {
      if (!setB.has(item)) return false;
    }
    return true;
  }

  return false;
}

/** 聚合多次提取的指标 */
export function aggregateMetrics(results: BenchmarkMetrics[]): {
  avgCoverage: number;
  avgAccuracy: number;
  avgHallucination: number;
  p50Latency: number;
  p90Latency: number;
  p99Latency: number;
  totalRuns: number;
} {
  if (results.length === 0) {
    return {
      avgCoverage: 0,
      avgAccuracy: 0,
      avgHallucination: 0,
      p50Latency: 0,
      p90Latency: 0,
      p99Latency: 0,
      totalRuns: 0,
    };
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const percentile = (arr: number[], p: number) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };

  const latencies = results.map((r) => r.latencyMs);

  return {
    avgCoverage: avg(results.map((r) => r.fieldCoverage)),
    avgAccuracy: avg(results.map((r) => r.fieldAccuracy)),
    avgHallucination: avg(results.map((r) => r.hallucinationRate)),
    p50Latency: percentile(latencies, 50),
    p90Latency: percentile(latencies, 90),
    p99Latency: percentile(latencies, 99),
    totalRuns: results.length,
  };
}
