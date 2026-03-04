/**
 * S2.2: Standard amenity taxonomy with alias-based fuzzy matching.
 *
 * Catalog data lives in ./amenity-catalog.ts (split for 300-line policy).
 */

export type AmenityCategory =
  | "building_safety"
  | "fitness_recreation"
  | "common_areas"
  | "technology"
  | "parking_transport"
  | "laundry"
  | "outdoor"
  | "pet"
  | "accessibility"
  | "kitchen_dining";

export type { AmenityEntry } from "./amenity-catalog";
export { AMENITY_CATALOG } from "./amenity-catalog";

import { AMENITY_CATALOG } from "./amenity-catalog";
import type { AmenityEntry } from "./amenity-catalog";

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export type MatchResult =
  | {
      matched: true;
      amenity: AmenityEntry;
      method: "exact" | "alias" | "fuzzy";
    }
  | { matched: false; raw: string };

/**
 * Normalize a raw amenity name to a canonical entry.
 *
 * 1. Exact match on canonicalName (case-insensitive)
 * 2. Exact match on aliases
 * 3. Levenshtein distance ≤ 2 (fuzzy match)
 * 4. Returns unmatched if none found
 */
export function normalizeAmenity(rawName: string): MatchResult {
  const normalized = rawName.trim().toLowerCase();
  if (!normalized) return { matched: false, raw: rawName };

  // Step 1: Exact canonical name match
  for (const entry of AMENITY_CATALOG) {
    if (entry.canonicalName.toLowerCase() === normalized) {
      return { matched: true, amenity: entry, method: "exact" };
    }
  }

  // Step 2: Alias match
  for (const entry of AMENITY_CATALOG) {
    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === normalized) {
        return { matched: true, amenity: entry, method: "alias" };
      }
    }
  }

  // Step 3: Fuzzy match (Levenshtein ≤ 2)
  for (const entry of AMENITY_CATALOG) {
    if (levenshtein(entry.canonicalName.toLowerCase(), normalized) <= 2) {
      return { matched: true, amenity: entry, method: "fuzzy" };
    }
    for (const alias of entry.aliases) {
      if (levenshtein(alias.toLowerCase(), normalized) <= 2) {
        return { matched: true, amenity: entry, method: "fuzzy" };
      }
    }
  }

  return { matched: false, raw: rawName };
}
