/**
 * BullMQ 任务队列 — 提取任务的持久化队列 + 并发控制 + 重试策略
 *
 * 替代原有的 fire-and-forget HTTP 模式，提供：
 *  - Redis 持久化：任务不会因进程重启丢失
 *  - 并发控制：Worker 最多同时处理 N 个任务
 *  - 指数退避重试：失败任务自动重试
 *  - 优先级支持：不同 source 类型可设不同优先级
 */

import { Queue, Worker, type Job } from "bullmq";
import type { ExtractionRequest } from "../types.js";
import { runJob } from "../job-runner.js";

/** 队列名称 */
const QUEUE_NAME = "extraction";

/** 默认并发数 */
const DEFAULT_CONCURRENCY = 3;

/** 最大重试次数 */
const MAX_ATTEMPTS = 3;

/** Redis 连接配置 */
export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

/** 解析 REDIS_URL 环境变量 */
export function parseRedisUrl(url: string): RedisConnectionConfig {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
    db: parsed.pathname
      ? parseInt(parsed.pathname.replace("/", "") || "0", 10)
      : 0,
  };
}

/** 获取 Redis 连接配置 */
export function getRedisConfig(): RedisConnectionConfig {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return parseRedisUrl(redisUrl);
  }
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB ?? "0", 10),
  };
}

/** 检查队列是否启用（需要 REDIS_URL 或 REDIS_HOST） */
export function isQueueEnabled(): boolean {
  return !!(process.env.REDIS_URL || process.env.REDIS_HOST);
}

let queue: Queue<ExtractionRequest> | null = null;
let worker: Worker<ExtractionRequest> | null = null;

/** 获取或创建队列实例 */
export function getQueue(): Queue<ExtractionRequest> {
  if (queue) return queue;

  const connection = getRedisConfig();
  queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: MAX_ATTEMPTS,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  return queue;
}

/** 添加提取任务到队列 */
export async function addExtractionJob(
  request: ExtractionRequest,
): Promise<string> {
  const q = getQueue();

  // 按 source 类型设置优先级（数字越小优先级越高）
  const priority = getJobPriority(request.source);

  const job = await q.add(QUEUE_NAME, request, {
    jobId: request.jobId,
    priority,
  });

  return job.id ?? request.jobId;
}

/** source 类型优先级映射 */
function getJobPriority(source: string): number {
  switch (source) {
    case "contract_pdf":
      return 1; // PDF 提取快，优先处理
    case "website_crawl":
      return 2; // 网页爬取较慢
    case "google_sheets":
      return 3;
    default:
      return 5;
  }
}

/** 启动 Worker 消费队列 */
export function startWorker(): Worker<ExtractionRequest> {
  if (worker) return worker;

  const connection = getRedisConfig();
  const concurrency = parseInt(
    process.env.QUEUE_CONCURRENCY ?? String(DEFAULT_CONCURRENCY),
    10,
  );

  worker = new Worker<ExtractionRequest>(
    QUEUE_NAME,
    async (job: Job<ExtractionRequest>) => {
      console.error(
        `[queue] Processing job ${job.data.jobId} (attempt ${job.attemptsMade + 1}/${MAX_ATTEMPTS})`,
      );
      await runJob(job.data);
    },
    {
      connection,
      concurrency,
      limiter: {
        max: concurrency,
        duration: 1_000,
      },
    },
  );

  worker.on("completed", (job: Job<ExtractionRequest>) => {
    console.error(`[queue] Job ${job.data.jobId} completed`);
  });

  worker.on("failed", (job: Job<ExtractionRequest> | undefined, err: Error) => {
    const jobId = job?.data?.jobId ?? "unknown";
    console.error(
      `[queue] Job ${jobId} failed (attempt ${job?.attemptsMade ?? "?"}):`,
      err.message,
    );
  });

  worker.on("error", (err: Error) => {
    console.error("[queue] Worker error:", err.message);
  });

  return worker;
}

/** 优雅关闭队列和 Worker */
export async function shutdownQueue(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}

/** 获取队列状态（健康检查用） */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const q = getQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}

/** 重置模块状态（测试用） */
export function resetQueue(): void {
  queue = null;
  worker = null;
}
