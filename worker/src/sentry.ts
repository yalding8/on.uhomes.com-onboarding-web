/**
 * Sentry 错误监控初始化
 *
 * 在 Worker 启动时调用 initSentry()，之后所有未捕获异常和手动
 * captureException 均上报到 Sentry。
 *
 * 环境变量：
 *   SENTRY_DSN — Sentry 项目 DSN（可选，未设置则跳过初始化）
 *   NODE_ENV   — 区分 production / development
 */

import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.error("[sentry] SENTRY_DSN not set, skipping initialization");
    return;
  }

  if (initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: `extraction-worker@${process.env.npm_package_version ?? "1.0.0"}`,

    // 采样率：生产 100%，开发 10%
    tracesSampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0.1,

    // 过滤掉外部依赖的噪音
    beforeSend(event) {
      // 不上报 AbortError（正常的超时取消）
      const message = event.exception?.values?.[0]?.value ?? "";
      if (message.includes("AbortError") || message.includes("aborted")) {
        return null;
      }
      return event;
    },
  });

  initialized = true;
  console.error("[sentry] Initialized successfully");
}

/**
 * 手动捕获异常并上报 Sentry
 *
 * 用于 catch 块中替代/补充 console.error。
 * 如果 Sentry 未初始化，仅走 console.error 不会抛错。
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  if (initialized) {
    Sentry.captureException(err, {
      extra: context,
    });
  }

  // 始终保留 console.error 作为本地日志
  if (context) {
    console.error(`[sentry]`, err.message, context);
  }
}

/** 优雅关闭前 flush 所有待发送事件 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (initialized) {
    await Sentry.flush(timeoutMs);
  }
}
