/**
 * DocuSign eSign SDK 的最小类型声明（该包无官方 .d.ts）。
 * 仅声明本项目实际使用的 API 子集。
 */

/* ------------------------------------------------------------------ */
/*  OAuth / Token                                                      */
/* ------------------------------------------------------------------ */

export interface OAuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface JWTTokenResponse {
  body: OAuthToken;
}

/* ------------------------------------------------------------------ */
/*  Envelope 相关模型                                                   */
/* ------------------------------------------------------------------ */

export interface TextTab {
  tabLabel: string;
  value: string;
}

export interface Tabs {
  textTabs?: TextTab[];
}

export interface TemplateRole {
  email: string;
  name: string;
  roleName: string;
  tabs?: Tabs;
}

export interface EnvelopeEvent {
  envelopeEventStatusCode: string;
}

export interface EventNotification {
  url: string;
  requireAcknowledgment: boolean;
  envelopeEvents: EnvelopeEvent[];
  includeHMAC: boolean;
}

export interface EnvelopeDefinition {
  templateId: string;
  templateRoles: TemplateRole[];
  status: string;
  eventNotification?: EventNotification;
}

export interface EnvelopeSummary {
  envelopeId: string;
  status: string;
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

export interface DocuSignConfig {
  clientId: string;
  userId: string;
  accountId: string;
  privateKey: string;
  authServer: string;
  templateId: string;
  webhookSecret: string;
}

export interface CreateEnvelopeResult {
  envelopeId: string;
}
