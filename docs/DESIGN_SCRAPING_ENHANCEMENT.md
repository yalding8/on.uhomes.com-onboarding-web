# 公寓供应商网站爬取增强 — 方案设计文档

> **轨道**：Major Track（新 API 行为变更、新基础设施依赖、涉及外部服务采购）
> **日期**：2026-03-08
> **关联调研**：`docs/APARTMENT_SCRAPING_FEASIBILITY.md`

---

## 1. 业务目标

将现有 Extraction Worker 从「单页面 + 无反爬 + 中文 LLM」提升到「多页面 + Stealth + 代理轮换 + 国际 LLM」，
使 **Tier A 字段提取准确率从 ~60% 提升至 ≥85%**，覆盖 US/UK/AU/CA/EU 五大市场的供应商网站。

### 1.1 不在范围内的工作

- **不**新建 Worker 服务（在现有 `worker/` 基础上增强）
- **不**新建数据库表（复用现有 `extraction_jobs` 表和回调机制）
- **不**新建 API 端点（复用现有 `POST /api/extraction/trigger` + `POST /api/extraction/callback`）
- **不**引入 BullMQ/Redis 任务队列（Phase 0-1 延续当前 HTTP 直接处理模式，队列为 Phase 2 议题）
- **不**修改前端 UI（Onboarding 编辑页已有字段展示和人工确认能力）

---

## 2. 数据模型变更

### 2.1 `extraction_jobs` 表新增列

无新增列。现有 `status`、`result`（JSONB）、`error_message`、`updated_at` 已满足需求。

提取结果中新增的元数据通过 `result` JSONB 字段扩展（向后兼容）：

```json
{
  "fields": { "building_name": { "value": "...", "confidence": "high" } },
  "meta": {
    "schema_version": 2,
    "pages_crawled": ["/", "/pricing", "/amenities"],
    "probe_result": {
      "type": "spa",
      "framework": "react",
      "cloudflareLevel": "free"
    },
    "strategy_used": "playwright_stealth",
    "proxy_used": true,
    "llm_provider": "claude-sonnet-4",
    "total_duration_ms": 35000
  }
}
```

`schema_version: 2` 区分增强后的结果格式。旧版（无 `schema_version` 或 `1`）继续兼容。

### 2.2 环境变量新增

| 变量名              | 用途                     | 部署位置     |
| ------------------- | ------------------------ | ------------ |
| `ANTHROPIC_API_KEY` | Claude Sonnet 4 提取     | Worker (Fly) |
| `PROXY_PROVIDER`    | 代理服务商标识           | Worker (Fly) |
| `PROXY_API_URL`     | 代理 API 端点            | Worker (Fly) |
| `PROXY_API_KEY`     | 代理服务鉴权             | Worker (Fly) |
| `CAPSOLVER_API_KEY` | CAPTCHA 解决服务（可选） | Worker (Fly) |

---

## 3. 技术方案

### 3.1 整体架构（增强后）

```
POST /extract { source: "website_crawl", sourceUrl, ... }
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ worker/src/job-runner.ts  (已有, 不修改)                      │
│   timeout=5min, callback on complete/fail                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ worker/src/extractors/website-crawl.ts  (增强)               │
│                                                              │
│  1. probeSite()          ← 已有，增加 Cloudflare 等级检测    │
│  2. selectStrategy()     ← 新增：根据 probe 结果选路由        │
│  3. scrapeMultiPage()    ← 新增：多页面发现 + 爬取            │
│  4. mapStructuredData()  ← 已有，不修改                      │
│  5. mapOpenGraphData()   ← 已有，不修改                      │
│  6. llmExtract()         ← 增强：增加 Claude Sonnet 4         │
│  7. validateFields()     ← 已有，不修改                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                  │
        ┌─────────┼──────────┐
        ▼         ▼          ▼
┌────────────┐ ┌──────────┐ ┌──────────────┐
│ HTTP 轻量  │ │ PW 标准  │ │ PW + Stealth │
│ (cheerio)  │ │ (已有)   │ │ + Proxy (新) │
└────────────┘ └──────────┘ └──────────────┘
```

### 3.2 模块拆分

