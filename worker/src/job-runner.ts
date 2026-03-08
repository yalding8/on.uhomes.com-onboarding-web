/**
 * 任务编排器 — 超时控制、错误捕获、按 source 分发到对应提取器
 *
 * 流程:
 * 1. sourceUrl 为空 → 直接回调 failed
 * 2. 按 source 分发到 contract-pdf / website-crawl 提取器
 * 3. 5 分钟超时（Promise.race + AbortSignal）
 * 4. 成功或失败均通过 callback 通知主应用
 */

import { getConfig } from "./config.js";
import { sendCallback } from "./callback.js";
import { trackJobStart, trackJobEnd } from "./job-tracker.js";
import { extract } from "./extractors/index.js";
import { captureError } from "./sentry.js";
import type {
  ExtractionRequest,
  ExtractedFields,
  CallbackPayload,
} from "./types.js";

export async function runJob(request: ExtractionRequest): Promise<void> {
  trackJobStart();

  try {
    // sourceUrl 为空 → 直接回调 failed
    if (!request.sourceUrl) {
      await sendCallback(request.callbackUrl, {
        jobId: request.jobId,
        buildingId: request.buildingId,
        source: request.source,
        extractedFields: {},
        status: "failed",
        errorMessage: "Empty sourceUrl",
      });
      return;
    }

    const timeoutMs = getConfig().jobTimeoutMs;
    const controller = new AbortController();

    // 超时控制：Promise.race
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        controller.abort();
        reject(new Error(`Job timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    let fields: ExtractedFields;
    let status: "success" | "partial";

    try {
      const result = await Promise.race([
        extract(request.source, request.sourceUrl, controller.signal),
        timeoutPromise,
      ]);
      fields = result.fields;
      status = Object.keys(fields).length > 0 ? "success" : "partial";
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown extraction error";
      const isTimeout = message.includes("timed out");

      if (!isTimeout) {
        captureError(err, {
          jobId: request.jobId,
          source: request.source,
          sourceUrl: request.sourceUrl,
        });
      }

      const payload: CallbackPayload = {
        jobId: request.jobId,
        buildingId: request.buildingId,
        source: request.source,
        extractedFields: {},
        status: "failed",
        errorMessage: isTimeout ? `Timeout: ${message}` : message,
      };

      await sendCallback(request.callbackUrl, payload);
      return;
    }

    // 成功回调
    await sendCallback(request.callbackUrl, {
      jobId: request.jobId,
      buildingId: request.buildingId,
      source: request.source,
      extractedFields: fields,
      status,
    });
  } catch (err) {
    captureError(err, { jobId: request.jobId, phase: "fatal" });
    console.error(`[job-runner] Fatal error for job ${request.jobId}:`, err);
  } finally {
    trackJobEnd();
  }
}
