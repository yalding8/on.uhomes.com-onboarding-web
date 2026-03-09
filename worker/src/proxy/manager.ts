/**
 * 代理管理器 — 域名粘性轮换 + 失败上报
 *
 * 支持 Bright Data / IPRoyal / Oxylabs 超级代理协议。
 * 环境变量控制开关，默认关闭（本地开发不走代理）。
 */

export interface ProxyConfig {
  server: string; // "http://host:port"
  username?: string;
  password?: string;
}

/** 域名 → session ID 粘性绑定 */
const domainSessions = new Map<string, string>();

/** 已报告失败的域名集合 */
const failedDomains = new Set<string>();

function isEnabled(): boolean {
  return process.env.PROXY_ENABLED === "true";
}

function getBaseConfig(): ProxyConfig | null {
  const server = process.env.PROXY_URL;
  if (!server?.trim()) return null;

  return {
    server: server.trim(),
    username: process.env.PROXY_USERNAME?.trim(),
    password: process.env.PROXY_PASSWORD?.trim(),
  };
}

/** 生成简短随机 session ID，用于代理粘性绑定 */
function generateSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * 获取指定域名的代理配置
 *
 * - 关闭时返回 null
 * - 已报告失败的域名返回 null（降级为直连）
 * - 同一域名在 session 内绑定同一出口 IP（session stickiness）
 */
export function getProxy(domain: string): ProxyConfig | null {
  if (!isEnabled()) return null;

  const base = getBaseConfig();
  if (!base) return null;

  // 已失败的域名，降级为直连
  if (failedDomains.has(domain)) return null;

  // 域名粘性：复用已有 session，或生成新的
  if (!domainSessions.has(domain)) {
    domainSessions.set(domain, generateSessionId());
  }

  // Session ID 附加到 username（超级代理协议通用做法）
  const sessionId = domainSessions.get(domain)!;
  const username = base.username
    ? `${base.username}-session-${sessionId}`
    : undefined;

  return {
    server: base.server,
    username,
    password: base.password,
  };
}

/**
 * 上报代理失败 — 后续该域名回退为直连
 */
export function reportProxyFailure(domain: string, _proxy: ProxyConfig): void {
  failedDomains.add(domain);
  domainSessions.delete(domain);
  console.error(`[proxy] Marked ${domain} as failed, falling back to direct`);
}

/** 测试用：重置所有状态 */
export function resetProxyState(): void {
  domainSessions.clear();
  failedDomains.clear();
}
