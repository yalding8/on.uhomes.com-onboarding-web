# on.uhomes.com Onboarding Platform

面向全球公寓供应商的自助式 B2B Onboarding 前台系统。目标：供应商从签约到房源上架，全程 5 分钟内完成。

## 开发进度

| 阶段            | 内容                                                                                                       | 状态      |
| :-------------- | :--------------------------------------------------------------------------------------------------------- | :-------- |
| Task 1          | 基础设施：Next.js + Supabase + Vercel 初始化                                                               | ✅ 完成   |
| Task 2          | AI 跨平台规则：AGENTS.md / CLAUDE.md / .kiro/rules.md                                                      | ✅ 完成   |
| Task 3          | 双层文档机制：README + docs/                                                                               | ✅ 完成   |
| Task 4          | GitHub Actions CI/CD 质量门禁                                                                              | ✅ 完成   |
| Task 5          | 品牌设计令牌注入（globals.css @theme）                                                                     | ✅ 完成   |
| Task 6          | Supabase 建表：applications / suppliers / contracts / buildings                                            | ✅ 完成   |
| Task 7          | Auth 认证 + 路由中间件（三态重定向）                                                                       | ✅ 完成   |
| Task 8          | P0 核心视图：Landing / Login / Dashboard                                                                   | ✅ 完成   |
| Task 9          | 重型微服务：PDF 解析 + Playwright 爬虫 Worker                                                              | ✅ 完成   |
| P1-BD           | BD Admin Dashboard：申请列表 / 审批 / 供应商管理 / 手动邀请                                                | ✅ 完成   |
| P1-Core         | Building Onboarding Portal：Schema / Scoring / API / Dashboard / 编辑页                                    | ✅ 完成   |
| P1-Sign         | Online Contract Signing：DocuSign eSignature 集成（替代 Mock OpenSign）                                    | ✅ 完成   |
| P1-i18n         | 全站 UI 英文化：组件文案、API 消息、验证错误、测试断言                                                     | ✅ 完成   |
| P1-Q            | 供应商全流程 P0 质量加固：事务一致性、Webhook 原子性、字段校验、乐观锁                                     | ✅ 完成   |
| P1-AI           | AI 多源提取管道 + 数据融合（纯函数 + API 已完成，待 Worker 联调）                                          | ✅ 完成   |
| P1-UX           | UI/UX 全面审计：Persona 走查 + 设计规范对齐 + ESLint 零警告                                                | ✅ 完成   |
| P2-AI           | 自适应提取管线：site-probe → 分层提取 → LLM fallback → 字段校验 + 基准测试                                 | ✅ 完成   |
| P1-i18n-modules | 国际化模块：GDPR 合规（账户删除/数据导出）、amenity catalog、楼宇图片、BD 领地、供应商徽章                 | ✅ 完成   |
| P2-AI-Bench     | Benchmark 增强：8 站点策略断言 + cheerio/stealth 路径验证 + 对比表格 + 爬取范围规则                        | ✅ 完成   |
| P2-AI-Adaptive  | 自适应进化 Phase 1：LLM 自校验 + 域名经验复用 + 提取遥测 + 分析查询                                        | ✅ 完成   |
| P2-Apps         | Applications 模块重设计：BD 工作台（KPI、搜索防抖、Drawer、认领、备注）                                    | ✅ 完成   |
| P2-Suppliers    | Suppliers 模块重设计：5 阶段 Pipeline 视图、Timeline 7 节点、Next Action、Building 评分卡                  | ✅ 完成   |
| P2-BuildDetail  | Building 详情页：字段级提取视图、来源标记、置信度、ExtractionJobsCard                                      | ✅ 完成   |
| P2-Infra        | Turbopack root 修复 + ref_code 点击复制 + CONVERTING 状态修复                                              | ✅ 完成   |
| P2-SupplierFlow | 供应商流程重设计（G2-G9）：提取时序、OTP 账户、数据源上传、预览、导出、BD 预填                             | ✅ 完成   |
| P2-InviteUX     | Invite 页面重设计：双栏布局、流程步骤条、成功卡片、Tips 面板                                               | ✅ 完成   |
| S1-Audit        | Sprint 1 安全审计：C-01/C-03 修复 + E2E 126 测试 + Playwright 认证体系                                     | ✅ 完成   |
| P1-Pub          | 内部预览 + 发布到主站                                                                                      | 🚧 第二轮 |
| P2-OAuth        | Uhomes OAuth 集成（SSO 登录 + BD 角色自动分配）                                                            | 🚧 开发中 |
| P3-CrawlQ       | 爬虫质量全面提升：四层提取（JSON-LD→OG→CSS→LLM）、扩展链接发现、智能截断、分层 Prompt                      | ✅ 完成   |
| P3-CrawlQ2      | 爬虫提取率提升 Phase 2：多页内容聚合、超时重试、字段 Tier 重分级、field-mapper JSON 修复                   | ✅ 完成   |
| P3-CrawlQ3      | 爬虫提取率提升 Phase 3：Network API 拦截、文本密度 DOM 裁剪、请求屏蔽、Few-Shot Prompt、Zod 验证           | ✅ 完成   |
| P3-CrawlBench   | 全球公寓爬虫训练：58 站点 Benchmark（NYC/JC 为主）、多 LLM Provider Fallback（火山引擎/Kimi/DeepSeek）     | ✅ 完成   |
| P3-ExtractQ     | 提取质量优化：JSON-LD @graph 展开、rawHTML CSS 提取、Platform 规则接通、Geo 推断、正则价格、Amenity 归一化 | ✅ 完成   |

