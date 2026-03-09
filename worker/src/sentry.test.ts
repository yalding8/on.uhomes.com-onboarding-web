/**
 * sentry.ts 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = { ...process.env };

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
}));

describe("sentry module", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should skip initialization when SENTRY_DSN not set", async () => {
    delete process.env.SENTRY_DSN;
    const { initSentry } = await import("./sentry.js");
    initSentry();
  });

  it("should initialize when SENTRY_DSN is set", async () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    const Sentry = await import("@sentry/node");
    const { initSentry } = await import("./sentry.js");

    initSentry();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
      }),
    );
  });

  it("captureError should not throw when not initialized", async () => {
    delete process.env.SENTRY_DSN;
    const { captureError } = await import("./sentry.js");
    expect(() =>
      captureError(new Error("test"), { context: "test" }),
    ).not.toThrow();
  });

  it("flushSentry should resolve when not initialized", async () => {
    delete process.env.SENTRY_DSN;
    const { flushSentry } = await import("./sentry.js");
    await expect(flushSentry()).resolves.toBeUndefined();
  });
});
