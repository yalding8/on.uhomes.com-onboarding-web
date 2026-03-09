/**
 * PDF 文本提取 — 使用 pdf-parse 从 PDF Buffer 中提取纯文本
 */

// Import the inner module directly to avoid pdf-parse's debug-mode wrapper
// which tries to read a test PDF file during Next.js build.
import pdfParse from "pdf-parse/lib/pdf-parse";

export interface PdfParseResult {
  text: string;
  numPages: number;
}

export async function parsePdf(buffer: Buffer): Promise<PdfParseResult> {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    numPages: data.numpages,
  };
}