**当前里程碑**：P0-P2 全部完成 + P3 爬虫质量四轮优化完成。58 个公寓网站 Benchmark（最新一轮 2026-03-24）：成功率 84%（49/58），平均 11.9 字段/站（+21% vs 上轮 9.8），TOP 站点可达 19 字段。六层提取管线：JSON-LD → OG → CSS → Geo → LLM → Validate。LLM Fallback 链：火山引擎 DeepSeek V3 → Kimi K2.5 → DeepSeek 官方。218 Vitest 用例 + 126 E2E 用例。提取报告：`docs/extraction-results-2026-03-24.html`。

## 基础设施与选型

- **框架**: Next.js 16.x (App Router + Turbopack)
- **开发语言**: TypeScript（严格模式，禁用 `any`）
- **样式**: React 19 / Tailwind CSS 4
- **表单与校验**: react-hook-form + Zod
- **图标**: lucide-react
- **测试**: Vitest 3 + happy-dom + Testing Library
- **监控**: Sentry（错误告警 + 性能追踪 + Session Replay）
- **部署**: Vercel（主应用）+ Fly.io（Extraction Worker）
- **后端 / 数据库**: Supabase（PostgreSQL + Auth OTP + RLS）
- **AI 提取**: DeepSeek LLM（OpenAI 兼容 API）
- **爬虫**: Playwright（Chromium headless）

## 前置要求

