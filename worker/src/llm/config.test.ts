/**
 * llm/config.ts 增强测试 — Claude Sonnet 4 作为首选 provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = { ...process.env };

describe("LLM config — Claude provider", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.KIMI_API_KEY;
    delete process.env.MINIMAX_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use Claude as primary when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-fallback";

    const { getProvider } = await import("./config.js");
    const provider = getProvider();

    expect(provider.name).toBe("claude-sonnet");
    expect(provider.model).toContain("claude");
  });

  it("should fallback to Chinese providers when Claude not configured", async () => {
    process.env.QWEN_API_KEY = "sk-qwen-key";

    const { getProvider } = await import("./config.js");
    const provider = getProvider();

    expect(provider.name).toBe("qwen");
  });

  it("should include Claude first in getAllProviders", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-key";

    const { getAllProviders } = await import("./config.js");
    const providers = getAllProviders();

    expect(providers[0].name).toBe("claude-sonnet");
    expect(providers.length).toBeGreaterThanOrEqual(2);
  });

  it("should throw when no provider is configured", async () => {
    const { getProvider } = await import("./config.js");
    expect(() => getProvider()).toThrow("No LLM provider configured");
  });
});
