import type { DocuSignConfig } from "./types";

/**
 * DocuSign 环境变量名称常量。
 * 用于配置读取和缺失变量错误提示。
 */
const ENV_KEYS = [
  "DOCUSIGN_CLIENT_ID",
  "DOCUSIGN_USER_ID",
  "DOCUSIGN_ACCOUNT_ID",
  "DOCUSIGN_PRIVATE_KEY",
  "DOCUSIGN_AUTH_SERVER",
  "DOCUSIGN_TEMPLATE_ID",
  "DOCUSIGN_WEBHOOK_SECRET",
] as const;

/**
 * 从环境变量读取 DocuSign 配置。
 *
 * - DOCUSIGN_PRIVATE_KEY 以 Base64 编码存储，读取时自动解码为原始 PEM 字符串
 * - 任一必需变量缺失时抛出包含变量名的 Error
 *
 * @throws {Error} 缺失环境变量时，错误消息包含具体变量名
 */
export function getConfig(): DocuSignConfig {
  for (const key of ENV_KEYS) {
    if (!process.env[key]) {
      throw new Error(`DocuSign configuration missing: ${key}`);
    }
  }

  const privateKeyBase64 = process.env.DOCUSIGN_PRIVATE_KEY as string;
  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf-8");

  return {
    clientId: process.env.DOCUSIGN_CLIENT_ID as string,
    userId: process.env.DOCUSIGN_USER_ID as string,
    accountId: process.env.DOCUSIGN_ACCOUNT_ID as string,
    privateKey,
    authServer: process.env.DOCUSIGN_AUTH_SERVER as string,
    templateId: process.env.DOCUSIGN_TEMPLATE_ID as string,
    webhookSecret: process.env.DOCUSIGN_WEBHOOK_SECRET as string,
  };
}
