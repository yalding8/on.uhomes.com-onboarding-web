/**
 * S4.4: Trust Badge System
 *
 * Badge types awarded to suppliers based on verified criteria.
 * Some badges are auto-evaluated, others are manually awarded.
 */

export type BadgeType =
  | "verified_identity"
  | "verified_property"
  | "fast_responder"
  | "high_quality"
  | "uhomes_guaranteed"
  | "top_partner";

export interface BadgeDefinition {
  type: BadgeType;
  label: string;
  description: string;
  autoEvaluate: boolean;
}

export const BADGE_TYPES: ReadonlyArray<BadgeDefinition> = [
  {
    type: "verified_identity",
    label: "Verified Identity",
    description: "Identity has been verified through official documentation",
    autoEvaluate: false,
  },
  {
    type: "verified_property",
    label: "Verified Property",
    description: "Property verified through on-site or video inspection",
    autoEvaluate: false,
  },
  {
    type: "fast_responder",
    label: "Fast Responder",
    description: "Average response time under 4 hours",
    autoEvaluate: true,
  },
  {
    type: "high_quality",
    label: "High Quality",
    description: "All listings scored above 90",
    autoEvaluate: true,
  },
  {
    type: "uhomes_guaranteed",
    label: "uhomes Guaranteed",
    description: "Backed by uhomes guarantee program (manual approval)",
    autoEvaluate: false,
  },
  {
    type: "top_partner",
    label: "Top Partner",
    description: "Annual top-performing partner award",
    autoEvaluate: false,
  },
];

// ── Evaluation Input ──

export interface SupplierStats {
  identityVerified: boolean;
  propertyVerified: boolean;
  avgResponseHours: number;
  minListingScore: number;
  isGuaranteed: boolean;
  isTopPartner: boolean;
}

// ── Badge Evaluation ──

export function evaluateBadgeEligibility(stats: SupplierStats): BadgeType[] {
  const eligible: BadgeType[] = [];

  if (stats.identityVerified) eligible.push("verified_identity");
  if (stats.propertyVerified) eligible.push("verified_property");
  if (stats.avgResponseHours < 4) eligible.push("fast_responder");
  if (stats.minListingScore > 90) eligible.push("high_quality");
  if (stats.isGuaranteed) eligible.push("uhomes_guaranteed");
  if (stats.isTopPartner) eligible.push("top_partner");

  return eligible;
}

// ── Expiration Check ──

export function isBadgeExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}
