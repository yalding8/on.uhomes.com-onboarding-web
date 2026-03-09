/**
 * llm/client.ts 增强测试 — Anthropic Messages API 适配
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { chatCompletion } from "./client.js";
import type { LlmProvider, ChatMessage } from "./types.js";

const claudeProvider: LlmProvider = {
  name: "claude-sonnet",
  baseUrl: "https://api.anthropic.com/v1",
  apiKey: "sk-ant-test-key",
  model: "claude-sonnet-4-20250514",
};

const deepseekProvider: LlmProvider = {
  name: "deepseek",
  baseUrl: "https://api.deepseek.com",
  apiKey: "sk-deepseek-key",
  model: "deepseek-chat",
};

const messages: ChatMessage[] = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Extract fields from this text." },
];

describe("chatCompletion — Anthropic API adaptation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call Anthropic Messages API for Claude provider", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "text", text: '{"building_name": "Test"}' }],
        }),
    });

    const result = await chatCompletion(claudeProvider, messages);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    // Should call Anthropic Messages endpoint
    expect(url).toBe("https://api.anthropic.com/v1/messages");

    // Should use x-api-key header
    expect(options.headers["x-api-key"]).toBe("sk-ant-test-key");
    expect(options.headers["anthropic-version"]).toBeDefined();

    // Should convert system message to system parameter
    const body = JSON.parse(options.body);
    expect(body.system).toBe("You are a helpful assistant.");
    expect(body.messages.every((m: ChatMessage) => m.role !== "system")).toBe(
      true,
    );

    expect(result).toBe('{"building_name": "Test"}');
  });

  it("should use OpenAI format for non-Claude providers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '{"field": "value"}' } }],
        }),
    });

    await chatCompletion(deepseekProvider, messages);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer sk-deepseek-key");
  });

  it("should handle Anthropic rate limit (429) with retry", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limited"),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ type: "text", text: "success" }],
          }),
      });

    const result = await chatCompletion(claudeProvider, messages);
    expect(result).toBe("success");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should throw on AbortError without retry", async () => {
    mockFetch.mockRejectedValue(
      Object.assign(new Error("Aborted"), { name: "AbortError" }),
    );

    await expect(chatCompletion(claudeProvider, messages)).rejects.toThrow(
      "Aborted",
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should throw when Anthropic returns empty content", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [],
        }),
    });

    await expect(chatCompletion(claudeProvider, messages)).rejects.toThrow(
      "empty response",
    );
  });
});
