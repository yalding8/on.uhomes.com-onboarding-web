/**
 * callback.ts 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendCallback } from "./callback.js";
import type { CallbackPayload } from "./types.js";

// Mock config
vi.mock("./config.js", () => ({
  getConfig: () => ({
    port: 3000,
    supabaseServiceRoleKey: "test-service-key",
    jobTimeoutMs: 300000,
  }),
}));

const mockPayload: CallbackPayload = {
  jobId: "job-123",
  buildingId: "building-456",
  source: "contract_pdf",
  extractedFields: {
    building_name: { value: "Test Building", confidence: "high" },
  },
  status: "success",
};

describe("sendCallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should send callback with correct headers and body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await sendCallback("https://example.com/callback", mockPayload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/callback");
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-service-key",
    );
    expect(JSON.parse(options.body as string)).toEqual(mockPayload);
  });

  it("should retry once on failure then succeed", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await sendCallback("https://example.com/callback", mockPayload);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should log error after all retries exhausted", async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn().mockRejectedValue(new Error("Always fails"));
    vi.stubGlobal("fetch", mockFetch);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const promise = sendCallback("https://example.com/callback", mockPayload);

    // Advance through all retry delays
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
    }

    await promise;

    // 4 total attempts: initial + 3 retries
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(consoleSpy).toHaveBeenCalled();
    vi.useRealTimers();
  }, 15_000);

  it("should retry on non-ok HTTP response", async () => {
    vi.useFakeTimers();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const promise = sendCallback("https://example.com/callback", mockPayload);

    // Advance through retry delay
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(5_000);
    }

    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  }, 15_000);
});
