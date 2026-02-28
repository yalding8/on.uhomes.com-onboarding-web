/**
 * PDF 下载器 — 从 Supabase 签名 URL 下载 PDF 文件
 */

export async function downloadPdf(
  url: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/pdf" },
  });

  if (!res.ok) {
    throw new Error(`PDF download failed: HTTP ${res.status} from ${url}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
