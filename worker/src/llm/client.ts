/**
 * LLM Chat Completions 客户端
 *
 * 支持两种 API 格式：
 *  - Anthropic Messages API（Claude 系列）
 *  - OpenAI 兼容 Chat Completions（Qwen / DeepSeek / Kimi / MiniMax）
 *
 * 增强: 支持重试 + 指数退避
 */

import type {
  LlmProvider,
  ChatMessage,
  ChatCompletionResponse,
} from "./types.js";

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
}

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;
const ANTHROPIC_VERSION = "2023-06-01";

function isRetryable(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isAnthropicProvider(provider: LlmProvider): boolean {
  return provider.name.startsWith("claude");
}

export async function chatCompletion(
  provider: LlmProvider,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  if (isAnthropicProvider(provider)) {
    return anthropicCompletion(provider, messages, options);
  }
  return openaiCompletion(provider, messages, options);
}

/** Anthropic Messages API */
async function anthropicCompletion(
  provider: LlmProvider,
  messages: ChatMessage[],
  options: ChatOptions,
): Promise<string> {
  const { temperature = 0.1, maxTokens = 4096, signal } = options;

  // 分离 system 消息（Anthropic 用顶层 system 参数）
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystemMsgs = messages.filter((m) => m.role !== "system");

  const url = `${provider.baseUrl}/messages`;
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: nonSystemMsgs,
    temperature,
    max_tokens: maxTokens,
  };

  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const bodyStr = JSON.stringify(body);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": provider.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: bodyStr,
        signal: signal ?? AbortSignal.timeout(90_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (isRetryable(res.status) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * 2 ** attempt;
          console.error(
            `[llm] ${provider.name} returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1})`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error(
          `LLM API error [${provider.name}]: ${res.status} ${text.slice(0, 200)}`,
        );
      }

      const data = (await res.json()) as AnthropicResponse;
      const textBlock = data.content?.find(
        (b: AnthropicContentBlock) => b.type === "text",
      );
      if (!textBlock?.text) {
        throw new Error(`LLM returned empty response [${provider.name}]`);
      }

      return textBlock.text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") throw lastError;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        console.error(
          `[llm] ${provider.name} request failed, retrying in ${delay}ms (attempt ${attempt + 1}):`,
          lastError.message,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("LLM request failed after retries");
}

/** OpenAI 兼容 Chat Completions API */
async function openaiCompletion(
  provider: LlmProvider,
  messages: ChatMessage[],
  options: ChatOptions,
): Promise<string> {
  const {
    temperature = 0.1,
    maxTokens = 4096,
    jsonMode = false,
    signal,
  } = options;

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

  const bodyStr = JSON.stringify(body);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: bodyStr,
        signal: signal ?? AbortSignal.timeout(90_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (isRetryable(res.status) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * 2 ** attempt;
          console.error(
            `[llm] ${provider.name} returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1})`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") throw lastError;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        console.error(
          `[llm] ${provider.name} request failed, retrying in ${delay}ms (attempt ${attempt + 1}):`,
          lastError.message,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("LLM request failed after retries");
}

/** Anthropic Messages API 响应类型 */
interface AnthropicContentBlock {
  type: "text" | "tool_use";
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
}
