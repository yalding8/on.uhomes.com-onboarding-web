/**
 * DocuSign eSignature 客户端。
 *
 * 职责：
 * - JWT Grant 认证（自动缓存 & 续期）
 * - 基于模板创建签署信封
 * - 下载已签署文档
 *
 * 依赖 `docusign-esign` CommonJS 包，通过 require 导入。
 */

import type { ContractFields } from "@/lib/contracts/types";
import { buildTextTabs } from "./tab-mapping";
import { getConfig } from "./config";
import type {
  CreateEnvelopeResult,
  EnvelopeSummary,
  JWTTokenResponse,
} from "./types";

/* ------------------------------------------------------------------ */
/*  docusign-esign SDK（CommonJS，无 .d.ts）                            */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const docusign = require("docusign-esign") as {
  ApiClient: new () => DocuSignApiClient;
  EnvelopesApi: new (client: DocuSignApiClient) => DocuSignEnvelopesApi;
};

/** ApiClient 实例的最小类型约束 */
interface DocuSignApiClient {
  setOAuthBasePath(path: string): void;
  addDefaultHeader(name: string, value: string): void;
  setBasePath(path: string): void;
  requestJWTUserToken(
    clientId: string,
    userId: string,
    scopes: string[],
    privateKey: Buffer,
    expiresIn: number,
  ): Promise<JWTTokenResponse>;
}

/** EnvelopesApi 实例的最小类型约束 */
interface DocuSignEnvelopesApi {
  createEnvelope(
    accountId: string,
    opts: { envelopeDefinition: Record<string, unknown> },
  ): Promise<EnvelopeSummary>;
  getDocument(
    accountId: string,
    envelopeId: string,
    documentId: string,
  ): Promise<Buffer>;
}

/* ------------------------------------------------------------------ */
/*  Token 缓存                                                         */
/* ------------------------------------------------------------------ */

interface CachedToken {
  accessToken: string;
  /** token 过期的绝对时间戳（ms） */
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

/** 提前 5 分钟刷新，避免边界过期 */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  公开 API                                                           */
/* ------------------------------------------------------------------ */

/**
 * 获取 DocuSign access_token（JWT Grant）。
 *
 * - 首次调用时申请新 token 并缓存
 * - 后续调用若 token 未过期则直接返回缓存值
 * - token 过期或不存在时自动重新申请
 *
 * @throws {Error} JWT 认证失败时，包含具体错误原因
 */
export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const config = getConfig();
  const apiClient = new docusign.ApiClient();
  apiClient.setOAuthBasePath(config.authServer);

  const privateKeyBuffer = Buffer.from(config.privateKey, "utf-8");

  let response: JWTTokenResponse;
  try {
    response = await apiClient.requestJWTUserToken(
      config.clientId,
      config.userId,
      ["signature", "impersonation"],
      privateKeyBuffer,
      3600,
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown authentication error";
    throw new Error(`DocuSign JWT authentication failed: ${message}`);
  }

  const { accessToken, expiresIn } = response.body;

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000 - REFRESH_MARGIN_MS,
  };

  return accessToken;
}

/**
 * 创建 DocuSign 签署信封。
 *
 * - 使用预上传模板 + Text Tabs 动态填充字段
 * - 配置 eventNotification 接收 Webhook 回调
 * - 信封创建后立即发送（status = 'sent'）
 *
 * @param signerEmail - 签署人邮箱
 * @param signerName  - 签署人姓名
 * @param fields      - 合同动态字段
 * @returns 包含 envelopeId 的结果
 * @throws {Error} DocuSign API 调用失败时
 */
export async function createEnvelope(
  signerEmail: string,
  signerName: string,
  fields: ContractFields,
): Promise<CreateEnvelopeResult> {
  const config = getConfig();
  const accessToken = await getAccessToken();

  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(`https://demo.docusign.net/restapi`);
  apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);

  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const textTabs = buildTextTabs(fields);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const envelopeDefinition = {
    templateId: config.templateId,
    templateRoles: [
      {
        email: signerEmail,
        name: signerName,
        roleName: "signer",
        tabs: {
          textTabs,
        },
      },
    ],
    status: "sent",
    eventNotification: {
      url: `${appUrl}/api/webhooks/docusign`,
      requireAcknowledgment: true,
      envelopeEvents: [{ envelopeEventStatusCode: "completed" }],
      includeHMAC: true,
    },
  };

  let result: EnvelopeSummary;
  try {
    result = await envelopesApi.createEnvelope(config.accountId, {
      envelopeDefinition,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown envelope creation error";
    throw new Error(`DocuSign envelope creation failed: ${message}`);
  }

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

  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(`https://demo.docusign.net/restapi`);
  apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);

  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  try {
    // documentId 'combined' 获取合并后的完整文档
    return await envelopesApi.getDocument(
      config.accountId,
      envelopeId,
      "combined",
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown document download error";
    throw new Error(`DocuSign document download failed: ${message}`);
  }
}

/**
 * 清除 token 缓存（仅用于测试）。
 */
export function _resetTokenCache(): void {
  tokenCache = null;
}
