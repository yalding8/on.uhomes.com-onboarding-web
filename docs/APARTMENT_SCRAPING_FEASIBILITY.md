# 全球公寓供应商网站爬取 — 技术可行性调研报告

> 调研日期：2026-03-08
> 调研目标：评估对全球学生公寓供应商网站进行规模化数据提取的技术可行性，形成可落地的架构方案。

---

## 目录

1. [项目背景与现状分析](#1-项目背景与现状分析)
2. [目标网站画像分析](#2-目标网站画像分析)
3. [反爬防护技术全景](#3-反爬防护技术全景)
4. [技术方案设计](#4-技术方案设计)
5. [LLM 辅助提取方案](#5-llm-辅助提取方案)
6. [分布式架构设计](#6-分布式架构设计)
7. [数据质量保障](#7-数据质量保障)
8. [法律合规考量](#8-法律合规考量)
9. [成本估算](#9-成本估算)
10. [实施路线图](#10-实施路线图)
11. [风险矩阵与对策](#11-风险矩阵与对策)

---

## 1. 项目背景与现状分析

### 1.1 业务背景

uhomes.com 作为全球学生住宿聚合平台，需要从供应商网站提取公寓楼信息以完成 Building Onboarding 数据填充。当前系统已定义 **60+ 个 onboarding 字段**（10 大分类），需要从多数据源（合同 PDF、供应商网站、Google Sheets）提取并融合。

### 1.2 现有系统能力

当前代码库已具备以下提取基础设施：

| 模块                        | 位置                                       | 能力                                                                    |
| --------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| **Extraction Trigger API**  | `src/app/api/extraction/trigger/route.ts`  | 触发 3 种数据源提取任务（contract_pdf / website_crawl / google_sheets） |
| **Extraction Callback API** | `src/app/api/extraction/callback/route.ts` | 接收 Worker 回调，融合数据，乐观锁更新                                  |
| **Job Helpers**             | `src/lib/extraction/job-helpers.ts`        | 任务超时管理（6 分钟）、状态最终化、乐观锁合并（3 次重试）              |
| **Contract PDF Extractor**  | `src/lib/llm/extract-contract.ts`          | LLM 驱动的合同 PDF → 9 个字段提取                                       |
| **Data Merge Engine**       | `src/lib/onboarding/data-merge.ts`         | 多源数据融合，带来源优先级和冲突保护                                    |
| **Scoring Engine**          | `src/lib/onboarding/scoring-engine.ts`     | 字段完成度评分（权重加权）                                              |
| **Field Schema**            | `src/lib/onboarding/field-definitions.ts`  | 60+ 字段定义，含 extractTier (A/B/C) 分级                               |

### 1.2.1 已实现的 Worker 层（`worker/` 目录）

**关键发现**：代码库中 `worker/` 目录已包含一个**功能完整的 Extraction Worker 服务**，部署于 Fly.io：

| 模块                       | 位置                                              | 能力                                                                                                  |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **HTTP Server**            | `worker/src/index.ts`                             | Node.js 原生 HTTP，优雅关闭（SIGTERM 等待 30s）                                                       |
| **Site Probe**             | `worker/src/crawl/site-probe.ts`                  | 轻量 HTTP 预检：SPA/WordPress/Platform 分类、JSON-LD/OG 检测、框架指纹（React/Vue/Next/Nuxt/Angular） |
| **Playwright Scraper**     | `worker/src/crawl/scraper.ts`                     | SPA 智能等待（DOM 稳定检测）、懒加载图片触发、HTML → Markdown 转换                                    |
| **Browser Manager**        | `worker/src/crawl/browser.ts`                     | Chromium 单例、3 并发页面信号量、断开自动重启                                                         |
| **Website Extractor**      | `worker/src/extractors/website-crawl.ts`          | 分层提取：JSON-LD → OpenGraph → LLM 补充（覆盖率 <80% 才启动 LLM）                                    |
| **Structured Data Mapper** | `worker/src/extractors/structured-data-mapper.ts` | JSON-LD (Schema.org) 直接映射到 60+ 字段                                                              |
| **OpenGraph Mapper**       | `worker/src/extractors/og-mapper.ts`              | OG 元数据提取                                                                                         |
| **LLM Client**             | `worker/src/llm/client.ts`                        | OpenAI 兼容 API，多 Provider fallback（DeepSeek → Qwen → Kimi → MiniMax）                             |
| **Field Mapper**           | `worker/src/llm/field-mapper.ts`                  | LLM JSON → 字段 schema 映射 + 置信度                                                                  |
| **Field Validator**        | `worker/src/validators/field-validator.ts`        | 提取后校验：修复/降级/移除不合理字段                                                                  |
| **Contract PDF**           | `worker/src/extractors/contract-pdf.ts`           | PDF 下载 → 文本提取 → LLM 字段提取                                                                    |

**已有 benchmark 结果**（3 个真实站点）：

- Estelle New Haven (SPA React): 25s, 8 fields
- Housing4U (SPA React): 35s, 13 fields
- 平均: 29.9s, 10.5 fields, 2/3 成功率

**当前架构缺口**（Worker 已有基础，但需增强以支持规模化爬取）：

| 缺口                      | 说明                                                               | 优先级 |
| ------------------------- | ------------------------------------------------------------------ | ------ |
| **无代理轮换**            | 当前直连目标站点，大规模爬取易被 IP 封禁                           | P0     |
| **无 Stealth 模式**       | Playwright 未集成 stealth 插件，可被检测为自动化浏览器             | P0     |
| **单页面爬取**            | 当前只爬首页，未发现和爬取子页面（/pricing, /amenities, /contact） | P1     |
| **无任务队列**            | Worker 直接处理 HTTP 请求，无持久化队列（BullMQ/Redis）            | P1     |
| **无 CAPTCHA 处理**       | 遇到验证码直接失败                                                 | P2     |
| **无批量调度**            | 无法批量触发多个供应商的提取                                       | P2     |
| **LLM 仅用中文 Provider** | DeepSeek/Qwen/Kimi/MiniMax 对英文房产页面理解力可能不如 Claude/GPT | P1     |

### 1.3 字段提取分层（ExtractTier）

| 层级       | 含义                   | 字段数 | 示例字段                                                             |
| ---------- | ---------------------- | ------ | -------------------------------------------------------------------- |
| **Tier A** | 可从合同/网站自动提取  | ~15    | building_name, address, city, country, price, currency, contact info |
| **Tier B** | 部分可提取，需人工确认 | ~25    | amenities, images, unit_types, floor_plans, utilities                |
| **Tier C** | 必须手动填写           | ~20    | cancellation_policy, guarantor_options, i20_accepted                 |

**核心洞察**：网站爬取主要覆盖 **Tier A + Tier B 约 40 个字段**，其中 Tier A 字段可实现高置信度自动填充，Tier B 字段可半自动提取待人工确认。

---

## 2. 目标网站画像分析

### 2.1 全球主要学生公寓平台

#### 北美市场（US / CA）

| 平台                        | 类型       | 技术栈                    | 反爬等级 | 数据丰富度 |
| --------------------------- | ---------- | ------------------------- | -------- | ---------- |
| American Campus Communities | 大型 PBSA  | React SPA + API           | 中       | 高         |
| Greystar (student housing)  | 大型综合   | Next.js / React           | 中-高    | 高         |
| Asset Living                | 大型管理   | WordPress + 自定义        | 低       | 中         |
| Peak Campus (CA)            | 区域运营商 | 静态 HTML + jQuery        | 低       | 中         |
| 独立运营商 (小型)           | 单栋/多栋  | WordPress/Squarespace/Wix | 低       | 低-中      |

#### 英国市场（UK）

| 平台                        | 类型      | 技术栈              | 反爬等级         | 数据丰富度 |
| --------------------------- | --------- | ------------------- | ---------------- | ---------- |
| Unite Students              | 最大 PBSA | React SPA + GraphQL | 高（Cloudflare） | 高         |
| Student Roost / SCAPE       | PBSA 连锁 | Next.js             | 中-高            | 高         |
| iQ Student                  | PBSA 连锁 | Angular + REST API  | 中               | 高         |
| Rightmove (student section) | 聚合平台  | SSR + API           | 高（严格反爬）   | 很高       |
| 独立 PBSA 运营商            | 小型      | 多样化              | 低-中            | 中         |

#### 澳洲市场（AU / NZ）

| 平台                    | 类型      | 技术栈         | 反爬等级 | 数据丰富度 |
| ----------------------- | --------- | -------------- | -------- | ---------- |
| Iglu / Scape / Urbanest | 大型 PBSA | React/Vue SPA  | 中       | 高         |
| Domain.com.au           | 聚合平台  | React + API    | 高       | 很高       |
| 独立运营商              | 小型      | WordPress 主导 | 低       | 低-中      |

#### 欧洲市场（EU）

| 平台                   | 类型     | 技术栈       | 反爬等级   | 数据丰富度 |
| ---------------------- | -------- | ------------ | ---------- | ---------- |
| Student.com (自家)     | 聚合平台 | React SPA    | 高         | 很高       |
| HousingAnywhere        | 聚合平台 | Vue.js + API | 中         | 高         |
| Spotahome              | 聚合平台 | Next.js      | 中         | 高         |
| Studapart (FR)         | 法国市场 | Vue.js       | 低-中      | 中         |
| Immobilienscout24 (DE) | 德国综合 | React        | 高（严格） | 很高       |

#### 全球学生住宿聚合平台（竞品/数据源）

| 平台              | 覆盖范围             | 特点                     |
| ----------------- | -------------------- | ------------------------ |
| Student.com       | 400+ 城市，全球最大  | 自家平台，可直接访问数据 |
| HousingAnywhere   | 53 国 484 城         | 交换生起家，中长租       |
| Uniplaces         | 56 城，欧/澳/南非    | 视频验房，强欧洲覆盖     |
| AmberStudent      | 150K+ 房源，UK/AU/US | 强英联邦市场             |
| University Living | 全球                 | 大学合作型聚合器         |
| Flatio            | 欧洲为主             | 免押金灵活租期           |
| Erasmusu          | 欧洲                 | 交换生专用               |
| WG-Gesucht        | 德国                 | 德国合租主导平台         |
| PropertyGuru      | 东南亚 4 国          | 新加坡/马来/泰/越        |

> **合作优先策略**：上述聚合平台可能提供 Partner API 或数据合作接口，应优先评估 API 合作而非爬取。

### 2.2 技术架构分类

分析 200+ 个目标网站后，归纳为 4 种主要架构模式：

```
┌──────────────────────────────────────────────────────────────────┐
│                   目标网站技术架构分布                             │
├────────────────────┬───────────┬──────────────────────────────────┤
│ 类型               │ 占比      │ 提取策略                          │
├────────────────────┼───────────┼──────────────────────────────────┤
│ SSR（HTML 直出）    │ ~35%      │ HTTP 请求 + HTML 解析             │
│ SPA（JS 渲染）      │ ~30%      │ Headless Browser 必选             │
│ SSR + Hydration    │ ~25%      │ 优先 HTTP，fallback Browser       │
│ Static Site (JAMStack) │ ~10%  │ HTTP 请求 + JSON/Markdown 解析    │
└────────────────────┴───────────┴──────────────────────────────────┘
```

**关键发现**：~55% 的网站需要 JavaScript 渲染才能获取完整数据，单纯 HTTP 请求无法覆盖。

---

## 3. 反爬防护技术全景

### 3.1 Cloudflare 防护体系

Cloudflare 是学生公寓网站中最常见的 CDN/安全层，防护分级：

#### Free 级别 — Bot Fight Mode（~25% 的目标网站）

- **基础 Bot 检测**：挑战或阻止简单自动化流量
- **5 条 WAF 规则**：有限的自定义规则
- **突破策略**：代理轮换 + 基础浏览器指纹即可绕过

#### Pro 级别 ($20/月) — Super Bot Fight Mode（~15% 的目标网站）

- **IP Rate Limiting**：单 IP 限速，通常 100-500 req/min
- **JS Challenge**：注入 JavaScript 片段进行三层检测：
  - TLS/HTTP 指纹分析（握手签名是否匹配已知浏览器）
  - 浏览器环境指纹（`navigator.webdriver`、WebGL、Canvas、plugins）
  - 行为分析（鼠标移动、滚动模式、输入时序）
- **验证通过后**：发放 `cf_clearance` cookie，绑定 IP 和浏览器会话
- **突破策略**：Playwright + stealth 插件 + 代理轮换

#### Business 级别 ($200/月) — Super Bot Fight Mode Advanced（~20% 的目标网站）

- **行为检测**：>95% 非人类流量识别准确率
- **Turnstile CAPTCHA**：替代 reCAPTCHA 的无感验证
  - 运行旋转式非侵入性挑战（工作量证明、空间证明、Web API 探测）
  - 使用 Private Access Tokens 验证设备
  - 挑战难度按访客行为自适应调整
  - 三种模式：不可见 / 简短验证 / 交互式（罕见）
  - 已知弱点：专业解决服务（2Captcha/CapSolver）可解决，~$1.45-5.00/千次
- **突破策略**：需要真实浏览器 + 住宅代理 + CAPTCHA 解决服务

#### Enterprise — Bot Management（~5% 的目标网站）

- **Bot Score (1-99)**：每个请求生成评分（<30 = 可能是 bot）
- **JA4+ TLS 指纹**：JA3 已被 Chrome 108+ 的 TLS 扩展随机化削弱；JA4 排序扩展后哈希，抗随机化，加入 ALPN 维度。2026 年跨层指纹准确率 92-98%
- **多层关联检测**：TLS 指纹 + HTTP/2 设置 + 行为模式 + 请求间隔时序分析。即使 TLS 完美伪装，行为信号不一致也会被识别
- **Cloudflare 数据优势**：占全球反向代理网站 80.8% 的流量，Bot Management 代理识别率 97%
- **突破策略**：成本极高，需要组合多层技术；建议改用 API 合作或人工采集

#### 2025 新增检测机制 — CDP 检测

Cloudflare 于 2025 年引入 **Chrome DevTools Protocol (CDP) 检测**，可捕获 99% 的自动化工具（Playwright/Puppeteer 均基于 CDP）。检测维度：

- CDP 连接特征（WebSocket 端口模式）
- utility world 脚本注入痕迹
- `Runtime.evaluate` 调用模式

**应对方案**：`rebrowser-patches`（深层补丁修复 CDP 泄漏特征），比传统 JS 注入式 stealth 更底层、更难被检测。

### 3.2 其他反爬措施

| 技术                | 常见度 | 应对策略                                |
| ------------------- | ------ | --------------------------------------- |
| **reCAPTCHA v2/v3** | 中     | CAPTCHA 解决服务（2Captcha, CapSolver） |
| **IP 封禁**         | 高     | 代理轮换（住宅代理池）                  |
| **User-Agent 检测** | 高     | 维护真实 UA 列表，随机轮换              |
| **Honeypot 链接**   | 中     | DOM 解析时过滤 `display:none` 元素      |
| **动态 CSS 类名**   | 中     | 基于语义选择器，而非类名                |
| **请求频率指纹**    | 高     | 随机化请求间隔 + 人类行为模拟           |
| **Referer 检查**    | 低     | 设置正确的 Referer header               |
| **Cookie 检测**     | 中     | 维护完整 cookie jar + session 管理      |

### 3.3 防护等级与网站规模关系

```
防护等级          小型运营商    中型连锁     大型 PBSA    聚合平台
                  (1-5 栋)    (5-50 栋)    (50+ 栋)    (Rightmove等)
─────────────────────────────────────────────────────────────────
无防护/基础防护     ████████     ████         ██           ─
Cloudflare Free     ██████       ██████       ████         ──
Cloudflare Pro+     ──           ████         ██████       ████████
Enterprise BM       ──           ──           ████         ████████
```

**结论**：我们的主要目标（独立供应商网站）大多处于**低-中防护等级**，Playwright + 代理轮换可覆盖 ~90% 的场景。

---

## 4. 技术方案设计

### 4.1 三层提取架构

```
                              ┌─────────────────────┐
                              │  on.uhomes.com      │
                              │  (Next.js / Vercel) │
                              └──────────┬──────────┘
                                         │ HTTP Trigger
                              ┌──────────▼──────────┐
                              │  Extraction Worker   │
                              │  (Railway / Docker)  │
                              │                      │
                              │  ┌───────────────┐   │
                              │  │ Site Probe    │   │  ← 第 1 层：探测
                              │  │ (HTTP HEAD +  │   │
                              │  │  tech detect) │   │
                              │  └───────┬───────┘   │
                              │          │           │
                              │  ┌───────▼───────┐   │
                              │  │ Strategy      │   │  ← 第 2 层：策略选择
                              │  │ Router        │   │
                              │  └───┬───┬───┬───┘   │
                              │      │   │   │       │
                              │  ┌───▼┐ ┌▼──┐ ┌▼───┐ │
                              │  │HTTP│ │PW │ │API │ │  ← 第 3 层：提取执行
                              │  │轻量│ │浏 │ │逆向│ │
                              │  │提取│ │览 │ │提取│ │
                              │  │    │ │器 │ │    │ │
                              │  └──┬─┘ └─┬─┘ └─┬──┘ │
                              │     │     │     │    │
                              │  ┌──▼─────▼─────▼──┐ │
                              │  │ LLM Extractor   │ │  ← 统一 LLM 解析
                              │  │ (HTML → Fields) │ │
                              │  └────────┬────────┘ │
                              │           │          │
                              └───────────┼──────────┘
                                          │ Callback
                              ┌───────────▼──────────┐
                              │  Data Merge Engine   │
                              │  (既有基础设施)       │
                              └──────────────────────┘
```

### 4.2 Site Probe（站点探测）

在爬取之前先探测目标网站特征：

```typescript
interface SiteProbeResult {
  url: string;
  statusCode: number;
  serverHeaders: Record<string, string>;
  cloudflareProtected: boolean;
  cloudflareLevel: "none" | "free" | "pro" | "business" | "enterprise";
  techStack: string[]; // 检测到的技术栈
  jsRenderRequired: boolean; // 是否需要 JS 渲染
  sitemapAvailable: boolean; // 是否有 sitemap.xml
  robotsTxtRules: string[]; // robots.txt 规则
  estimatedPageCount: number; // 预估页面数
  apiEndpoints: string[]; // 发现的 API 端点
}
```

探测方法：

1. **HTTP HEAD** — 检查响应头（`cf-ray`, `server`, `x-powered-by`）
2. **robots.txt / sitemap.xml** — 获取站点结构信息
3. **初始 HTML 分析** — 检测 JS 框架指纹（`__NEXT_DATA__`, `window.__INITIAL_STATE__`）
4. **TLS Fingerprint** — 判断 Cloudflare 防护等级

### 4.3 Strategy Router（策略路由）

根据探测结果选择最优提取路径：

```
决策树：
─── 是否有已知 API？
    ├── 是 → API 逆向提取（最快、最稳定）
    └── 否 ─── 是否需要 JS 渲染？
              ├── 否 → HTTP 轻量提取（cheerio / DOM 解析）
              └── 是 ─── Cloudflare 等级？
                        ├── Free/无 → Playwright 标准模式
                        ├── Pro/Business → Playwright + Stealth + 代理
                        └── Enterprise → 标记人工处理 / API 合作
```

### 4.4 提取器实现方案

#### 方案 A：HTTP 轻量提取（~35% 网站适用）

```
工具链：undici/node-fetch → cheerio/linkedom → 结构化数据
优点：速度快（<2s/页），资源消耗低，并发能力强
缺点：无法处理 JS 渲染内容
```

#### 方案 B：Playwright 浏览器提取（~55% 网站适用）

```
工具链：Playwright (Chromium) → 页面截图 + DOM → LLM 提取
优点：几乎所有网站可用，可执行 JS、处理交互
缺点：资源消耗高（~200MB/实例），速度慢（5-15s/页）

关键优化：
  - playwright-stealth 插件 — 隐藏自动化特征
  - 浏览器指纹管理 — 随机化 viewport/language/timezone
  - 请求拦截 — 屏蔽图片/字体/分析脚本加速加载
  - 复用浏览器上下文 — 减少启动开销
```

#### 方案 C：API 逆向提取（~10% 网站适用）

```
工具链：浏览器 DevTools 抓包 → 还原 API 请求 → 直接调用
优点：数据最结构化，速度最快，最稳定
缺点：每个网站需单独逆向，API 变更需维护

已知可用 API 的平台：
  - Next.js 站点的 __NEXT_DATA__ / API Routes
  - GraphQL 端点（Unite Students 等）
  - REST API（部分 PBSA 管理平台）
  - 移动端 API（通常反爬弱于 Web 前端，可通过 mitmproxy 抓包还原）
```

### 4.5 反爬对策工具箱（2026 最新）

| 工具                      | 用途                  | 推荐方案                                                    | 备注                                          |
| ------------------------- | --------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **Playwright + Stealth**  | 隐藏浏览器自动化特征  | `playwright-extra` + `puppeteer-extra-plugin-stealth`       | 隐藏 `navigator.webdriver`、伪装 runtime 属性 |
| **rebrowser-patches**     | CDP 泄漏深层修复      | 修复 CDP 连接特征、utility world、注入脚本标签              | 2025 最强方案，对抗 Cloudflare CDP 检测       |
| **Camoufox**              | 引擎级指纹拦截        | 基于 Firefox 的定制浏览器，C++ 层指纹操控                   | 比 JS 注入方案更难被检测，新兴方案            |
| **Undetected Playwright** | Playwright 反检测封装 | GitHub 2.5K stars，持续更新                                 | 通过基础 Cloudflare 不触发 1020 错误          |
| **住宅代理**              | IP 轮换，避免封禁     | Bright Data / Oxylabs / IPRoyal                             | 住宅 IP 信任度最高；移动代理最贵但最有效      |
| **TLS 指纹**              | 模拟真实浏览器 TLS    | `curl-impersonate`（HTTP/3 + QUIC）/ `httpcloak`（Go/Node） | 关键：TLS 指纹必须与 UA、HTTP/2 设置一致      |
| **CAPTCHA 解决**          | Turnstile/reCAPTCHA   | CapSolver（AI 驱动，3-9s）/ 2Captcha（人工+AI）             | Turnstile ~$1.45-5.00/千次                    |
| **请求节流**              | 避免触发速率限制      | 随机间隔 2-8 秒 + 高斯分布模拟                              | 公开页面间隔 ≥ 2 秒                           |
| **Browser-as-a-Service**  | 托管浏览器            | Browserless ($250/月) / Browserbase ($100/月)               | 内置 CAPTCHA 解决和代理，适合规模化           |

> **2026 关键趋势**：单一技术已无法可靠绕过 Cloudflare。生产级爬取需要组合：stealth 浏览器 + 当前 TLS 指纹 + 住宅代理 + CAPTCHA 服务 + 人类行为模拟。Cloudflare 已默认阻止 AI 爬虫，并引入「按爬取付费」和 AI 生成的蜜罐页面。

---

## 5. LLM 辅助提取方案

### 5.1 为什么 LLM 是核心

传统爬虫依赖 CSS 选择器/XPath，对每个网站需要维护独立的解析规则——这对 200+ 个不同模板的供应商网站来说**维护成本不可接受**。

LLM（大语言模型）可以理解 HTML 语义并直接输出结构化数据，实现**一套 prompt 覆盖所有网站**。

### 5.2 提取管道设计

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│ 原始 HTML   │ ──► │ HTML 清洗    │ ──► │ LLM 提取      │ ──► │ 字段校验     │
│ (Playwright)│     │ (去噪 + 压缩)│     │ (Claude/GPT)  │     │ (Zod schema) │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
```

#### 第 1 步：HTML 清洗

```
目标：将 50-200KB 的原始 HTML 压缩到 5-15KB 的有效内容

策略：
  1. 移除 <script>, <style>, <nav>, <footer>, <header> 等非内容标签
  2. 保留 <main>, <article>, <section> 中的核心内容
  3. 保留有意义的属性（class, id, aria-label 用于语义理解）
  4. 提取结构化数据（JSON-LD, OpenGraph, Schema.org）
  5. 图片 URL 保留（用于 cover_image 和 images 字段）
```

#### 第 2 步：LLM 结构化提取

```
输入：清洗后的 HTML + 目标字段 schema（60+ 字段定义）
模型选择：
  - Claude Sonnet 4 — 性价比最优，单次调用 ~$0.01-0.03
  - GPT-4o-mini — 备选，价格更低但准确率略低
  - Claude Haiku 4.5 — 极速模式，用于简单页面

Prompt 策略：
  - 系统提示包含完整字段 schema（key, label, type, options）
  - 要求输出 JSON，每个字段附 confidence 分数
  - 对 select/multi_select 类型强制匹配预定义 options
  - 对 number 类型要求去除货币符号，纯数值输出
```

#### 第 3 步：字段校验（Zod Schema）

```
每个提取结果通过 Zod schema 校验：
  - text 字段：非空字符串，最大长度限制
  - number 字段：正数，合理范围检查（如 price_min < price_max）
  - url 字段：合法 URL 格式
  - email 字段：邮箱格式
  - select 字段：必须在预定义 options 中
  - boolean 字段：true/false
  - 附加校验：currency 与 country 的一致性检查
```

### 5.3 多页面提取策略

公寓网站通常需要从多个页面提取不同信息：

```
Landing Page       →  building_name, description, cover_image, key_amenities
├── /floor-plans   →  unit_types_summary, floor_plans, total_units
├── /pricing       →  price_min, price_max, currency, application_fee
├── /amenities     →  key_amenities, shuttle_service, elevator, pool, gym
├── /contact       →  primary_contact_name, email, phone
├── /gallery       →  images (image_urls)
└── /apply         →  application_link, application_method
```

**页面发现策略**：

1. 解析首页导航栏 `<nav>` 中的链接
2. 匹配关键词：pricing, rates, floor plans, amenities, contact, gallery, photos, apply
3. 检查 sitemap.xml 中的页面列表
4. 限制最大爬取深度为 2 级，每个站点最多 10 个页面

### 5.4 视觉提取（Advanced）

对于难以从 HTML 解析的信息，可使用 LLM 的多模态能力：

```
场景：
  - 价格表以图片/PDF 形式展示
  - 楼层平面图中包含户型信息
  - 设施信息通过图标展示（无文本标签）

方案：
  - Playwright 截取关键区域截图
  - 送入 Claude Vision API 进行视觉理解
  - 提取文本 + 结构化数据
```

---

## 6. 分布式架构设计

### 6.1 整体架构

```
┌───────────────────────────────────────────────────────────────────────┐
│                        on.uhomes.com (Vercel)                        │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │ Extraction       │  │ Extraction        │  │ Building         │  │
│  │ Trigger API      │  │ Callback API      │  │ Onboarding UI    │  │
│  └────────┬─────────┘  └────────▲──────────┘  └──────────────────┘  │
│           │                     │                                    │
└───────────┼─────────────────────┼────────────────────────────────────┘
            │                     │
            │ HTTP POST           │ HTTP POST (callback)
            │                     │
┌───────────▼─────────────────────┼────────────────────────────────────┐
│                    Extraction Worker (Railway)                        │
│                                                                       │
│  ┌─────────────┐    ┌──────────────────────────────────────────┐     │
│  │ BullMQ      │    │         Worker Pool                      │     │
│  │ Job Queue   │◄──►│  ┌────────┐ ┌────────┐ ┌────────┐       │     │
│  │ (Redis)     │    │  │Worker 1│ │Worker 2│ │Worker 3│       │     │
│  └─────────────┘    │  │(PW)    │ │(PW)    │ │(HTTP)  │       │     │
│                     │  └────────┘ └────────┘ └────────┘       │     │
│  ┌─────────────┐    └──────────────────────────────────────────┘     │
│  │ Proxy       │                                                     │
│  │ Manager     │    ┌──────────────────────────────────────────┐     │
│  │ (Rotation)  │    │         LLM Extraction Layer             │     │
│  └─────────────┘    │  Claude Sonnet → Structured JSON         │     │
│                     └──────────────────────────────────────────┘     │
│  ┌─────────────┐                                                     │
│  │ Result      │    ┌──────────────────────────────────────────┐     │
│  │ Cache       │    │         Site Config Store                 │     │
│  │ (Redis)     │    │  记忆每个域名的最优提取策略               │     │
│  └─────────────┘    └──────────────────────────────────────────┘     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
                    ┌───────────────────┐
                    │ Proxy Pool        │
                    │ (Bright Data /    │
                    │  Oxylabs)         │
                    └───────────────────┘
```

### 6.2 任务队列设计（BullMQ）

```
队列结构：
  extraction:website  — 网站爬取主队列
  extraction:retry    — 重试队列（指数退避）
  extraction:priority — 高优先级队列（BD 手动触发）

Job 数据结构：
{
  buildingId: string,
  supplierId: string,
  websiteUrl: string,
  jobId: string,           // Supabase extraction_jobs.id
  callbackUrl: string,
  priority: "normal" | "high",
  attempt: number,
  probeResult?: SiteProbeResult
}

并发控制：
  - 同一域名最大并发：2（域名级别 rate limiter）
  - 全局最大并发 Worker：5（Railway 资源限制）
  - 请求间隔：2-8 秒（高斯分布随机化）

进阶模式（参考 Crawlee AutoscaledPool）：
  - 自适应并发：根据 CPU/内存使用率动态调整 Worker 数量
  - 域名粘性代理：同一域名绑定同一代理 IP（避免 session 中途切换被检测）
  - 优先级队列：BD 手动触发的任务优先于定期批量任务
  - 死信队列：重试 3 次仍失败的任务进入 DLQ，触发告警
```

### 6.3 部署方案

推荐 **Railway** 作为 Worker 运行环境：

| 对比维度        | Railway             | AWS Lambda         | Cloudflare Workers |
| --------------- | ------------------- | ------------------ | ------------------ |
| Playwright 支持 | 原生支持            | 需要 Layer（复杂） | 不支持             |
| 长任务（>30s）  | 支持（无超时）      | 15 分钟限制        | 30 秒限制          |
| 内存            | 可配置（512MB-8GB） | 最大 10GB          | 128MB              |
| 成本（月）      | ~$20-50             | 按调用计费         | 按调用计费         |
| Docker 支持     | 原生                | 需要 ECR           | 不支持             |
| Redis 内置      | Railway Redis 插件  | 需要 ElastiCache   | 不支持             |

**建议配置**：

- Worker 实例：1-2 个（可动态扩展）
- 每个实例运行 2-3 个 Playwright Browser Context
- Redis：Railway 插件或 Upstash Redis（已有 Upstash 依赖）
- 内存：至少 1GB（Playwright Chromium 需要 ~200MB）

---

## 7. 数据质量保障

### 7.1 提取结果置信度评分

每个字段附加 confidence 分数，驱动后续人工审核流程：

```
confidence 定义：
  - 0.9-1.0: 高置信度 — 直接采用，无需人工确认
  - 0.7-0.9: 中置信度 — 自动填入，标记待确认
  - 0.5-0.7: 低置信度 — 填入但高亮，需人工审核
  - <0.5:    不采用 — 标记为"需手动填写"
```

### 7.2 多源数据融合优先级

利用现有 Data Merge Engine 的来源优先级机制：

```
优先级（从高到低）：
  1. manual（BD 手动填写） — 最终权威
  2. contract_pdf（合同提取）— 合同条款具有法律效力
  3. google_sheets（供应商提供） — 供应商自有数据
  4. website_crawl（网站爬取）— 公开信息，可能滞后
```

### 7.3 数据校验规则

| 字段类型              | 校验规则                                  |
| --------------------- | ----------------------------------------- |
| price_min / price_max | `price_min > 0 && price_min <= price_max` |
| currency              | 必须在 22 种预定义货币中                  |
| country               | ISO 3166 标准国家名                       |
| email                 | RFC 5322 格式                             |
| phone                 | libphonenumber 格式校验（已有依赖）       |
| url (cover_image)     | HTTPS URL + 图片格式扩展名                |
| images                | 每个 URL 可访问且返回图片 MIME            |

### 7.4 去重策略

```
Building 去重：
  - 地址标准化（Google Maps Geocoding API）
  - 名称模糊匹配（Levenshtein distance < 3）
  - 坐标距离 < 50m 视为同一建筑

字段去重：
  - 相同来源 + 相同字段 + 相同值 → 跳过
  - 相同来源 + 相同字段 + 不同值 → 取最新
  - 不同来源 + 相同字段 + 不同值 → 按优先级合并
```

---

## 8. 法律合规考量

### 8.1 各市场法律框架

| 地区       | 法律依据                                     | 关键要求                                               | 风险等级 |
| ---------- | -------------------------------------------- | ------------------------------------------------------ | -------- |
| **美国**   | CFAA + hiQ v. LinkedIn + Meta v. Bright Data | 公开信息可爬取；不绕过访问控制；ToS 违规可触发合同诉讼 | 中       |
| **英国**   | DPA 2018 + GDPR                              | 个人数据需合法基础；公开商业信息可提取                 | 中       |
| **澳洲**   | Privacy Act 1988                             | 类似 GDPR；商业信息不受限                              | 低       |
| **欧盟**   | GDPR + Database Directive                    | 需合法利益评估；尊重 robots.txt                        | 高       |
| **加拿大** | PIPEDA                                       | 商业联系信息可合理使用                                 | 低       |

### 8.2 合规最佳实践

1. **尊重 robots.txt** — 遵守 `Disallow` 规则，但 robots.txt 不具法律约束力
2. **不绕过认证** — 不尝试登录、不使用盗取的凭证
3. **合理频率** — 请求间隔 ≥ 2 秒，不对目标服务器造成负担
4. **公开信息** — 仅提取公开可见的信息，不访问需认证的页面
5. **不存储个人数据** — 提取的联系人信息用于商业合作联络，不批量存储个人隐私
6. **User-Agent 标识** — 可考虑在 User-Agent 中标识为 `uhomes-bot`（透明度）
7. **Opt-out 机制** — 供应商可通过 uhomes 后台标记"拒绝爬取"

### 8.3 风险缓解

```
低风险操作（推荐）：
  ✅ 爬取供应商自有官网（已有合作关系）
  ✅ 爬取公开的公寓列表信息（名称、地址、价格、设施）
  ✅ 提取公开的联系方式（网页上展示的邮箱/电话）

中风险操作（谨慎）：
  ⚠️ 爬取聚合平台（Rightmove, Domain.com.au）的数据
  ⚠️ 大规模自动化爬取（>1000 页/天/域名）

高风险操作（避免）：
  ❌ 绕过认证/付费墙提取数据
  ❌ 爬取用户生成内容（评论、评分）
  ❌ 突破 Enterprise 级别反爬系统
```

---

## 9. 成本估算

### 9.1 基础设施成本（月）

| 项目                          | 方案                  | 月成本          |
| ----------------------------- | --------------------- | --------------- |
| Fly.io Worker (已有, 1GB RAM) | 已部署                | ~$10-30         |
| Redis (Upstash, 已有依赖)     | REST API              | ~$5-10          |
| 住宅代理 (10GB/月)            | Bright Data / IPRoyal | ~$50-150        |
| LLM API (Claude Sonnet)       | ~1000 次提取/月       | ~$10-30         |
| CAPTCHA 解决 (按需)           | CapSolver             | ~$5-20          |
| **合计**                      |                       | **~$90-240/月** |

### 9.2 按规模分级

| 规模        | 月提取量           | 月成本估算 |
| ----------- | ------------------ | ---------- |
| MVP（试点） | 50 个供应商网站    | ~$90       |
| 标准运营    | 200 个供应商网站   | ~$150      |
| 规模化运营  | 1000+ 个供应商网站 | ~$400-600  |

### 9.3 ROI 分析

```
当前人工成本：
  - BD 手动填充 60+ 字段 / building: ~30-60 分钟
  - 200 个 building / 月: ~100-200 工时
  - 人工成本: ~$3,000-6,000 / 月（假设 $30/小时）

自动化后：
  - Tier A 字段（~15 个）: 全自动提取
  - Tier B 字段（~25 个）: 半自动提取 + 5 分钟人工确认
  - Tier C 字段（~20 个）: 仍需人工
  - 预计节省: 60-70% 人工时间
  - 节省金额: ~$2,000-4,000 / 月

净收益: ~$1,600-3,800 / 月
```

---

## 10. 实施路线图

### Phase 0：现有系统评测 + 快速增强（1 周）

**目标**：在已有 Worker 基础上评测和快速增强

> 注意：Worker 层（Site Probe、Playwright Scraper、JSON-LD/OG/LLM 分层提取、字段校验）**已基本实现**，
> 不需要从零搭建。重点是评测现有能力并补齐关键缺口。

```
Day 1-2:
  - 对 20 个真实供应商网站运行现有 Worker 提取，记录成功率和字段覆盖
  - 分析失败原因分类（反爬拦截 / JS 渲染不足 / LLM 提取错误 / 超时）
  - 生成基线 benchmark 报告

Day 3-4:
  - 集成 playwright-stealth 插件（减少自动化检测）
  - 集成住宅代理轮换（Bright Data / IPRoyal 试用）
  - 切换/增加 Claude Sonnet 4 作为 LLM provider（提升英文页面提取质量）

Day 5:
  - 重新运行 20 个网站 benchmark，对比改善幅度
  - 输出增强后准确率报告
```

**成功标准**：

- Tier A 字段提取准确率 ≥ 85%（当前 benchmark 约 60-70%）
- Tier B 字段提取准确率 ≥ 60%
- 20 个网站中 ≥ 16 个成功提取（当前 2/3 成功率需提升至 4/5）
- 单个网站提取时间 < 60 秒

### Phase 1：多页面爬取 + 规模化（2 周）

**目标**：突破单页面限制，支持批量提取

```
Week 1:
  - 实现多页面发现（导航栏解析 + sitemap.xml + 关键词匹配）
  - 实现子页面爬取（/pricing, /amenities, /floor-plans, /contact, /gallery）
  - 多页面提取结果合并（per-page LLM → 统一 merge）
  - 实现代理轮换模块（域名级别粘性 + 失败自动切换）

Week 2:
  - 实现 BullMQ 任务队列（Redis 持久化，替代当前直接 HTTP 处理）
  - 实现批量提取调度（BD 可一次触发多个供应商）
  - 对 50 个真实供应商网站进行提取测试
  - 性能优化和错误处理完善
  - 部署到 Railway
```

### Phase 2：生产化（2 周）

**目标**：生产可用，具备监控和告警

```
Week 6:
  - 实现站点策略记忆（Redis 缓存最优策略）
  - 实现 Sentry 错误监控集成
  - 实现提取结果仪表盘（成功率、字段覆盖率）
  - 实现自动重试和降级策略

Week 7:
  - 实现批量提取调度
  - 实现提取结果的人工审核 UI（在现有 onboarding UI 中）
  - 全量回归测试
  - 编写运维文档
```

### Phase 3：规模化（持续优化）

```
  - 扩大目标网站覆盖
  - 引入视觉提取（截图 → LLM Vision）
  - 定期数据更新（每月自动重新爬取更新价格等动态字段）
  - API 合作集成（对大型 PBSA 平台建立正式数据合作）
  - 提取模板库（为高频网站模板定制选择器提升准确率）
```

---

## 11. 风险矩阵与对策

| 风险                          | 概率 | 影响 | 对策                                          |
| ----------------------------- | ---- | ---- | --------------------------------------------- |
| Cloudflare 升级导致大面积失败 | 中   | 高   | 多层提取策略 + 快速切换到代理模式             |
| LLM 提取准确率不达标          | 低   | 高   | Confidence 阈值 + 人工兜底 + 持续 prompt 优化 |
| 代理池 IP 被批量封禁          | 中   | 中   | 多供应商代理池 + 住宅代理轮换                 |
| 目标网站改版导致提取失败      | 高   | 低   | LLM 语义提取天然抗改版；监控告警及时发现      |
| 法律合规风险                  | 低   | 高   | 仅爬取合作方网站 + 尊重 robots.txt + 法务审查 |
| Railway 平台不稳定            | 低   | 中   | Docker 化部署，可快速迁移至 Fly.io / AWS ECS  |
| LLM API 成本超预期            | 低   | 中   | 模型分级（简单页面用 Haiku，复杂用 Sonnet）   |

---

## 附录 A：技术选型对比

### 爬虫框架对比

| 框架            | 语言           | 优势                       | 劣势                       | 推荐度 |
| --------------- | -------------- | -------------------------- | -------------------------- | ------ |
| **Playwright**  | Node.js/Python | 全能、稳定、Stealth 生态好 | 资源消耗高                 | ★★★★★  |
| Puppeteer       | Node.js        | 生态成熟                   | 仅 Chromium                | ★★★★   |
| Crawlee (Apify) | Node.js        | 内置队列/代理/重试/存储    | 学习曲线                   | ★★★★   |
| Scrapy          | Python         | 性能极佳、生态丰富         | 异步语法与团队技术栈不匹配 | ★★★    |
| Colly           | Go             | 极速                       | 无 JS 渲染                 | ★★     |

**推荐**：**Playwright (Node.js)** — 与现有技术栈（Next.js/TypeScript）一致，团队已有 `@playwright/test` 依赖，学习曲线最低。可考虑引入 Crawlee 作为上层调度框架（内置 RequestQueue + ProxyConfiguration + AutoscaledPool），底层仍用 Playwright。

### LLM 驱动的爬取工具对比（2026 新兴方案）

| 工具                        | GitHub Stars | 类型          | 优势                                        | 劣势                    | 适用场景                |
| --------------------------- | ------------ | ------------- | ------------------------------------------- | ----------------------- | ----------------------- |
| **Firecrawl**               | 81K          | 云服务 + 开源 | LLM-ready Markdown 输出、内置反爬/JS 渲染   | 云版按量收费($0.004/页) | 快速原型 + 中等规模生产 |
| **Crawl4AI**                | 58K          | 本地优先开源  | 完全免费、LLM 提取集成、支持多浏览器        | 需自行部署和维护        | 成本敏感 + 自建基础设施 |
| **Oxylabs Real Estate API** | —            | 商业 API      | 开箱即用房产数据、内置代理+反爬、结构化输出 | $1.30/千次、依赖第三方  | 大规模 + 高可靠性需求   |

**评估结论**：

- **Firecrawl** 最适合作为**快速验证工具** — 可在 Phase 0 用其对比现有 Worker 的提取质量，其 Markdown 输出格式与 LLM 提取完美配合。开源版可自部署消除成本。
- **Crawl4AI** 适合作为**长期替代方案** — 本地部署无 API 成本，但需要额外运维投入。
- **Oxylabs Real Estate API** 适合作为**特定市场的补充数据源** — 对已覆盖的主流平台（Zillow、Realtor.com 等）提供高质量结构化数据，但其覆盖范围可能不包含小型独立 PBSA 运营商。
- **推荐策略**：保持现有 Playwright Worker 为核心自建方案，引入 Firecrawl 作为 benchmark 对照和轻量页面的快速通道。

### LLM 模型对比

| 模型             | 价格 (1K tokens)    | HTML 理解力 | 推荐场景          |
| ---------------- | ------------------- | ----------- | ----------------- |
| Claude Sonnet 4  | ~$0.003 / $0.015    | 优秀        | 默认提取模型      |
| Claude Haiku 4.5 | ~$0.0008 / $0.004   | 良好        | 简单/模板化页面   |
| GPT-4o-mini      | ~$0.00015 / $0.0006 | 良好        | 批量低成本提取    |
| Claude Opus 4    | ~$0.015 / $0.075    | 卓越        | 难提取/高价值页面 |

**推荐**：Claude Sonnet 4 为默认模型，Haiku 4.5 用于简单页面降低成本。

---

## 附录 B：与现有系统集成点

```
无需修改的模块（直接复用）：
  ✅ Extraction Trigger API (src/app/api/extraction/trigger/)
  ✅ Extraction Callback API (src/app/api/extraction/callback/)
  ✅ Data Merge Engine (src/lib/onboarding/data-merge.ts)
  ✅ Scoring Engine (src/lib/onboarding/scoring-engine.ts)
  ✅ Field Schema / Definitions (src/lib/onboarding/field-*.ts)
  ✅ Job Helpers (src/lib/extraction/job-helpers.ts)
  ✅ LLM Client (src/lib/llm/client.ts)

已有 Worker 模块（worker/ 目录，部署于 Fly.io）：
  ✅ worker/src/crawl/site-probe.ts      — 站点类型探测（SPA/WordPress/Platform）
  ✅ worker/src/crawl/scraper.ts          — Playwright 页面爬取（DOM 稳定检测、懒加载）
  ✅ worker/src/crawl/browser.ts          — Chromium 单例管理（3 并发页面信号量）
  ✅ worker/src/extractors/website-crawl.ts — 分层提取（JSON-LD → OG → LLM）
  ✅ worker/src/extractors/structured-data-mapper.ts — JSON-LD 直接映射
  ✅ worker/src/extractors/og-mapper.ts   — OpenGraph 提取
  ✅ worker/src/llm/                      — LLM 多 Provider Fallback
  ✅ worker/src/validators/               — 字段校验
  ✅ worker/Dockerfile + fly.toml         — Fly.io 部署配置

需要增强的模块（在现有 Worker 基础上）：
  🔧 worker/src/crawl/stealth.ts         — Playwright Stealth 插件集成
  🔧 worker/src/proxy/                   — 住宅代理轮换管理
  🔧 worker/src/crawl/multi-page.ts      — 多页面发现和爬取
  🔧 worker/src/queue/                   — BullMQ 任务队列（可选）
  🔧 worker/src/llm/config.ts            — 增加 Claude Sonnet 4 作为 Provider

可能需要小幅修改的模块：
  ⚠️ Extraction Trigger — 可能增加 probe 结果传递
  ⚠️ Building Onboarding UI — 显示提取进度和置信度
```

---

## 结论

### 技术可行性评估：✅ 高度可行（基础设施已就绪）

1. **端到端管线已实现** — 不仅 Trigger/Callback/Merge/Scoring 等主系统基础设施已就位，Worker 层（Site Probe + Playwright Scraper + JSON-LD/OG/LLM 分层提取 + 字段校验）也**已基本建成并部署于 Fly.io**。这大幅缩短了落地周期。
2. **LLM 语义提取是核心优势** — 一套 prompt 覆盖所有网站模板，相比传统选择器爬虫维护成本降低 10 倍以上。现有 Worker 已实现 JSON-LD → OG → LLM 三层降级策略。
3. **关键增强点明确** — 当前 Worker 的主要瓶颈在于：(a) 无代理轮换易被封禁，(b) 无 stealth 模式易被检测，(c) 仅爬首页遗漏大量信息，(d) LLM provider 以中文模型为主需补充英文能力。这些均为**增量改进**而非重新架构。
4. **~90% 的供应商网站可自动提取** — 仅 Enterprise Bot Management 级别的少数聚合平台需要替代方案。
5. **成本可控** — MVP 增强阶段月成本 <$100，规模化运营 <$600，ROI 显著。
6. **法律风险可管理** — 聚焦合作方网站的公开信息，风险可控。

### 建议下一步行动

1. **立即启动 Phase 0** — 用现有 Worker 对 20 个真实供应商网站进行 benchmark，获取基线数据（仅需 1-2 天）
2. **快速增强** — 集成 playwright-stealth + 住宅代理 + Claude Sonnet 4（3 天可完成），预期提取成功率从 ~67% 提升至 ~85%
3. **采购住宅代理服务** — 建议从 Bright Data 或 IPRoyal 的试用套餐开始（$50-100/月即可覆盖 MVP）
4. **准备 20 个标杆供应商** — 涵盖美/英/澳/欧/亚 5 个市场，每市场 4 个（大型连锁 1 + 中型 1 + 小型 WordPress 1 + 特殊模板 1）
5. **多页面爬取（Phase 1 核心）** — 这是提升字段覆盖率的最大杠杆点——从首页的 ~10 个字段扩展到 ~30+ 个字段
