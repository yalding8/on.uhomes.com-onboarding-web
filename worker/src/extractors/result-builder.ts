/** 构建提取结果元数据 */

import type { SiteProfile } from "../crawl/site-probe.js";
import type { ExtractedFields } from "../types.js";
import type { ExtractionResult } from "./index.js";

const TIER_A_KEYS = [
  "building_name",
  "building_address",
  "city",
  "country",
  "postal_code",
  "primary_contact_name",
  "primary_contact_email",
  "currency",
];
const TIER_B_KEYS = [
  "price_min",
  "price_max",
  "cover_image",
  "key_amenities",
  "unit_types_summary",
  "description",
  "total_units",
  "images",
  "application_link",
  "application_method",
];

interface ResultParams {
  fields: ExtractedFields;
  sourceUrl: string;
  profile: SiteProfile;
  strategy: string;
  llmSkipped: boolean;
  llmProvider: string | null;
  validationIssues: number;
  llmValQuality: string;
  llmValAdj: number;
  llmValRem: number;
  timings: { probe: number; scrape: number; llm: number };
  totalStart: number;
}

export function buildResult(p: ResultParams): ExtractionResult {
  const dist = { high: 0, medium: 0, low: 0 };
  for (const f of Object.values(p.fields)) {
    const c = f.confidence as keyof typeof dist;
    if (c in dist) dist[c]++;
  }
  let domain = "";
  try {
    domain = new URL(p.sourceUrl).hostname;
  } catch {
    domain = p.sourceUrl;
  }

  const totalCount = Object.keys(p.fields).length;
  const tierACount = TIER_A_KEYS.filter((k) => k in p.fields).length;
  const tierBCount = TIER_B_KEYS.filter((k) => k in p.fields).length;
  const allTargets = TIER_A_KEYS.length + TIER_B_KEYS.length;

  return {
    fields: p.fields,
    meta: {
      sourceUrl: p.sourceUrl,
      urlDomain: domain,
      siteType: p.profile.type,
      siteFramework: p.profile.framework,
      siteComplexity: p.profile.estimatedComplexity,
      strategyUsed: p.strategy,
      hasJsonLd: p.profile.hasJsonLd,
      hasOpenGraph: p.profile.hasOpenGraph,
      cloudflareLevel: p.profile.cloudflareLevel,
      llmSkipped: p.llmSkipped,
      llmProvider: p.llmProvider,
      fieldCoverageRatio: allTargets > 0 ? totalCount / allTargets : 0,
      tierACoverageRatio:
        TIER_A_KEYS.length > 0 ? tierACount / TIER_A_KEYS.length : 0,
      tierBCoverageRatio:
        TIER_B_KEYS.length > 0 ? tierBCount / TIER_B_KEYS.length : 0,
      totalFieldCount: totalCount,
      confidenceHigh: dist.high,
      confidenceMedium: dist.medium,
      confidenceLow: dist.low,
      validationIssues: p.validationIssues,
      llmValidationQuality: p.llmValQuality,
      llmValidationAdjustments: p.llmValAdj,
      llmValidationRemovals: p.llmValRem,
      probeDurationMs: p.timings.probe,
      scrapeDurationMs: p.timings.scrape,
      llmDurationMs: p.timings.llm,
      totalDurationMs: Date.now() - p.totalStart,
    },
  };
}
