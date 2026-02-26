/**
 * OpenAI 兼容的 Chat Completions 客户端
 *
 * 适用于 Qwen / DeepSeek / Kimi / MiniMax 等所有兼容 API
 */

import type { LlmProvider, ChatMessage, ChatCompletionResponse } from "./types";

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * 调用 OpenAI 兼容的 Chat Completions API
 * @returns 模型返回的文本内容
 * @throws 网络错误或 API 错误
 */
export async function chatCompletion(
  provider: LlmProvider,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const { temperature = 0.1, maxTokens = 4096, jsonMode = false } = options;

  const url = `${provider.baseUrl}/chat/completions`;
  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LLM API error [${provider.name}]: ${res.status} ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`LLM returned empty response [${provider.name}]`);
  }

  return content;
}
