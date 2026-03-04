/**
 * S3.1 Account Deletion — Unit Tests
 * Test IDs: S3-I01, S3-I02 (unit-level logic tests)
 */
import { describe, it, expect, vi } from "vitest";
import {
  checkDeletionEligibility,
  markForDeletion,
  type DeletionCheckResult,
} from "../account-deletion";

// Mock Supabase client
function createMockSupabase(overrides: {
  publishedCount?: number;
  activeContractCount?: number;
  updateError?: string | null;
}) {
  const {
    publishedCount = 0,
    activeContractCount = 0,
    updateError = null,
  } = overrides;

  return {
    from: vi.fn((table: string) => {
      if (table === "buildings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                count: publishedCount,
              })),
            })),
          })),
        };
      }
      if (table === "contracts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                count: activeContractCount,
              })),
            })),
          })),
        };
      }
      if (table === "suppliers") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              error: updateError ? { message: updateError } : null,
            })),
          })),
        };
      }
      return {};
    }),
  };
}

describe("checkDeletionEligibility", () => {
  // S3-I01: Supplier with no active bookings → can delete
  it("allows deletion when no published buildings and no active contracts", async () => {
    const supabase = createMockSupabase({
      publishedCount: 0,
      activeContractCount: 0,
    });

    const result: DeletionCheckResult = await checkDeletionEligibility(
      supabase as never,
      "supplier-123",
    );

    expect(result.canDelete).toBe(true);
  });

  // S3-I02: Supplier with active bookings → blocked
  it("blocks deletion when published buildings exist", async () => {
    const supabase = createMockSupabase({ publishedCount: 2 });

    const result = await checkDeletionEligibility(
      supabase as never,
      "supplier-123",
    );

    expect(result.canDelete).toBe(false);
    if (!result.canDelete) {
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0].type).toBe("active_bookings");
      expect(result.blockers[0].count).toBe(2);
    }
  });

  it("blocks deletion when active contracts exist", async () => {
    const supabase = createMockSupabase({ activeContractCount: 1 });

    const result = await checkDeletionEligibility(
      supabase as never,
      "supplier-123",
    );

    expect(result.canDelete).toBe(false);
    if (!result.canDelete) {
      expect(result.blockers[0].type).toBe("unsettled_commissions");
    }
  });

  it("returns multiple blockers when both conditions fail", async () => {
    const supabase = createMockSupabase({
      publishedCount: 1,
      activeContractCount: 2,
    });

    const result = await checkDeletionEligibility(
      supabase as never,
      "supplier-123",
    );

    expect(result.canDelete).toBe(false);
    if (!result.canDelete) {
      expect(result.blockers).toHaveLength(2);
    }
  });
});

describe("markForDeletion", () => {
  it("returns success with deletion date 30 days ahead", async () => {
    const supabase = createMockSupabase({});
    const result = await markForDeletion(supabase as never, "supplier-123");

    expect(result.success).toBe(true);
    const deletionDate = new Date(result.deletionDate);
    const now = new Date();
    const daysDiff = Math.round(
      (deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(daysDiff).toBe(30);
  });

  it("throws when update fails", async () => {
    const supabase = createMockSupabase({
      updateError: "Permission denied",
    });

    await expect(
      markForDeletion(supabase as never, "supplier-123"),
    ).rejects.toThrow("Failed to mark supplier for deletion");
  });
});