- **Node.js 22 LTS**（项目通过 `.node-version` 锁定，推荐使用 [fnm](https://github.com/Schniz/fnm) 管理版本）
- npm 10+

```bash
# 安装 fnm（如未安装）
brew install fnm

# 自动切换到项目指定的 Node 版本
fnm use
```

> Node 25 与 Vitest 的 DOM 环境（jsdom/happy-dom）存在兼容性问题，会导致测试 worker 卡死。请务必使用 Node 22。

## 快速开始

```bash
# 1. 拷贝环境变量并填入真实 Key
cp .env.example .env.local

# 2. 安装依赖
npm install

# 3. 本地启动（默认 http://localhost:3000）
npm run dev
```

## 环境变量 (.env.local)

| 变量名称                        | 说明                                                  |
| :------------------------------ | :---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 项目 URL                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名公钥，用于前端路由态读取                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase 管理员 Key，仅限服务端使用                   |
| `DOCUSIGN_CLIENT_ID`            | DocuSign Integration Key（Client ID）                 |
| `DOCUSIGN_USER_ID`              | DocuSign User ID，用于 JWT impersonation              |
| `DOCUSIGN_ACCOUNT_ID`           | DocuSign Account ID                                   |
| `DOCUSIGN_PRIVATE_KEY`          | Base64 编码的 RSA 私钥，用于 JWT 认证                 |
| `DOCUSIGN_AUTH_SERVER`          | DocuSign 认证服务器（沙箱：`account-d.docusign.com`） |
| `DOCUSIGN_TEMPLATE_ID`          | DocuSign 合同 PDF 模板 ID                             |
| `DOCUSIGN_WEBHOOK_SECRET`       | DocuSign Webhook HMAC 签名验证密钥                    |
| `RESEND_API_KEY`                | Resend API Key，用于新申请邮件通知（可选）            |
| `EXTRACTION_WORKER_URL`         | Extraction Worker 基础 URL（Fly.io 部署地址）         |
| `UPSTASH_REDIS_REST_URL`        | Upstash Redis REST URL，用于 Rate Limiting（可选）    |
| `UPSTASH_REDIS_REST_TOKEN`      | Upstash Redis REST Token                              |
| `SENTRY_AUTH_TOKEN`             | Sentry Auth Token，用于 CI source map 上传（可选）    |
| `NEXT_PUBLIC_POSTHOG_KEY`       | PostHog API Key，用于前端 Analytics（可选）           |
| `NEXT_PUBLIC_POSTHOG_HOST`      | PostHog API Host（默认 `https://app.posthog.com`）    |
| `CRON_SECRET`                   | Vercel Cron 认证密钥，用于 `/api/cron/cleanup` 鉴权   |

> 每次新增环境变量后，必须同步更新本表。

## Extraction Worker（`worker/`）

独立的 Node.js 微服务，负责从合同 PDF 和楼盘网站自动提取结构化数据。

### 架构

```
主应用 POST /api/extraction/trigger
  → Worker POST /extract（立即返回 202）
  → 后台异步处理（BullMQ 队列 或 直接执行）：
      ① 站点预检 (site-probe) → 生成 SiteProfile（类型/框架/复杂度/CF 级别）
      ② 策略路由：
         - lightweight: 静态站 → cheerio HTTP 提取（跳过 Playwright）
         - standard: SPA/WordPress → Playwright 爬取
         - stealth: CF 保护站 → 反检测浏览器 + 代理
         - skip: CF enterprise/business → 报错，需人工处理
      ③ 六层提取（v3）：
         a. JSON-LD / Schema.org 直接映射（35+ 规则，@graph 自动展开，高置信度）
         b. OpenGraph + Twitter Card 补充（12 字段）
         c. CSS 选择器提取（原始 HTML，mailto:/tel:/microdata/Entrata/RentCafe/AppFolio 平台专用规则）
         d. Geo 推断（TLD→国家、城市→国家、国家→货币、价格符号→货币）
         e. LLM 提取仅针对缺失字段（分层 Prompt + 智能截断）
         f. LLM 自校验（交叉验证 + 置信度调整）
      ④ 多页面爬取 → 扩展链接发现（8 选择器 + fallback）→ 按标签过滤 LLM 调用
      ⑤ 字段校验（规则引擎）→ 修复/降级/移除不合理字段
      ⑥ LLM 自校验 → 交叉验证提取结果，调整置信度（correct↑/suspect↓/wrong✗）
  → Worker POST /api/extraction/callback 回调结果 + ExtractionMeta 遥测
  → 主应用融合数据、更新评分、写入 extraction_logs
```

### 支持的提取源

| Source          | 输入              | 提取方式                                                               |
| :-------------- | :---------------- | :--------------------------------------------------------------------- |
| `contract_pdf`  | Supabase 签名 URL | 下载 PDF → pdf-parse → LLM 提取                                        |
| `website_crawl` | 楼盘网站 URL      | site-probe → cheerio/Playwright → JSON-LD/OG → LLM 分层提取 → 多页合并 |
| `google_sheets` | Google Sheets URL | 🚧 后续迭代                                                            |

### 爬取目标范围

**仅抓取公寓商自有官网**，目标市场以 US/UK/AU/CA 为主。禁止抓取平台类聚合网站（Zillow、Apartments.com、AmberStudent、Student.com 等），这类平台与 uhomes.com 属于同类竞品，不是合作伙伴。

### 管线基准测试（2026-03-24）

使用 `verify-pipeline.ts` 对 58 个真实公寓商官网进行端到端策略路由 + 六层提取测试，结果自动保存至 `worker/tests/benchmarks/results/`。

#### 最新 Benchmark 结果（Full Pipeline，含 LLM）

| 指标         | 数值                                              |
| :----------- | :------------------------------------------------ |
| 测试站点     | 58 个（49 成功，9 失败）                          |
| 平均字段/站  | **11.9**（较上轮 9.8 提升 21%）                   |
| 来源占比     | LLM 50% / JSON-LD 20% / CSS 18% / OG 11% / Geo 1% |
| 策略准确率   | 100%                                              |
| LLM Provider | 火山引擎 DeepSeek V3（主力）                      |

#### 提取质量优化（P3-ExtractQ，7 项）

| 优化项 | 内容                                   | 影响                       |
| :----- | :------------------------------------- | :------------------------- |
| OPT-1  | JSON-LD `@graph` 自动展开（Bug 修复）  | +3-5 字段/站（WordPress）  |
| OPT-2  | CSS 提取器改用原始 HTML（Bug 修复）    | itemprop/href 选择器生效   |
| OPT-3  | Platform 检测→CSS 规则接通（Bug 修复） | Entrata/RentCafe 高置信度  |
| OPT-4  | Country/Currency 地理推断（新能力）    | country 53%→80%            |
| OPT-5  | 正则价格提取（新能力）                 | price_min 12%→40%          |
| OPT-6  | 扩展 CSS 规则 + Amenity 归一化         | application_link/elevator  |
| OPT-7  | LLM 子页面上下文标签优化               | floor_plans/utilities 提升 |

#### 关键字段覆盖率变化

| 字段             | 上轮 | 本轮 | 变化  |
| :--------------- | :--- | :--- | :---- |
| country          | 53%  | 80%  | +27pp |
| city             | ~50% | 85%  | +35pp |
| phone            | ~30% | 75%  | +45pp |
| building_address | ~40% | 73%  | +33pp |
| price_min        | 12%  | ~40% | +28pp |

提取报告：`docs/extraction-results-2026-03-24.html` / `docs/extraction-results-2026-03-24.csv`

### 自适应提取进化（Phase 1）

面向 1000+ 供应商网站规模的自动质量控制和经验积累机制：

#### LLM 自校验

每次提取完成后，用独立 LLM 调用交叉验证提取结果：

- **correct** → 置信度升级（medium → high）
- **suspect** → 置信度降级（high → medium）
- **wrong** → 降到 low 或直接移除
- 非阻断设计：验证失败不影响主提取流程
- 质量指标写入 `extraction_logs`（`llm_validation_quality`/`adjustments`/`removals`）

#### 域名经验复用

同一域名 ≥2 次成功爬取后，后续爬取自动跳过 site-probe 预检，复用历史策略：

- Trigger API 查询 `extraction_logs` 历史数据 → 生成 `DomainHints`
- Worker 收到 hints 后直接使用已知策略，节省 2-8 秒 probe 时间
- 1000+ 站点规模下累积收益显著

#### 提取遥测（ExtractionMeta）

每次爬取产生 20+ 维度的遥测数据，写入 `extraction_logs`：

- 站点分析：site_type / framework / complexity / cloudflare_level
- 策略效果：strategy_used / llm_skipped / llm_provider
- 质量指标：field_coverage_ratio / confidence 分布 / validation_issues
- 性能数据：probe / scrape / llm 各阶段耗时
- LLM 自校验：validation_quality / adjustments / removals

#### 分析查询（`supabase/queries/extraction-analytics.sql`）

7 条预置 SQL 查询用于监控提取质量趋势：

1. 策略效果总览 — 各策略平均覆盖率、字段数、耗时
2. LLM 自校验效果 — 验证质量分布和调整统计
3. 站点类型 × 框架矩阵 — 发现提取薄弱区域
4. 域名 Top-N 排名 — 高价值/低价值域名识别
5. 时间趋势 — 提取质量是否在改善
6. LLM 效果对比 — 跳过 LLM vs 使用 LLM
7. 失败热点 — 高频出错域名

```bash
# 运行管线验证（仅结构化数据，不调用 LLM）
cd worker && npx tsx tests/benchmarks/verify-pipeline.ts

# 完整管线（含 LLM 提取）
cd worker && npx tsx tests/benchmarks/verify-pipeline.ts --with-llm

# 仅测试指定分类
cd worker && npx tsx tests/benchmarks/verify-pipeline.ts --category static

# 测试单个 URL
cd worker && npx tsx tests/benchmarks/verify-pipeline.ts --with-llm https://example.com
```

### Worker 环境变量

| 变量名称                    | 说明                                         |
| :-------------------------- | :------------------------------------------- |
| `PORT`                      | 服务端口（默认 3000）                        |
| `SUPABASE_SERVICE_ROLE_KEY` | 与主应用相同，用于回调认证                   |
| `ANTHROPIC_API_KEY`         | Anthropic API Key（首选 LLM，Claude Sonnet） |
| `DEEPSEEK_API_KEY`          | DeepSeek API Key（备选 LLM）                 |
| `QWEN_API_KEY`              | 通义千问 API Key（备选 LLM）                 |
| `KIMI_API_KEY`              | Kimi (Moonshot) API Key（可选）              |
| `MINIMAX_API_KEY`           | MiniMax API Key（可选）                      |
| `SENTRY_DSN`                | Sentry DSN（可选，未设置则跳过监控）         |
| `PROXY_ENABLED`             | 代理开关（`true`/`false`，默认 `false`）     |
| `PROXY_URL`                 | 代理服务器地址（如 `http://host:port`）      |
| `PROXY_USERNAME`            | 代理用户名（可选）                           |
| `PROXY_PASSWORD`            | 代理密码（可选）                             |
| `REDIS_URL`                 | Redis 连接 URL，启用 BullMQ 队列（可选）     |
| `REDIS_HOST`                | Redis 主机（`REDIS_URL` 未设时的替代方式）   |
| `REDIS_PORT`                | Redis 端口（默认 6379）                      |
| `REDIS_PASSWORD`            | Redis 密码（可选）                           |
| `REDIS_DB`                  | Redis 数据库编号（默认 0）                   |
| `QUEUE_CONCURRENCY`         | BullMQ 并发处理数（默认 3）                  |
| `JOB_TIMEOUT_MS`            | 单任务超时时间（默认 300000 = 5 分钟）       |

### 本地运行

```bash
cd worker
cp .env.example .env  # 填入真实 Key
npm install
npx playwright install chromium
npx tsx src/index.ts   # 启动 Worker（默认 http://localhost:3000）
```

### 部署

Worker 部署在 Fly.io，线上地址：`https://uhomes-extraction-worker.fly.dev`

```bash
cd worker
flyctl deploy          # 部署到 Fly.io
flyctl logs            # 查看日志
flyctl status          # 查看状态
```

## Supabase Storage 配置：`signed-contracts` 存储桶

DocuSign 签署完成后，Webhook 会自动下载已签署 PDF 并上传到 Supabase Storage。需要手动创建存储桶并配置 RLS 策略。

### 1. 创建存储桶

在 Supabase Dashboard → Storage 中创建：

- 名称：`signed-contracts`
- 公开访问：**关闭**（Private bucket）
- 文件大小限制：建议 10MB
- 允许的 MIME 类型：`application/pdf`

或通过 SQL 创建：

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signed-contracts',
  'signed-contracts',
  false,
  10485760,
  ARRAY['application/pdf']
);
```

### 2. 配置 RLS 策略

存储桶为 Private，需要配置 RLS 策略控制访问权限：

```sql
-- 策略 1：允许 service_role 上传文件（Webhook 使用 service_role key 上传）
-- service_role 默认绑定 bypass RLS，无需额外策略

