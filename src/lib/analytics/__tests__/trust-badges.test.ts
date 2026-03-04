import { describe, it, expect } from "vitest";
import {
  BADGE_TYPES,
  evaluateBadgeEligibility,
  isBadgeExpired,
  type SupplierStats,
  type BadgeType,
} from "../trust-badges";

describe("BADGE_TYPES", () => {
  it("contains all 6 badge types", () => {
    expect(BADGE_TYPES).toHaveLength(6);
    const names = BADGE_TYPES.map((b) => b.type);
    expect(names).toContain("verified_identity");
    expect(names).toContain("verified_property");
    expect(names).toContain("fast_responder");
    expect(names).toContain("high_quality");
    expect(names).toContain("uhomes_guaranteed");
    expect(names).toContain("top_partner");
  });

  it("each badge type has a label and description", () => {
    for (const badge of BADGE_TYPES) {
      expect(badge.label).toBeTruthy();
      expect(badge.description).toBeTruthy();
    }
  });
});

describe("evaluateBadgeEligibility", () => {
  it("returns fast_responder when avg response < 4 hours", () => {
    const stats: SupplierStats = {
      identityVerified: false,
      propertyVerified: false,
      avgResponseHours: 3.5,
      minListingScore: 70,
      isGuaranteed: false,
      isTopPartner: false,
    };
    const eligible = evaluateBadgeEligibility(stats);
    expect(eligible).toContain("fast_responder");
    expect(eligible).not.toContain("high_quality");
  });

  it("returns high_quality when all listings > 90", () => {
    const stats: SupplierStats = {
      identityVerified: false,
      propertyVerified: false,
      avgResponseHours: 10,
      minListingScore: 91,
      isGuaranteed: false,
      isTopPartner: false,
    };
    const eligible = evaluateBadgeEligibility(stats);
    expect(eligible).toContain("high_quality");
    expect(eligible).not.toContain("fast_responder");
  });

  it("returns all auto-badges when all criteria met", () => {
    const stats: SupplierStats = {
      identityVerified: true,
      propertyVerified: true,
      avgResponseHours: 2,
      minListingScore: 95,
      isGuaranteed: true,
      isTopPartner: true,
    };
    const eligible = evaluateBadgeEligibility(stats);
    expect(eligible).toHaveLength(6);
  });

  it("returns empty array when no criteria met", () => {
    const stats: SupplierStats = {
      identityVerified: false,
      propertyVerified: false,
      avgResponseHours: 10,
      minListingScore: 50,
      isGuaranteed: false,
      isTopPartner: false,
    };
    const eligible = evaluateBadgeEligibility(stats);
    expect(eligible).toHaveLength(0);
  });

  it("does not include fast_responder at exactly 4 hours", () => {
    const stats: SupplierStats = {
      identityVerified: false,
      propertyVerified: false,
      avgResponseHours: 4,
      minListingScore: 50,
      isGuaranteed: false,
      isTopPartner: false,
    };
    const eligible = evaluateBadgeEligibility(stats);
    expect(eligible).not.toContain("fast_responder");
  });
});

describe("isBadgeExpired", () => {
  it("returns false when expires_at is null (never expires)", () => {
    expect(isBadgeExpired(null)).toBe(false);
  });

  it("returns true when expires_at is in the past", () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    expect(isBadgeExpired(past)).toBe(true);
  });

  it("returns false when expires_at is in the future", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    expect(isBadgeExpired(future)).toBe(false);
  });
});
