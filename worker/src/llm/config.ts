/**
 * LLM Provider 配置
 *
 * [复制自主应用 src/lib/llm/config.ts]
 * 主力：Qwen（通义千问）、DeepSeek
 * 备选：Kimi（Moonshot）、MiniMax
 */

import type { LlmProvider } from "./types.js";

interface ProviderConfig {
  name: string;
  baseUrl: string;
  model: string;
  envKey: string;
}

const PROVIDERS: readonly ProviderConfig[] = [
  {
    name: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    envKey: "QWEN_API_KEY",
  },
  {
    name: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
  },
  {
    name: "kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-128k",
    envKey: "KIMI_API_KEY",
  },
  {
    name: "minimax",
    baseUrl: "https://api.minimax.chat/v1",
    model: "MiniMax-Text-01",
    envKey: "MINIMAX_API_KEY",
  },
] as const;

export function getProvider(): LlmProvider {
  for (const cfg of PROVIDERS) {
    const apiKey = process.env[cfg.envKey];
    if (apiKey?.trim()) {
      return {
        name: cfg.name,
        baseUrl: cfg.baseUrl,
        apiKey: apiKey.trim(),
        model: cfg.model,
      };
    }
  }
  throw new Error(
    `No LLM provider configured. Set one of: ${PROVIDERS.map((p) => p.envKey).join(", ")}`,
  );
}