-- 策略 2：供应商只能读取自己的合同文件
-- 文件路径格式：{supplier_id}/{contract_id}.pdf
CREATE POLICY "Suppliers can read own contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signed-contracts'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM public.suppliers
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);
```

### 3. 文件路径规则

| 路径格式                          | 说明                         |
| :-------------------------------- | :--------------------------- |
| `{supplier_id}/{contract_id}.pdf` | Webhook 上传的已签署合同 PDF |

### 4. 注意事项

- Webhook 路由使用 `SUPABASE_SERVICE_ROLE_KEY` 上传文件，绕过 RLS
- 供应商通过 Supabase Client SDK 的 `storage.from('signed-contracts').download()` 下载自己的合同
- BD 管理后台通过 service_role 客户端访问所有文件，无 RLS 限制

## 核心页面路由

| 路径 (`src/app/`)                              | 功能描述                                                            | 访问权限         |
| :--------------------------------------------- | :------------------------------------------------------------------ | :--------------- |
| `/`                                            | 供应商招募 Landing Page + 申请表单                                  | 公开             |
| `/login`                                       | 邮箱 OTP 两步登录                                                   | 公开             |
| `/dashboard`                                   | 供应商控制台：合同签署（PENDING_CONTRACT）/ Building 列表（SIGNED） | 需登录           |
| `/onboarding/[buildingId]`                     | Building Onboarding 编辑页面：字段编辑、评分、Gap Report            | 需登录（SIGNED） |
| `/dashboard/preview/[buildingId]`              | uhomes.com 风格房源预览页：字段展示、缺失占位、完成度评分           | 需登录（SIGNED） |
| `/admin`                                       | BD 管理后台入口（重定向到申请列表）                                 | BD 角色          |
| `/admin/applications`                          | BD 工作台：KPI 卡片 + 搜索 + 状态筛选 + Drawer 详情 + 认领/备注     | BD 角色          |
| `/admin/suppliers`                             | 供应商 Pipeline：5 阶段看板 + KPI + 搜索 + Drawer + Next Action     | BD 角色          |
| `/admin/suppliers/[id]`                        | 供应商详情：Timeline 7 节点 + 合同 + Building 卡片 + 备注           | BD 角色          |
| `/admin/suppliers/[id]/buildings/[buildingId]` | Building 详情：字段级提取视图 + 来源/置信度 + 提取任务状态          | BD 角色          |
| `/admin/contracts/[contractId]/edit`           | 合同编辑页面：字段编辑、PDF 上传、AI 提取                           | BD 角色          |
| `/admin/invite`                                | 手动邀请供应商表单                                                  | BD 角色          |
| `/privacy`                                     | 隐私政策页面                                                        | 公开             |
| `/terms`                                       | 服务条款页面                                                        | 公开             |
| `/auth/confirm`                                | Supabase Auth 邮件回调处理                                          | 系统内部         |

> 新增或删除路由后，必须同步更新本表。

## API 路由

| 路径                                        | 方法     | 鉴权方式                               | 说明                                                         |
| :------------------------------------------ | :------- | :------------------------------------- | :----------------------------------------------------------- |
| `/api/apply`                                | POST     | 无（公开）                             | 供应商提交申请，写入 `applications` 表                       |
| `/api/admin/approve-supplier`               | POST     | Supabase Session（BD 角色）            | BD 审批：创建 supplier + 发邀请邮件 + 生成合同记录           |
| `/api/admin/invite-supplier`                | POST     | Supabase Session（BD 角色）            | BD 手动邀请供应商：创建 Auth 用户 + supplier + 合同          |
| `/api/admin/assign-application-bd`          | POST     | Supabase Session（Admin）              | Admin 分配/更换申请的负责 BD                                 |
| `/api/admin/generate-referral`              | POST     | Supabase Session（BD 角色）            | BD 生成/获取推荐链接码                                       |
| `/api/admin/contracts/[contractId]`         | PUT      | Supabase Session（BD 角色）            | 保存合同动态字段（仅 DRAFT 状态）                            |
| `/api/admin/contracts/[contractId]`         | POST     | Supabase Session（BD 角色）            | 推送审阅（DRAFT → PENDING_REVIEW）                           |
| `/api/contracts/[contractId]/confirm`       | POST     | Supabase Session（供应商）             | 供应商确认签署或请求修改                                     |
| `/api/webhooks/docusign`                    | POST     | HMAC Signature                         | DocuSign 双事件回调：supplier签署触发提取 + 全签完成更新状态 |
| `/api/buildings/[buildingId]/fields`        | GET      | Supabase Auth Session                  | 获取 building 字段数据 + 评分 + Gap Report                   |
| `/api/buildings/[buildingId]/fields`        | PATCH    | Supabase Auth Session                  | 更新字段值（乐观锁 + 审计日志 + 字段值校验）                 |
| `/api/buildings/[buildingId]/images`        | POST     | Supabase Auth Session                  | 上传楼宇图片至 Supabase Storage                              |
| `/api/buildings/[buildingId]/submit`        | POST     | Supabase Auth Session                  | 提交楼宇审核（previewable → ready_to_publish）               |
| `/api/admin/buildings/[id]/status`          | PUT      | Supabase Session（BD 角色）            | 更新楼宇状态 + 状态回滚支持                                  |
| `/api/admin/contracts`                      | GET      | Supabase Session（BD 角色）            | 查询合同列表（筛选、分页）                                   |
| `/api/admin/assign-bd`                      | POST     | Supabase Session（Admin）              | Admin 分配/更换供应商的负责 BD                               |
| `/api/admin/contracts/[contractId]/upload`  | POST     | Supabase Session（BD 角色）            | BD 上传非标准合同 PDF 至 Storage                             |
| `/api/admin/contracts/[contractId]/extract` | POST     | Supabase Session（BD 角色）            | 从已上传 PDF 提取合同字段（LLM 提取）                        |
| `/api/account/delete`                       | POST     | Supabase Session（供应商）             | 请求账户删除（30 天冷却期）                                  |
| `/api/account/cancel-deletion`              | POST     | Supabase Session（供应商）             | 冷却期内取消账户删除                                         |
| `/api/account/export`                       | GET      | Supabase Session（供应商）             | GDPR 数据可移植性：导出全部个人数据                          |
| `/api/admin/contracts/[contractId]/status`  | PATCH    | Supabase Session（BD/Admin）           | 合同状态变更（取消、回滚等）                                 |
| `/api/cron/cleanup`                         | GET      | `Authorization: Bearer` (CRON_SECRET)  | 定时清理：CONVERTING 超时、DocuSign 过期、删除执行           |
| `/api/admin/applications/stats`             | GET      | Supabase Session（BD/Admin）           | 申请 KPI 统计（待处理数、未分配数、转化率）                  |
| `/api/admin/applications/[id]/notes`        | GET/POST | Supabase Session（BD/Admin）           | 申请跟进备注（查看/添加）                                    |
| `/api/admin/applications/[id]/claim`        | POST     | Supabase Session（BD）                 | BD 认领未分配的申请                                          |
| `/api/admin/suppliers/stats`                | GET      | Supabase Session（BD/Admin）           | 供应商 Pipeline KPI 统计（各阶段数量、逾期、均分）           |
| `/api/admin/suppliers/[id]/notes`           | GET/POST | Supabase Session（BD/Admin）           | 供应商跟进备注（查看/添加）                                  |
| `/api/admin/suppliers/[id]/timeline`        | GET      | Supabase Session（BD/Admin）           | 供应商 Onboarding 时间线（7 个里程碑节点）                   |
| `/api/extraction/trigger`                   | POST     | `Authorization: Bearer` (service_role) | 触发多源数据提取（支持 sourceFilter 过滤）                   |
| `/api/extraction/callback`                  | POST     | `Authorization: Bearer` (service_role) | 接收 Worker 提取结果，融合数据并更新评分                     |
| `/api/contracts/[contractId]/preview-pdf`   | GET      | Supabase Session（供应商/BD）          | 合同 PDF 预览：返回已上传 PDF URL 或生成 HTML 预览           |
| `/api/data-sources`                         | GET/POST | Supabase Session（供应商）             | 供应商数据源管理：列表查看 / 提交新数据源（URL/文件上传）    |
| `/api/data-sources/[id]`                    | DELETE   | Supabase Session（供应商）             | 删除待处理的数据源记录（含 Storage 文件清理）                |
| `/api/admin/export/[supplierId]`            | GET      | Supabase Session（BD/Admin）           | 导出供应商数据（JSON/CSV），含楼宇字段、评分、缺失字段       |

## Demo 流程（本地）

```bash
# ① 供应商提交申请
curl -X POST http://localhost:3000/api/apply \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Demo LLC","contact_email":"you@example.com","contact_phone":"+1 555 0000","city":"Toronto","country":"Canada"}'

