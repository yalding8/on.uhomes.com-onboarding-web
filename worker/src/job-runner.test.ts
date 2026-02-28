/**
 * job-runner.ts 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("./config.js", () => ({
  getConfig: () => ({
    port: 3000,
    supabaseServiceRoleKey: "test-key",
    jobTimeoutMs: 5000, // 5 秒用于测试
  }),
}));

vi.mock("./job-tracker.js", () => ({
  trackJobStart: vi.fn(),
  trackJobEnd: vi.fn(),
}));

const mockSendCallback = vi.fn();
vi.mock("./callback.js", () => ({
  sendCallback: (...args: unknown[]) => mockSendCallback(...args),
}));

const mockExtract = vi.fn();
vi.mock("./extractors/index.js", () => ({
  extract: (...args: unknown[]) => mockExtract(...args),
}));

import { runJob } from "./job-runner.js";
import type { ExtractionRequest } from "./types.js";

const baseRequest: ExtractionRequest = {
  jobId: "job-1",
  source: "contract_pdf",
  buildingId: "building-1",
  supplierId: "supplier-1",
  sourceUrl: "https://example.com/contract.pdf",
  callbackUrl: "https://example.com/callback",
};

describe("runJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should callback failed when sourceUrl is empty", async () => {
    await runJob({ ...baseRequest, sourceUrl: "" });

    expect(mockSendCallback).toHaveBeenCalledWith(
      baseRequest.callbackUrl,
      expect.objectContaining({
        status: "failed",
        errorMessage: "Empty sourceUrl",
      }),
    );
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it("should callback success with extracted fields", async () => {
    const fields = {
      building_name: { value: "Test", confidence: "high" as const },
    };
    mockExtract.mockResolvedValue({ fields });

    await runJob(baseRequest);

    expect(mockExtract).toHaveBeenCalledWith(
      "contract_pdf",
      baseRequest.sourceUrl,
      expect.any(AbortSignal),
    );
    expect(mockSendCallback).toHaveBeenCalledWith(
      baseRequest.callbackUrl,
      expect.objectContaining({
        status: "success",
        extractedFields: fields,
      }),
    );
  });

  it("should callback partial when no fields extracted", async () => {
    mockExtract.mockResolvedValue({ fields: {} });

    await runJob(baseRequest);

    expect(mockSendCallback).toHaveBeenCalledWith(
      baseRequest.callbackUrl,
      expect.objectContaining({ status: "partial" }),
    );
  });

  it("should callback failed when extractor throws", async () => {
    mockExtract.mockRejectedValue(new Error("PDF parse error"));

    await runJob(baseRequest);

    expect(mockSendCallback).toHaveBeenCalledWith(
      baseRequest.callbackUrl,
      expect.objectContaining({
        status: "failed",
        errorMessage: "PDF parse error",
      }),
    );
  });
});
