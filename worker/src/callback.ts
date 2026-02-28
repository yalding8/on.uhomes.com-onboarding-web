/**
 * 回调模块 — 向主应用的 callbackUrl POST 提取结果
 *
 * 使用 SUPABASE_SERVICE_ROLE_KEY 作为 Bearer token 认证。
 * 失败时重试 1 次（间隔 2 秒）。
 */

import { getConfig } from "./config.js";
import type { CallbackPayload } from "./types.js";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

export async function sendCallback(
  callbackUrl: string,
  payload: CallbackPayload,
): Promise<void> {
  const token = getConfig().supabaseServiceRoleKey;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Callback HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      return; // 成功
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[callback] Attempt ${attempt + 1} failed for job ${payload.jobId}:`,
        lastError.message,
      );

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  console.error(
    `[callback] All retries exhausted for job ${payload.jobId}`,
    lastError,
  );
}
