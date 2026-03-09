/**
 * Extraction Worker HTTP 服务入口
 *
 * Node.js 原生 HTTP 服务器，仅 2 个路由：/health 和 /extract。
 * 支持优雅关闭：SIGTERM 时等待进行中任务完成（最多 30 秒）。
 */

import { createServer } from "node:http";
import { getConfig } from "./config.js";
import { handleRequest } from "./router.js";
import { getActiveJobCount } from "./job-tracker.js";
import { shutdownBrowser } from "./crawl/browser.js";
import { initSentry, flushSentry } from "./sentry.js";
import {
  isQueueEnabled,
  startWorker,
  shutdownQueue,
} from "./queue/extraction-queue.js";

// Sentry 必须在其他模块之前初始化
initSentry();

const config = getConfig();
const server = createServer(handleRequest);

/** 优雅关闭 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.error(`[worker] ${signal} received, shutting down...`);

  // 停止接收新连接
  server.close();

  // 等待进行中任务完成（最多 30 秒）
  const deadline = Date.now() + 30_000;
  while (getActiveJobCount() > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }

  if (getActiveJobCount() > 0) {
    console.error(
      `[worker] Force shutdown with ${getActiveJobCount()} active jobs`,
    );
  }

  // 关闭 BullMQ 队列
  await shutdownQueue().catch(() => {});

  // 关闭 Playwright 浏览器
  await shutdownBrowser().catch(() => {});

  // Flush Sentry 事件
  await flushSentry();

  process.exit(0);
}

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});
process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

// 启动 BullMQ Worker（如 Redis 可用）
if (isQueueEnabled()) {
  startWorker();
  console.error("[worker] BullMQ queue worker started");
}

server.listen(config.port, () => {
  console.error(`[worker] Extraction Worker listening on port ${config.port}`);
});