# ② BD 登录管理后台 → /admin/applications → 点击「审批」按钮
#    （approve-supplier API 已改为 Session 鉴权，不再支持 curl 直接调用）

# ③ 供应商收邮件 → 点链接登录 → /dashboard → 查看合同预览 → 点击 "Sign Contract"
#    → DocuSign 完成签署 → Webhook 回调更新状态 → 跳转 Dashboard 显示楼宇列表
```

## 数据库表结构

| 表名                       | 说明                                              |
| :------------------------- | :------------------------------------------------ |
| `applications`             | 公开申请暂存表，无需 Auth 用户关联                |
| `suppliers`                | 已审批的供应商身份表，关联 `auth.users`           |
| `contracts`                | 合同流转表，支持 DocuSign eSignature 追踪         |
| `buildings`                | 楼宇房源数据表                                    |
| `building_onboarding_data` | Building Onboarding 字段值 + 乐观锁版本号         |
| `field_audit_logs`         | 字段修改审计日志                                  |
| `extraction_jobs`          | AI 提取任务记录                                   |
| `extraction_feedback`      | 提取结果反馈 + 人工修正日志（供管线迭代优化用）   |
| `extraction_logs`          | 提取运行详细日志（性能指标、置信度、策略）        |
| `building_images`          | 楼宇图片记录（分类、质量评分）                    |
| `amenity_catalog`          | 标准化设施定义目录（类别、展示属性）              |
| `building_amenities`       | 楼宇-设施关联表（含置信度评分）                   |
| `bd_territories`           | BD 负责区域分配（国家/城市覆盖）                  |
| `supplier_badges`          | 供应商信任徽章（verified_identity 等）            |
| `consent_records`          | GDPR 合规：用户同意记录（cookies/隐私/条款）      |
| `application_notes`        | 申请跟进备注（BD 协作沟通记录）                   |
| `supplier_notes`           | 供应商跟进备注（BD 协作沟通记录）                 |
| `supplier_data_sources`    | 供应商提交的数据源（Sheets/Dropbox/API/文件上传） |

## 项目结构

```
├── src/                     # 主应用（Next.js App Router）
│   ├── app/                 # 页面路由 + API 路由
│   ├── components/          # UI 组件
│   └── lib/                 # 工具库（API、LLM、Supabase 等）
├── worker/                  # Extraction Worker 微服务
│   ├── src/
│   │   ├── extractors/      # 提取器（website-crawl、css-extractor、og-mapper、structured-data-mapper、sub-page-crawl、geo-inferrer）
│   │   ├── llm/             # LLM 客户端 + Prompt + 字段映射
│   │   ├── pdf/             # PDF 下载与解析
│   │   ├── crawl/           # 爬虫引擎（Playwright + cheerio）+ site-probe + stealth + multi-page
│   │   ├── proxy/           # 代理管理（域名粘性 + 故障报告）
│   │   ├── queue/           # BullMQ 任务队列 + 并发控制 + 重试策略
│   │   ├── validators/      # 提取字段校验器
│   │   └── schema/          # 字段定义（复制自主应用）
│   ├── tests/benchmarks/    # 管线基准测试 + 真实站点 fixture
│   ├── Dockerfile
│   └── fly.toml             # Fly.io 部署配置
├── sentry.server.config.ts  # Sentry 服务端初始化
├── sentry.edge.config.ts    # Sentry Edge 初始化
├── scripts/                 # 质量脚本（check-file-lines.sh）
├── supabase/                # 数据库迁移（20 个）
└── docs/                    # 项目文档（16 篇）
```

## 文档索引

- `docs/ARCHITECTURE.md` — 架构决策与系统交互链路
- `docs/API_REFERENCE.md` — 接口通信规范
- `docs/DESIGN_GUIDELINES.md` — UI 设计规范（温暖专业风格、国际化准备）
- `docs/UI_DESIGN_PLAN.md` — UI 设计方案与迭代计划
- `docs/FULL_FLOW_TEST_GUIDE.md` — **全流程 E2E 测试指南（中英双语，含 AI 提取）**
- `docs/E2E_TEST_GUIDE.md` — P0 供应商签约全流程手动测试指南
- `docs/DOCUSIGN_E2E_TEST_GUIDE.md` — DocuSign 在线签约 E2E 测试指南
- `docs/UAT_TEST_GUIDE.md` / `docs/UAT_TEST_GUIDE_CN.md` — UAT 验收测试指南（英/中）
- `docs/BD_QUICK_START.md` / `docs/BD_QUICK_START_CN.md` — BD 快速入门指南（英/中）
- `docs/USER_GUIDE.md` — **三角色操作指南（Admin / BD / Supplier）**
- `docs/TEST_SUPPLIERS_FEEDBACK.md` — 20 供应商测试反馈与 Bug 修复记录
- `docs/代码质量审核报告.md` — 代码质量审核报告
- `docs/PRD_APPLICATIONS_REDESIGN.md` — Applications 模块重设计 PRD
- `docs/PRD_SUPPLIERS_REDESIGN.md` — Suppliers 模块重设计 PRD
- `docs/ADAPTIVE_EXTRACTION_ROADMAP.md` — 自适应提取管线路线图
- `docs/APARTMENT_SCRAPING_FEASIBILITY.md` — 公寓网站爬取可行性分析
- `docs/SUPPLIER_FLOW_REDESIGN.md` — 供应商流程重设计方案（G2-G9，含 Gate 1 评审记录）
- `docs/DESIGN_CRAWLER_QUALITY_V1.md` — 爬虫质量提升设计方案（9 大根因 + 四层提取 + Gate 1 评审 8.2/10）
- `AGENTS.md` / `CLAUDE.md` — AI 跨工具协作开发规约

---

## 阶段性总结与审计（2026-03-09 更新）

### P1 + P2 阶段完成度

全部核心功能已完成并部署至生产环境，覆盖供应商全生命周期 + BD 管理效率工具：

```
供应商申请 → BD 认领/分配 → 审批 → 合同编辑 → 供应商审阅 → DocuSign 签署 → 自适应提取 → 房源编辑 → 评分与发布
```

### P2 新增功能（2026-03-08 ~ 03-09）

- **Applications BD 工作台**（PR #16）：3 张 KPI 卡片、搜索防抖 300ms、状态 Tab 筛选、BD 认领（原子竞争安全）、Drawer 详情面板、跟进备注系统
- **Suppliers Pipeline 视图**（PR #17）：5 阶段看板（NEW → CONTRACT_IN_PROGRESS → AWAITING_SIGNATURE → SIGNED → LIVE）、Timeline 7 节点、Next Action 提示、Building 评分卡（分数渐变色）
- **Building 字段级详情页**（PR #18）：字段来源标记（contract_pdf/website_crawl/manual）、置信度标签、ExtractionJobsCard
- **Adaptive Extraction Phase 1**（PR #18）：LLM 自校验、域名经验复用、提取遥测 20+ 维度、7 条分析 SQL

### P2-SupplierFlow 新增功能（2026-03-10）

- **提取时序重设计（G2）**：Confirm 触发 website_crawl，DocuSign 签署后仅触发 contract_pdf（`sourceFilter` 参数）
- **OTP 账户供给（G3/G9）**：`createUser` + 合作确认邮件，供应商通过 OTP 魔法链接登录，无密码
- **多数据源上传（G4）**：`supplier_data_sources` 表 + 文件上传 API（50MB 限制、MIME 白名单、UUID 命名）
- **合同 PDF 预览（G5）**：供应商签约前预览合同内容
- **uhomes.com 房源预览（G6）**：主站风格的房源展示页，缺失字段灰色占位 + 完成度评分
- **JSON/CSV 导出（G7）**：BD 导出供应商完整数据用于主站集成
- **BD 邀请预填（G8）**：`contractFields` 参数，预填合同字段并跳过 DRAFT 阶段

### 代码库健康度

| 维度              | 指标                                        |
| :---------------- | :------------------------------------------ |
| 页面 + API 路由   | 46 个（17 页面 + 29 API）                   |
| UI 组件           | 53 个（8 个功能模块）                       |
| 核心库模块        | 8 个子目录、35+ 个模块文件                  |
| 单元测试          | 52 个文件、703 个 Vitest 用例               |
| E2E 测试          | 15 个 spec 文件、126 个测试用例             |
| 数据库表          | 18 个核心表、20 个迁移文件                  |
| ESLint 警告       | 0（src/ + scripts/ + tests/）               |
| TypeScript 错误   | 0                                           |
| 文件行数超限      | 0（全部 ≤ 300 行）                          |
| 硬编码色值        | 0（全部使用 CSS 变量）                      |
| i18n 逻辑属性覆盖 | 100%（无残留 ml-/mr-/text-left/text-right） |

### P1-UX 审计完成内容

基于 `docs/DESIGN_GUIDELINES.md` 执行了三轮 UI/UX 审计：

**第一轮：设计规范对齐（11 个文件、21 处修复）**

- 微交互：所有按钮添加 `active:scale-[0.98]`，BuildingCard 添加 hover 上浮
- 语义色彩：错误/警告状态统一使用 `--color-warning`（避免与品牌红色冲突）
- 空状态三要素：Dashboard 空状态重构为 图标 + 说明 + CTA
- 无障碍：StepIndicator 添加 ARIA progressbar 属性

**第二轮：20 供应商 Persona 走查（9 个文件、18 处修复）**

- 模拟 20 种不同供应商（日本 / 英国 / 阿联酋 / 泰国等）使用全流程
- 修复：Login OTP 重发按钮 + 60s 冷却、ApplicationForm 错误色、ContractDocumentPreview 空状态
- 加固：`/api/apply` 服务端校验全覆盖 + 重复提交拦截（409）

**第三轮：5 BD Persona 走查（10 个文件、15 处修复）**

- 模拟 5 个不同国籍的 BD 使用管理后台全流程
- 修复：Admin 全部错误色语义、表格 i18n 逻辑属性、MobileSidebar 中文硬编码 → 英文

**第四轮：ESLint 零警告 + 安全审计**

- 清除 src/ + scripts/ + tests/integration/ 全部 unused variable 警告
- 删除含硬编码测试密钥的遗留 Mock 组件（ContractViewer.tsx）

### 架构亮点

1. **多角色 RBAC**：supplier / bd / admin / data_team，RLS 行级隔离
2. **合同状态机**：DRAFT → PENDING_REVIEW → CONFIRMED → SENT → SIGNED，转移验证严格
3. **房源状态引擎**：extracting → incomplete → previewable → ready_to_publish → published
4. **乐观锁并发控制**：`building_onboarding_data.version` 防止并发编辑冲突
5. **审计日志**：`field_audit_logs` 完整追踪字段修改历史
6. **数据融合智能**：AI 提取 + 人工输入自动冲突解决，来源透明
7. **多源 LLM 故障转移**：Claude Sonnet → Qwen → DeepSeek → Kimi → MiniMax 按优先级降级
8. **Webhook 安全**：HMAC 签名验证 + 幂等处理
9. **Sentry 全链路监控**：Server/Edge/Client 三端错误自动捕获 + `global-error.tsx` 友好降级 + Middleware 异常防护 + `/monitoring` tunnel 绕过广告拦截
10. **六层提取管线**：site-probe 预检 → 策略路由（lightweight/standard/stealth/skip）→ JSON-LD（@graph 展开）→ OG → CSS（原始 HTML + 平台规则）→ Geo 推断 → LLM 补充 → 自校验，58 站点平均 11.9 字段
11. **站点类型智能识别**：自动检测 SPA/WordPress/物管平台模板/静态站点，按类型选择最优爬取策略
12. **cheerio 轻量提取**：静态站点跳过 Playwright，HTTP + cheerio 直接解析，资源占用降低 90%
13. **BullMQ 任务队列**：Redis 持久化 + 优先级 + 指数退避重试 + 并发控制，无 Redis 时自动回退直接执行
14. **反检测爬取**：Cloudflare 分级检测 + stealth 浏览器上下文 + 域名粘性代理，应对受保护站点
15. **LLM 自校验**：提取后独立 LLM 调用交叉验证结果，自动升降置信度或移除错误字段
16. **域名经验复用**：同一域名多次爬取后跳过 probe，复用已知策略，千站规模节省数小时
17. **提取遥测积累**：每次爬取 20+ 维度写入 extraction_logs，为自适应进化积累数据

### S1-Audit Sprint 1 安全审计（2026-03-11）

基于供应链管理专家组评估报告（综合评分 7.8/10），完成 P0 级修复 + E2E 测试全面覆盖：

**Bug 修复**

- **C-01 合同卡死修复**：DocuSign 成功但 DB 更新失败时，自动重试 3 次（500ms 指数退避）；最终失败则存入 `orphaned_envelope_id` 供人工对账
- **C-03 GDPR 导出补全**：新增 5 张表导出（`application_notes`、`supplier_notes`、`supplier_badges`、`building_images`、`extraction_feedback`）；账户删除同步清理这些表

**E2E 测试体系（19 → 126 tests）**

- **Playwright globalSetup 认证**：通过 Supabase admin `generateLink` + `verifyOtp` 获取真实 session，保存 BD / Supplier 两套 storageState
- **3 个 Playwright project**：`public`（公开页面）、`admin`（BD 认证）、`supplier`（供应商认证）
- **API 安全边界** 15 tests：所有受保护端点拒绝未授权请求
- **Webhook 安全** 4 tests：DocuSign/OpenSign/Extraction 签名验证
- **Auth 保护** 14 tests：所有 admin/supplier 路由重定向 + 公开路由可访问
- **Landing Page** 17 tests：表单校验、API 错误、网络故障、loading 态
- **Login** 18 tests：邮箱格式、OTP 非数字、API 限流、resend、terms 链接
- **Admin 页面** 28 tests：Applications/Suppliers/Invite 结构、交互、响应式
- **Supplier Dashboard** 8 tests：页面加载、JS 无错误、响应式
- **响应式布局** 8 tests：三断点无溢出 + 触摸目标尺寸
- **导航 + 法律页面** 14 tests：跨页跳转、404、Privacy/Terms 完整性

---

## 下一阶段工作计划

### P2 第一优先级：内部预览与发布（P1-Pub）

| 任务         | 描述                                                          | 预估复杂度 |
| :----------- | :------------------------------------------------------------ | :--------- |
| 房源预览页   | 供应商视角的房源公开展示预览，模拟主站效果                    | 中         |
| 发布审核流程 | BD/Data Team 审核 ready_to_publish 房源，确认后标记 published | 中         |
| 主站数据同步 | 通过 API 将 published 房源数据推送至 `pro.uhomes.com`         | 高         |
| 发布状态看板 | Admin 侧查看全部房源发布进度的统计面板                        | 低         |

### P2 第二优先级：运营效率工具

| 任务               | 描述                                                    | 预估复杂度 |
| :----------------- | :------------------------------------------------------ | :--------- |
| Google Sheets 集成 | Extraction Worker 支持从 Google Sheets 批量导入房源数据 | 中         |
| 图片上传与管理     | 房源封面图 + 室内照片上传、裁剪、排序                   | 中         |
| 批量操作           | BD 后台批量审批、批量分配 BD、批量发送邀请              | 中         |
| 邮件通知模板       | 自定义签约提醒、到期预警、数据补充催促邮件              | 低         |

### P2 第三优先级：体验与合规

| 任务         | 描述                                                                    | 预估复杂度 |
| :----------- | :---------------------------------------------------------------------- | :--------- |
| i18n 多语言  | 运行时语言切换（英 / 中 / 日 / 阿拉伯语），CSS 逻辑属性已就绪           | 高         |
| 数据分析面板 | 供应商转化漏斗、签约耗时、数据完整度分布                                | 中         |
| Worker 联调  | 主应用与 Fly.io Extraction Worker 端到端联调测试                        | 中         |
| E2E 自动化   | ~~Playwright E2E 测试覆盖核心流程~~ → **已完成（S1-Audit，126 tests）** | ✅         |