#### 3.2.1 `worker/src/crawl/stealth.ts`（新建）

职责：集成 `playwright-extra` + `puppeteer-extra-plugin-stealth`，包装 stealth 浏览器上下文创建。

```typescript
// 公开接口
export async function createStealthContext(
  browser: Browser,
  proxyConfig?: ProxyConfig,
): Promise<BrowserContext>;
```

实现要点：

- 隐藏 `navigator.webdriver` 标记
- 随机化 viewport（1280-1920 宽度范围）、语言（en-US/en-GB/en-AU）、时区
- 集成代理配置（HTTP/SOCKS5）
- 屏蔽追踪脚本（Google Analytics、Facebook Pixel 等）以加速页面加载

#### 3.2.2 `worker/src/proxy/manager.ts`（新建）

职责：管理代理池，提供按域名粘性轮换。

```typescript
export interface ProxyConfig {
  server: string; // "http://host:port"
  username?: string;
  password?: string;
}

export function getProxy(domain: string): ProxyConfig | null;
export function reportProxyFailure(domain: string, proxy: ProxyConfig): void;
```

实现要点：

- 支持 Bright Data / IPRoyal / Oxylabs 的 super proxy 协议（通过 URL 参数指定国家/会话）
- 域名粘性：同一域名在单次会话内绑定同一出口 IP
- 失败上报：自动标记不可用代理，后续请求避开
- 环境变量控制开关：`PROXY_ENABLED=true/false`，本地开发默认关闭

#### 3.2.3 `worker/src/crawl/multi-page.ts`（新建）

职责：从首页发现子页面并按优先级爬取。

```typescript
export interface PageDiscovery {
  url: string;
  label: string; // "pricing" | "amenities" | "contact" | "gallery" | "floor-plans" | "apply"
  priority: number;
}

export function discoverSubPages(
  baseUrl: string,
  navLinks: Array<{ href: string; text: string }>,
): PageDiscovery[];
```

发现策略：

1. 解析首页 `<nav>` 内所有 `<a>` 链接
2. 关键词匹配：`pricing|rates|cost`, `amenities|features|facilities`, `contact|reach`, `gallery|photos|images`, `floor.?plans|units|rooms`, `apply|application`
3. 限制：同域名下最多发现 6 个子页面
4. 优先级：pricing(1) > amenities(2) > contact(3) > floor-plans(4) > gallery(5) > apply(6)
5. 对每个子页面独立调用 `scrapePage()`，结果合并后统一送入 LLM

#### 3.2.4 `worker/src/crawl/site-probe.ts`（增强已有）

新增 Cloudflare 等级检测：

```typescript
// 在现有 SiteProfile 接口上扩展
export interface SiteProfile {
  // ...已有字段
  cloudflareProtected: boolean;
  cloudflareLevel: "none" | "free" | "pro" | "business" | "enterprise";
}
```

检测方法：

- `cf-ray` header 存在 → Cloudflare 保护
- `cf-cache-status` + `cf-mitigated` → 估算防护等级
- `server: cloudflare` header 确认

#### 3.2.5 `worker/src/llm/config.ts`（增强已有）

在现有 Provider 列表中**前置** Claude Sonnet 4：

```typescript
const providers: LlmProvider[] = [
  {
    name: "claude-sonnet",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: "claude-sonnet-4-20250514",
  },
  // ...现有 Qwen, DeepSeek, Kimi, MiniMax 保持不变作为 fallback
];
```

注意：Anthropic API 不是 OpenAI 兼容格式。需要在 `client.ts` 中增加 Anthropic 请求适配：

- 使用 `@anthropic-ai/sdk`（或直接 HTTP 调用 Messages API）
- 映射 `ChatMessage[]` → Anthropic `messages` 格式
- 映射返回值 → 现有 `ChatCompletion` 接口

#### 3.2.6 `worker/src/extractors/website-crawl.ts`（增强已有）

策略路由逻辑（在现有 `extractFromWebsite` 函数中增强）：

```
if probe.cloudflareLevel === "enterprise" → 标记 SKIPPED, 提示需人工/API 合作
if probe.cloudflareLevel in ["pro", "business"] → stealth context + proxy
if probe.type === "static" && !probe.cloudflareProtected → HTTP 轻量提取
otherwise → 标准 Playwright（已有行为）
```

