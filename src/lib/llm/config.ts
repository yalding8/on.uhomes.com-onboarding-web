/**
 * LLM Provider 配置
 *
 * 主力：Qwen（通义千问）、DeepSeek
 * 备选：Kimi（Moonshot）、MiniMax
 *
 * 选择策略：按优先级依次尝试有 API Key 配置的 provider
 */

import type { LlmProvider } from "./types";

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

/**
 * 按优先级返回第一个有 API Key 的 provider
 * @throws 如果没有任何 provider 配置了 API Key
 */
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
