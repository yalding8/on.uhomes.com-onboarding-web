/**
 * PDF 下载器 — 从 Supabase 签名 URL 下载 PDF 文件
 *
 * 增强: 超时控制 + Content-Type 验证
 */

const DOWNLOAD_TIMEOUT_MS = 30_000;

export async function downloadPdf(
  url: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  const res = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: { Accept: "application/pdf" },
  });

  if (!res.ok) {
    throw new Error(`PDF download failed: HTTP ${res.status} from ${url}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    console.error(
      `[pdf-downloader] Unexpected content-type: ${contentType} from ${url}`,
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