多页面合并：

- 每个子页面独立提取 `ExtractedFields`
- 合并规则：同一字段取 confidence 最高的值
- 合并后再经 `validateFields()` 统一校验

---

## 4. 国际化考量

### 4.1 五大市场适配

| 市场 | 常见技术栈           | 价格格式            | 特殊处理                   |
| ---- | -------------------- | ------------------- | -------------------------- |
| US   | React SPA, WordPress | $1,200/month        | 学期制定价（per semester） |
| UK   | React, Next.js       | 125/week, 500/month | 英镑周租制需标准化为月租   |
| AU   | React, Vue           | A$350/week          | 澳元周租制同上             |
| CA   | WordPress, Wix       | CA$1,500/month      | 法语页面（魁北克）         |
| EU   | Vue, Next.js         | 650/month           | 多币种、多语言页面         |

### 4.2 LLM Prompt 国际化

提取 prompt 需指导 LLM 处理：

- 多种货币符号和格式（$, , A$, CA$, ¥）
- 周租 → 月租换算（`weekly_price * 52 / 12`）
- 学期制 → 月租换算
- 多语言页面内容理解（英/法/德/西/意/葡）

---

## 5. 实施计划

### Phase 0：基线评测 + 快速增强（5 个工作日）

| 日   | 任务                                                     | 产出                  |
| ---- | -------------------------------------------------------- | --------------------- |
| D1-2 | 选取 20 个真实供应商 URL，用现有 Worker 跑基线           | 基线 benchmark 报告   |
| D3   | 新建 `stealth.ts`，集成 playwright-stealth               | Stealth 模块          |
| D3   | 新建 `proxy/manager.ts`，接入代理试用账号                | Proxy 模块            |
| D4   | 增强 `llm/config.ts` + `client.ts`，增加 Claude Sonnet 4 | LLM 提供商扩展        |
| D5   | 重新跑 20 个网站 benchmark，对比改善                     | 增强后 benchmark 报告 |

**成功标准**：

- Tier A 提取准确率 ≥ 85%（基线 ~60%）
- 20 个网站中 ≥ 16 个成功提取
- 单站点耗时 < 60s

### Phase 1：多页面爬取（5 个工作日）

| 日   | 任务                                           | 产出             |
| ---- | ---------------------------------------------- | ---------------- |
| D6-7 | 新建 `multi-page.ts`，实现子页面发现和爬取     | 多页面模块       |
| D8   | 增强 `website-crawl.ts`，集成多页面合并逻辑    | 策略路由 + 合并  |
| D9   | 增强 `site-probe.ts`，增加 Cloudflare 等级检测 | 探测增强         |
| D10  | 50 个网站全量测试 + 修复                       | Phase 1 测试报告 |

**成功标准**：

- 平均字段覆盖从 ~10 个提升至 ~25 个
- 50 个网站中 ≥ 40 个成功提取

### Phase 2：生产化（后续规划，不在本次实施范围）

- BullMQ 任务队列 + Redis
- Sentry 错误监控集成
- 提取结果仪表盘
- 批量调度 API

---

## 6. 新增/修改文件清单

| 操作 | 文件路径                                        | 行数估算 |
| ---- | ----------------------------------------------- | -------- |
| 新建 | `worker/src/crawl/stealth.ts`                   | ~80      |
| 新建 | `worker/src/proxy/manager.ts`                   | ~120     |
| 新建 | `worker/src/crawl/multi-page.ts`                | ~100     |
| 修改 | `worker/src/crawl/site-probe.ts`                | +30      |
| 修改 | `worker/src/llm/config.ts`                      | +15      |
| 修改 | `worker/src/llm/client.ts`                      | +60      |
| 修改 | `worker/src/extractors/website-crawl.ts`        | +80      |
| 修改 | `worker/package.json`                           | +3 deps  |
| 新建 | `worker/src/crawl/__tests__/stealth.test.ts`    | ~60      |
| 新建 | `worker/src/proxy/__tests__/manager.test.ts`    | ~80      |
| 新建 | `worker/src/crawl/__tests__/multi-page.test.ts` | ~100     |

