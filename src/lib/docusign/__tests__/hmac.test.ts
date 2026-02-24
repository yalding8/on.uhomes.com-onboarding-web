import { describe, it, expect } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { createHmac } from "crypto";
import { verifyDocuSignHmac } from "../hmac";

/** 用给定密钥对 payload 计算正确的 HMAC-SHA256 Base64 签名 */
function computeSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

describe("verifyDocuSignHmac", () => {
  const secret = "test-webhook-secret";
  const payload = '{"event":"envelope-completed","envelopeId":"abc-123"}';

  it("正确签名验证通过", () => {
    const signature = computeSignature(payload, secret);
    expect(verifyDocuSignHmac(payload, signature, secret)).toBe(true);
  });

  it("错误签名验证失败", () => {
    expect(verifyDocuSignHmac(payload, "wrong-signature", secret)).toBe(false);
  });

  it("使用不同密钥计算的签名验证失败", () => {
    const wrongSignature = computeSignature(payload, "different-secret");
    expect(verifyDocuSignHmac(payload, wrongSignature, secret)).toBe(false);
  });

  it("篡改 payload 后签名验证失败", () => {
    const signature = computeSignature(payload, secret);
    const tampered = payload + " tampered";
    expect(verifyDocuSignHmac(tampered, signature, secret)).toBe(false);
  });

  it("空 payload 可以正确验证", () => {
    const emptyPayload = "";
    const signature = computeSignature(emptyPayload, secret);
    expect(verifyDocuSignHmac(emptyPayload, signature, secret)).toBe(true);
  });

  it("空 payload 配错误签名验证失败", () => {
    expect(verifyDocuSignHmac("", "bad", secret)).toBe(false);
  });

  it("包含 Unicode 字符的 payload 可以正确验证", () => {
    const unicodePayload = '{"name":"异乡好居","city":"北京"}';
    const signature = computeSignature(unicodePayload, secret);
    expect(verifyDocuSignHmac(unicodePayload, signature, secret)).toBe(true);
  });

  it("长度不同的签名直接返回 false（不抛异常）", () => {
    expect(verifyDocuSignHmac(payload, "", secret)).toBe(false);
    expect(verifyDocuSignHmac(payload, "short", secret)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests (fast-check)
// ---------------------------------------------------------------------------

/** Arbitrary: 非空 ASCII 字符串，用于生成 payload 和 secret */
const arbPayload = fc.string({ minLength: 0, maxLength: 2000 });
const arbSecret = fc.string({ minLength: 1, maxLength: 256 });

/**
 * Feature: online-contract-signing, Property 6: HMAC 签名验证正确性
 *
 * 对于任意请求体和密钥，使用该密钥对请求体计算的 HMAC-SHA256 签名应通过验证；
 * 使用不同密钥或篡改请求体后的签名应验证失败。
 *
 * **Validates: Requirements 7.2, 7.3**
 */
describe("Property 6: HMAC 签名验证正确性", () => {
  fcTest.prop([arbPayload, arbSecret], { numRuns: 200 })(
    "正确密钥 + 正确 payload → 验证通过",
    (payload, secret) => {
      const signature = computeSignature(payload, secret);
      expect(verifyDocuSignHmac(payload, signature, secret)).toBe(true);
    },
  );

  fcTest.prop([arbPayload, arbSecret, arbSecret], { numRuns: 200 })(
    "不同密钥计算的签名 → 验证失败（当两个密钥不同时）",
    (payload, secret1, secret2) => {
      fc.pre(secret1 !== secret2);
      const signature = computeSignature(payload, secret1);
      expect(verifyDocuSignHmac(payload, signature, secret2)).toBe(false);
    },
  );

  fcTest.prop([arbPayload, arbPayload, arbSecret], { numRuns: 200 })(
    "篡改 payload 后签名 → 验证失败（当两个 payload 不同时）",
    (payload1, payload2, secret) => {
      fc.pre(payload1 !== payload2);
      const signature = computeSignature(payload1, secret);
      expect(verifyDocuSignHmac(payload2, signature, secret)).toBe(false);
    },
  );

  fcTest.prop([arbPayload, arbSecret], { numRuns: 100 })(
    "相同输入始终产生相同验证结果（确定性）",
    (payload, secret) => {
      const signature = computeSignature(payload, secret);
      const result1 = verifyDocuSignHmac(payload, signature, secret);
      const result2 = verifyDocuSignHmac(payload, signature, secret);
      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    },
  );
});
