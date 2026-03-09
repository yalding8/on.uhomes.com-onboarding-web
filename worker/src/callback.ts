/**
 * 回调模块 — 向主应用的 callbackUrl POST 提取结果
 *
 * 使用 SUPABASE_SERVICE_ROLE_KEY 作为 Bearer token 认证。
 * 失败时重试 3 次（指数退避 + 抖动）。
 */

import { getConfig } from "./config.js";
import { captureError } from "./sentry.js";
import type { CallbackPayload } from "./types.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

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
        `[callback] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed for job ${payload.jobId}:`,
        lastError.message,
      );

      if (attempt < MAX_RETRIES) {
        // Exponential backoff with jitter (±25%)
        const baseDelay = BASE_DELAY_MS * 2 ** attempt;
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        await new Promise((r) => setTimeout(r, baseDelay + jitter));
      }
    }
  }

  captureError(lastError, {
    jobId: payload.jobId,
    callbackUrl,
    phase: "callback_exhausted",
  });
  console.error(
    `[callback] All ${MAX_RETRIES + 1} attempts exhausted for job ${payload.jobId}`,
    lastError,
  );
}
