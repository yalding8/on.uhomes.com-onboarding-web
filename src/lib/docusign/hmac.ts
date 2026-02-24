import { createHmac, timingSafeEqual } from "crypto";

/**
 * 验证 DocuSign Webhook 回调的 HMAC-SHA256 签名。
 *
 * @param payload  - 原始请求体字符串
 * @param signature - 请求头中携带的 Base64 编码签名
 * @param secret   - DOCUSIGN_WEBHOOK_SECRET 密钥
 * @returns 签名匹配返回 true，否则返回 false
 */
export function verifyDocuSignHmac(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const computed = createHmac("sha256", secret)
    .update(payload)
    .digest("base64");

  const computedBuf = Buffer.from(computed, "utf-8");
  const signatureBuf = Buffer.from(signature, "utf-8");

  if (computedBuf.length !== signatureBuf.length) {
    return false;
  }

  return timingSafeEqual(computedBuf, signatureBuf);
}
