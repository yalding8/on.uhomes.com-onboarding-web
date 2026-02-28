/**
 * LLM Provider 统一类型定义
 *
 * [复制自主应用 src/lib/llm/types.ts]
 * 所有 provider 都使用 OpenAI 兼容的 Chat Completions API 格式
 */

export interface LlmProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionChoice {
  message: { content: string | null };
}

export interface ChatCompletionResponse {
  choices: ChatCompletionChoice[];
}
