/**
 * DocuSign eSignature 客户端（纯 fetch 实现）。
 *
 * 职责：
 * - JWT Grant 认证（自动缓存 & 续期）
 * - 基于模板创建签署信封
 * - 下载已签署文档
 *
 * 不依赖 docusign-esign SDK，直接调用 DocuSign REST API v2.1。
 */

import jwt from "jsonwebtoken";
import type { ContractFields } from "@/lib/contracts/types";
import { buildTextTabs } from "./tab-mapping";
import { getConfig } from "./config";
import type { CreateEnvelopeResult } from "./types";

/* ------------------------------------------------------------------ */
/*  Token 缓存                                                         */
/* ------------------------------------------------------------------ */

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  公开 API                                                           */
/* ------------------------------------------------------------------ */

/**
 * 获取 DocuSign access_token（JWT Grant）。
 *
 * 签发 JWT assertion → POST /oauth/token → 缓存 access_token。
 * token 过期前 5 分钟自动刷新。
 *
 * @throws {Error} JWT 认证失败时
 */
export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const config = getConfig();

  const assertion = jwt.sign(
    {
      iss: config.clientId,
      sub: config.userId,
      aud: config.authServer,
      scope: "signature impersonation",
    },
    config.privateKey,
    {
      algorithm: "RS256",
      expiresIn: 3600,
      notBefore: 0,
      header: { typ: "JWT", alg: "RS256" },
    },
  );

  const tokenUrl = `https://${config.authServer}/oauth/token`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `DocuSign JWT authentication failed: ${res.status} ${text}`,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - REFRESH_MARGIN_MS,
  };

  return data.access_token;
}

/**
 * 创建 DocuSign 签署信封。
 *
 * 使用预上传模板 + Text Tabs 动态填充字段，
 * 配置 eventNotification 接收 Webhook 回调，
 * 信封创建后立即发送（status = 'sent'）。
 *
 * @throws {Error} DocuSign API 调用失败时
 */
export async function createEnvelope(
  signerEmail: string,
  signerName: string,
  fields: ContractFields,
): Promise<CreateEnvelopeResult> {
  const config = getConfig();
  const accessToken = await getAccessToken();
  const baseUrl =
    process.env.DOCUSIGN_BASE_URL ?? "https://demo.docusign.net/restapi";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const textTabs = buildTextTabs(fields);

  const envelopeDefinition = {
    templateId: config.templateId,
    templateRoles: [
      {
        email: signerEmail,
        name: signerName,
        roleName: "signer",
        tabs: { textTabs },
      },
    ],
    status: "sent",
    eventNotification: {
      url: `${appUrl}/api/webhooks/docusign`,
      requireAcknowledgment: true,
      envelopeEvents: [{ envelopeEventStatusCode: "completed" }],
      recipientEvents: [{ recipientEventStatusCode: "completed" }],
      includeDocumentFields: false,
      includeRecipients: true,
      includeHMAC: true,
    },
  };

  const url = `${baseUrl}/v2.1/accounts/${config.accountId}/envelopes`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(envelopeDefinition),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DocuSign envelope creation failed: ${res.status} ${text}`);
  }

  const result = (await res.json()) as { envelopeId: string };
  return { envelopeId: result.envelopeId };
}

/**
 * 下载已签署的合并 PDF 文档。
 *
 * @param envelopeId - DocuSign 信封 ID
 * @returns PDF 文件的 Buffer
 * @throws {Error} 下载失败时
 */
export async function downloadSignedDocument(
  envelopeId: string,
): Promise<Buffer> {
  const config = getConfig();
  const accessToken = await getAccessToken();
  const baseUrl =
    process.env.DOCUSIGN_BASE_URL ?? "https://demo.docusign.net/restapi";

  const url = `${baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/combined`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DocuSign document download failed: ${res.status} ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** 清除 token 缓存（仅用于测试）。 */
export function _resetTokenCache(): void {
  tokenCache = null;
}