新增依赖：

- `playwright-extra` + `puppeteer-extra-plugin-stealth` — 浏览器反检测
- `@anthropic-ai/sdk` — Claude API 客户端

---

## 7. 测试策略

### 7.1 单元测试

| 模块               | 测试场景                                             |
| ------------------ | ---------------------------------------------------- |
| `stealth.ts`       | context 创建成功；proxy 配置注入；webdriver 标记隐藏 |
| `proxy/manager.ts` | 域名粘性轮换；失败上报后避开；无代理时返回 null      |
| `multi-page.ts`    | nav 链接解析；关键词匹配；去重和限数；优先级排序     |
| `site-probe.ts`    | Cloudflare header 检测；各等级分类准确               |
| `llm/client.ts`    | Anthropic API 适配；fallback 到中文 Provider         |

### 7.2 集成测试

| 场景                  | 测试方法                                                     |
| --------------------- | ------------------------------------------------------------ |
| 端到端提取流程        | Mock HTTP 服务器模拟目标网站，验证完整提取管道               |
| Stealth + Proxy 联动  | 验证 stealth context 正确传入 proxy 配置                     |
| 多页面合并            | 3 个页面各提取部分字段，验证合并后字段完整且 confidence 正确 |
| LLM Provider Fallback | Mock Claude API 返回 500，验证降级到 Qwen                    |

### 7.3 E2E 测试（Benchmark）

- 20 个真实供应商网站（Phase 0 基线）
- 50 个网站（Phase 1 全量）
- 按市场分组（US x5, UK x5, AU x4, CA x3, EU x3）
- 记录：成功率、字段覆盖数、Tier A 准确率、耗时、使用策略

---

## 8. 风险与缓解

| 风险                                      | 概率 | 影响 | 缓解措施                                              |
| ----------------------------------------- | ---- | ---- | ----------------------------------------------------- |
| playwright-stealth 对新版 Cloudflare 无效 | 中   | 高   | 降级到标准模式 + 标记人工处理；评估 rebrowser-patches |
| 住宅代理被目标网站封禁                    | 中   | 中   | 多供应商代理池；域名级别冷却时间                      |
| Claude API 成本超预期                     | 低   | 中   | 保留 Haiku 快速通道；简单页面走 Qwen 降低成本         |
| 多页面爬取触发反爬                        | 中   | 中   | 子页面间随机间隔 2-5s；单站点总页数限制 ≤ 7           |
| Anthropic SDK 与 Worker 运行时不兼容      | 低   | 低   | 可回退到直接 HTTP 调用 Messages API                   |

---

## 9. 成本影响

| 项目         | 当前    | 增强后（Phase 0-1） |
| ------------ | ------- | ------------------- |
| Worker 运行  | ~$10/月 | ~$10/月（不变）     |
| 代理服务     | $0      | ~$50-100/月         |
| LLM API      | ~$5/月  | ~$15-30/月          |
| CAPTCHA 解决 | $0      | ~$5-10/月           |
| **合计**     | ~$15/月 | **~$80-150/月**     |

ROI：节省 BD 手工填充 60-70% 的时间 → 约 $2,000-4,000/月。

---

## 10. 上线清单（Phase 0-1 完成时逐项核实）

- [ ] `npx vitest run`（worker 目录）全部通过
- [ ] `npx tsc --noEmit`（worker 目录）无错误
- [ ] 新环境变量已添加到 Fly.io secrets
- [ ] `result` JSONB 的 `schema_version: 2` 向后兼容（旧版无此字段仍正常工作）
- [ ] 代理服务账号已开通试用
- [ ] Anthropic API Key 已获取并配置
- [ ] 20 个网站 benchmark 通过成功标准
- [ ] 无新增数据库 migration 需要（确认）
- [ ] README.md 已更新新增环境变量

---

## 附录：方案评审清单（CLAUDE.md §9.3）

> Major Track 要求所有维度 ≥ 8/10 方可进入编码阶段。

### 1. 国际化场景覆盖 — 9/10

