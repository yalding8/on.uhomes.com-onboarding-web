import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { getConfig } from "../config";

/**
 * DocuSign 客户端单元测试
 *
 * - Property 10: 缺失环境变量错误提示
 * - Property 12: Base64 私钥解码往返一致性
 *
 * **Validates: Requirements 2.3, 10.2**
 */

/** 完整的 DocuSign 环境变量集合（测试用） */
const FULL_ENV: Record<string, string> = {
  DOCUSIGN_CLIENT_ID: "test-client-id",
  DOCUSIGN_USER_ID: "test-user-id",
  DOCUSIGN_ACCOUNT_ID: "test-account-id",
  DOCUSIGN_PRIVATE_KEY: Buffer.from("fake-rsa-private-key").toString("base64"),
  DOCUSIGN_AUTH_SERVER: "account-d.docusign.com",
  DOCUSIGN_TEMPLATE_ID: "test-template-id",
  DOCUSIGN_WEBHOOK_SECRET: "test-webhook-secret",
};

const ENV_KEYS = Object.keys(FULL_ENV);

describe("getConfig - 环境变量验证", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    for (const [key, value] of Object.entries(FULL_ENV)) {
      process.env[key] = value;
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("所有环境变量存在时应返回有效配置", () => {
    const config = getConfig();

    expect(config.clientId).toBe("test-client-id");
    expect(config.userId).toBe("test-user-id");
    expect(config.accountId).toBe("test-account-id");
    expect(config.authServer).toBe("account-d.docusign.com");
    expect(config.templateId).toBe("test-template-id");
    expect(config.webhookSecret).toBe("test-webhook-secret");
  });

  /**
   * Property 10: 缺失环境变量错误提示
   * 对于任意单个缺失的 DocuSign 环境变量，
   * getConfig() 应抛出包含该变量名称的错误信息。
   *
   * **Validates: Requirements 10.2**
   */
  it.each(ENV_KEYS)("缺失 %s 时应抛出包含变量名的错误", (missingKey) => {
    delete process.env[missingKey];

    expect(() => getConfig()).toThrow(missingKey);
    expect(() => getConfig()).toThrow("DocuSign configuration missing");
  });

  it("缺失环境变量时错误消息格式正确", () => {
    delete process.env.DOCUSIGN_CLIENT_ID;

    expect(() => getConfig()).toThrow(
      "DocuSign configuration missing: DOCUSIGN_CLIENT_ID",
    );
  });

  it("空字符串环境变量视为缺失", () => {
    process.env.DOCUSIGN_WEBHOOK_SECRET = "";

    expect(() => getConfig()).toThrow("DOCUSIGN_WEBHOOK_SECRET");
  });
});

