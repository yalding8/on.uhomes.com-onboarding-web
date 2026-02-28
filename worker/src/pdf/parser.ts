/**
 * PDF 文本提取 — 使用 pdf-parse 从 PDF Buffer 中提取纯文本
 */

import pdfParse from "pdf-parse";

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