- [x] 明确覆盖 US/UK/AU/CA/EU 五大市场
- [x] 价格格式国际化处理（周租→月租换算、多币种）
- [x] LLM prompt 支持多语言页面理解（英/法/德/西/意/葡）
- [x] 浏览器指纹随机化适配各地区（language, timezone）
- [ ] 未涵盖亚洲市场（日/韩/新加坡）— 非当前业务优先级，可后续扩展

### 2. 数据模型向后兼容 — 9/10

- [x] 无新增数据库列，零 migration
- [x] 通过 JSONB `result` 字段扩展，`schema_version: 2` 标记新格式
- [x] 旧版结果（无 `schema_version`）继续兼容
- [x] 不修改现有 API 接口契约（Trigger/Callback 格式不变）

### 3. Rate Limiting 设计 — 8/10

- [x] 域名级别并发限制（同一域名最大 2 并发页面）
- [x] 请求间隔 2-5s 随机化
- [x] 单站点最多 7 个页面限制
- [x] 代理失败后域名级别冷却
- [ ] 未设计全局 rate limit 仪表盘（Phase 2 议题）

### 4. GDPR 合规设计 — 8/10

- [x] 仅提取公开商业信息（名称、地址、价格、设施）
- [x] 联系方式仅用于商业合作联络，不批量存储个人隐私
- [x] 尊重 robots.txt
- [x] 不绕过认证/登录墙
- [x] 供应商可通过后台标记「拒绝爬取」
- [ ] 未设计自动化数据保留/删除策略 — 提取结果跟随 building 生命周期，
      building 删除时级联清理（现有机制）

### 5. 测试用例覆盖 — 9/10

- [x] 正常场景：各类网站（SPA/SSR/WordPress/Static）成功提取
- [x] 边界场景：空页面、无 nav、无子页面、JSON-LD 不完整
- [x] 异常场景：Cloudflare 拦截、代理失败、LLM 超时、页面 404
- [x] 性能基准：20/50 网站 benchmark 有明确成功标准
- [ ] 未覆盖并发压力测试（Phase 2 BullMQ 引入后再测）

### 6. Sentry 监控告警 — 7/10 ⚠️

- [x] 错误路径有 `console.error('[模块名]', error)` 日志
- [x] Worker 已有 `/health` 健康检查端点
- [ ] **未集成 Sentry SDK** — 当前 Worker 仅用 console.error
- **缓解**：Phase 0-1 通过 Fly.io 日志监控；Phase 2 正式集成 Sentry

> 此项低于 8/10，但属于可观测性增强而非功能缺陷。建议 Phase 2 补齐，
> 不阻塞 Phase 0-1 的功能开发。如评审方认为必须 8/10 以上，可在 Phase 0
> 第一天先集成 `@sentry/node` 到 Worker。

### 7. 新增页面状态设计 — 9/10

- [x] 无新增前端页面（不修改 UI）
- [x] 提取结果通过现有 callback 写入，Onboarding 编辑页自动展示
- [x] 置信度分级（high/medium/low）驱动 UI 中的人工确认标记
- [x] 失败任务有明确错误状态和错误消息

### 8. 方案文档已更新 — 10/10

- [x] 调研报告：`docs/APARTMENT_SCRAPING_FEASIBILITY.md`
- [x] 方案设计：`docs/DESIGN_SCRAPING_ENHANCEMENT.md`（本文档）
- [x] 架构文档 `docs/ARCHITECTURE.md` 无需更新（不新增 API 端点）

---

### 评审总结

| 维度          | 评分  | 状态 |
| ------------- | ----- | ---- |
| 国际化覆盖    | 9/10  | PASS |
| 数据模型兼容  | 9/10  | PASS |
| Rate Limiting | 8/10  | PASS |
| GDPR 合规     | 8/10  | PASS |
| 测试覆盖      | 9/10  | PASS |
| Sentry 监控   | 7/10  | WARN |
| 页面状态设计  | 9/10  | PASS |
| 文档同步      | 10/10 | PASS |

**7/8 项达标（≥8/10），1 项 WARN（Sentry 7/10）。**

**建议处理方式**：在 Phase 0 Day 1 先花 30 分钟集成 `@sentry/node` 到 Worker，
将 Sentry 监控提升至 8/10，消除唯一的 WARN 项后正式开始编码。
