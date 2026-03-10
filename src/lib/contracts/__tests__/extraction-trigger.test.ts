/**
 * Tests for extraction trigger after Confirm.
 *
 * P0-G3: Extraction triggers at Confirm time, not after DocuSign signing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/security/sentry", () => ({
  captureError: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { triggerExtractionAfterConfirm } from "../extraction-trigger";
import { captureError } from "@/lib/security/sentry";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_BASE_URL = "https://test.example.com";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
});

// ── Tests ──

describe("triggerExtractionAfterConfirm", () => {
  it("skips when no buildings exist", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    const result = await triggerExtractionAfterConfirm("sup-1");
    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips when buildings query returns null", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null }),
      }),
    });

    const result = await triggerExtractionAfterConfirm("sup-1");
    expect(result.skipped).toBe(true);
  });

  it("triggers extraction for each building", async () => {
    const buildings = [{ id: "b-1" }, { id: "b-2" }];

    mockFrom.mockImplementation((table: string) => {
      if (table === "buildings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: buildings }),
          }),
        };
      }
      // suppliers table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { website_url: "https://example.com" },
            }),
          }),
        }),
      };
    });

    mockFetch.mockResolvedValue({ ok: true });

    const result = await triggerExtractionAfterConfirm("sup-1");

    expect(result.triggered).toBe(2);
    expect(result.skipped).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify payload does NOT include contractPdfUrl
    const firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(firstCallBody.buildingId).toBe("b-1");
    expect(firstCallBody.supplierId).toBe("sup-1");
    expect(firstCallBody.websiteUrl).toBe("https://example.com");
    expect(firstCallBody.contractPdfUrl).toBeUndefined();
  });

  it("captures exception on fetch failure without throwing", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "buildings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: "b-1" }] }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { website_url: null } }),
          }),
        }),
      };
    });

    mockFetch.mockRejectedValue(new Error("network error"));

    const result = await triggerExtractionAfterConfirm("sup-1");

    expect(result.triggered).toBe(0);
    expect(captureError).toHaveBeenCalledWith(
      "confirm.extraction_trigger",
      expect.any(Error),
    );
  });
});