describe("getConfig - Base64 私钥解码", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    for (const [key, value] of Object.entries(FULL_ENV)) {
      process.env[key] = value;
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * Property 12: Base64 私钥解码往返一致性
   * 对于任意有效的 PEM 格式 RSA 私钥，
   * Base64 编码后再解码应产生与原始私钥等价的值。
   *
   * **Validates: Requirements 2.3**
   */
  it("应正确解码 Base64 编码的私钥", () => {
    const originalKey =
      "-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBAAJBALRiMLAH\n-----END RSA PRIVATE KEY-----";
    process.env.DOCUSIGN_PRIVATE_KEY =
      Buffer.from(originalKey).toString("base64");

    const config = getConfig();

    expect(config.privateKey).toBe(originalKey);
  });

  it("Base64 往返一致性：编码后解码应还原原始值", () => {
    const pemKey = [
      "-----BEGIN RSA PRIVATE KEY-----",
      "MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MhgHcTz6sE2I2yPB",
      "aFDrBz/yA3MHZG0kTPs5bCNMKEfNkXGPmD8n5HJB2k8p9CfGJwYHIZ",
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");

    const encoded = Buffer.from(pemKey).toString("base64");
    process.env.DOCUSIGN_PRIVATE_KEY = encoded;

    const config = getConfig();

    expect(config.privateKey).toBe(pemKey);
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests (fast-check)
// ---------------------------------------------------------------------------

/** 所有 DocuSign 环境变量名 */
const ALL_ENV_KEYS = [
  "DOCUSIGN_CLIENT_ID",
  "DOCUSIGN_USER_ID",
  "DOCUSIGN_ACCOUNT_ID",
  "DOCUSIGN_PRIVATE_KEY",
  "DOCUSIGN_AUTH_SERVER",
  "DOCUSIGN_TEMPLATE_ID",
  "DOCUSIGN_WEBHOOK_SECRET",
] as const;

/** Arbitrary: 随机选择一个环境变量名 */
const arbEnvKey = fc.constantFrom(...ALL_ENV_KEYS);

/**
 * Arbitrary: 生成 Base64 合法字符的字符串。
 * 通过 integer 索引映射到 Base64 字符集。
 */
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const arbBase64String = fc
  .array(fc.integer({ min: 0, max: BASE64_CHARS.length - 1 }), {
    minLength: 16,
    maxLength: 76,
  })
  .map((indices) => indices.map((i) => BASE64_CHARS[i]).join(""));

/**
 * Arbitrary: 生成模拟 PEM 格式 RSA 私钥的字符串。
 *
 * 结构：PEM header + 随机 Base64 行 + PEM footer
 */
const arbPemKey = fc
  .array(arbBase64String, { minLength: 1, maxLength: 20 })
  .map(
    (lines) =>
      `-----BEGIN RSA PRIVATE KEY-----\n${lines.join("\n")}\n-----END RSA PRIVATE KEY-----`,
  );

/**
 * Feature: online-contract-signing, Property 10: 缺失环境变量错误提示
 *
 * 对于任意单个缺失的 DocuSign 环境变量，DocuSign_Client 在首次调用时
 * 应返回包含该变量名称的错误信息。
 *
 * **Validates: Requirements 10.2**
 */
describe("Property 10: 缺失环境变量错误提示", () => {
  /**
   * 辅助函数：在每次 fast-check 迭代内设置完整环境变量。
   * fcTest.prop 在单个 it 内运行多次迭代，beforeEach/afterEach 无法覆盖每次迭代，
   * 因此需要在回调内手动管理环境变量。
   */
  function setFullEnv(): Record<string, string | undefined> {
    const snapshot: Record<string, string | undefined> = {};
    for (const key of ALL_ENV_KEYS) {
      snapshot[key] = process.env[key];
      process.env[key] = FULL_ENV[key];
    }
    return snapshot;
  }

  function restoreEnv(snapshot: Record<string, string | undefined>): void {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  fcTest.prop([arbEnvKey], { numRuns: 100 })(
    "删除任意单个环境变量后，getConfig() 抛出的错误应包含该变量名",
    (missingKey) => {
      const snapshot = setFullEnv();
      try {
        delete process.env[missingKey];

        expect(() => getConfig()).toThrowError(
          new RegExp(`DocuSign configuration missing:.*${missingKey}`),
        );
      } finally {
        restoreEnv(snapshot);
      }
    },
  );

  fcTest.prop([arbEnvKey], { numRuns: 100 })(
    "将任意单个环境变量设为空字符串后，getConfig() 应视为缺失并报错",
    (emptyKey) => {
      const snapshot = setFullEnv();
      try {
        process.env[emptyKey] = "";

        expect(() => getConfig()).toThrowError(new RegExp(emptyKey));
      } finally {
        restoreEnv(snapshot);
      }
    },
  );
});

/**
 * Feature: online-contract-signing, Property 12: Base64 私钥解码往返一致性
 *
 * 对于任意有效的 PEM 格式 RSA 私钥，Base64 编码后再解码应产生与原始私钥等价的值。
 *
 * **Validates: Requirements 2.3**
 */
describe("Property 12: Base64 私钥解码往返一致性", () => {
  /**
   * 辅助函数：同 Property 10，在每次迭代内管理环境变量。
   */
  function setFullEnv(): Record<string, string | undefined> {
    const snapshot: Record<string, string | undefined> = {};
    for (const key of ALL_ENV_KEYS) {
      snapshot[key] = process.env[key];
      process.env[key] = FULL_ENV[key];
    }
    return snapshot;
  }

  function restoreEnv(snapshot: Record<string, string | undefined>): void {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  fcTest.prop([arbPemKey], { numRuns: 100 })(
    "PEM 私钥经 Base64 编码后通过 getConfig() 解码，应还原为原始值",
    (pemKey) => {
      const snapshot = setFullEnv();
      try {
        const encoded = Buffer.from(pemKey).toString("base64");
        process.env.DOCUSIGN_PRIVATE_KEY = encoded;

        const config = getConfig();

        expect(config.privateKey).toBe(pemKey);
      } finally {
        restoreEnv(snapshot);
      }
    },
  );

  fcTest.prop([fc.string({ minLength: 1, maxLength: 500 })], { numRuns: 100 })(
    "任意非空字符串经 Base64 编码→解码往返一致",
    (original) => {
      const encoded = Buffer.from(original).toString("base64");
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");

      expect(decoded).toBe(original);
    },
  );
});
