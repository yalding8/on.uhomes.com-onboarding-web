/**
 * LLM Provider 配置
 *
 * 首选：Claude Sonnet 4（Anthropic）
 * 备选：Qwen / DeepSeek / Kimi / MiniMax
 *
 * 增强: 主 provider 失败时自动 fallback 到备选
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
    name: "claude-sonnet",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-20250514",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    name: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    envKey: "QWEN_API_KEY",
  },
  {
    name: "deepseek-volc",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "deepseek-v3-2-251201",
    envKey: "VOLC_API_KEY",
  },
  {
    name: "kimi-k2",
    baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
    model: "kimi-k2.5",
    envKey: "KIMI_K2_API_KEY",
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

/** Get primary LLM provider (first configured) */
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

/** Get all available providers for fallback chain */
export function getAllProviders(): LlmProvider[] {
  const available: LlmProvider[] = [];
  for (const cfg of PROVIDERS) {
    const apiKey = process.env[cfg.envKey];
    if (apiKey?.trim()) {
      available.push({
        name: cfg.name,
        baseUrl: cfg.baseUrl,
        apiKey: apiKey.trim(),
        model: cfg.model,
      });
    }
  }
  if (available.length === 0) {
    throw new Error(
      `No LLM provider configured. Set one of: ${PROVIDERS.map((p) => p.envKey).join(", ")}`,
    );
  }
  return available;
}
