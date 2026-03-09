/**
 * HTTP 路由处理
 *
 * GET  /health        — 健康检查（含队列状态）
 * POST /extract       — 接收提取任务（直接执行，兼容旧模式）
 * POST /extract/queue — 接收提取任务（通过 BullMQ 队列）
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyBearerToken } from "./auth.js";
import { runJob } from "./job-runner.js";
import {
  addExtractionJob,
  getQueueStats,
  isQueueEnabled,
} from "./queue/extraction-queue.js";
import type { ExtractionRequest } from "./types.js";

function json(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );
  const method = req.method?.toUpperCase() ?? "GET";

  // GET /health
  if (method === "GET" && url.pathname === "/health") {
    const health: Record<string, unknown> = {
      status: "ok",
      timestamp: new Date().toISOString(),
      queueEnabled: isQueueEnabled(),
    };
    if (isQueueEnabled()) {
      try {
        health.queue = await getQueueStats();
      } catch {
        health.queue = { error: "unavailable" };
      }
    }
    json(res, 200, health);
    return;
  }

  // POST /extract
  if (method === "POST" && url.pathname === "/extract") {
    // 鉴权
    const authHeader = req.headers.authorization ?? null;
    if (!verifyBearerToken(authHeader)) {
      json(res, 401, { error: "Unauthorized" });
      return;
    }

    let payload: ExtractionRequest;
    try {
      const raw = await readBody(req);
      payload = JSON.parse(raw) as ExtractionRequest;
    } catch {
      json(res, 400, { error: "Invalid JSON body" });
      return;
    }

    // 校验必要字段
    if (
      !payload.jobId ||
      !payload.source ||
      !payload.buildingId ||
      !payload.callbackUrl
    ) {
      json(res, 400, {
        error:
          "Missing required fields: jobId, source, buildingId, callbackUrl",
      });
      return;
    }

    // 队列模式：优先走 BullMQ；无 Redis 时回退直接执行
    if (isQueueEnabled()) {
      try {
        const queueJobId = await addExtractionJob(payload);
        json(res, 202, {
          message: "Job queued",
          jobId: payload.jobId,
          queueJobId,
          source: payload.source,
        });
        return;
      } catch (err) {
        console.error("[router] Queue unavailable, falling back:", err);
      }
    }

    // 直接执行（无队列或队列不可用时）
    json(res, 202, {
      message: "Job accepted",
      jobId: payload.jobId,
      source: payload.source,
    });

    runJob(payload).catch((err: unknown) => {
      console.error("[router] Unhandled job error", err);
    });

    return;
  }

  // 404
  json(res, 404, { error: "Not found" });
}
