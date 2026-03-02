# on.uhomes.com Onboarding Platform

面向全球公寓供应商的自助式 B2B Onboarding 前台系统。目标：供应商从签约到房源上架，全程 5 分钟内完成。

## 开发进度

| 阶段    | 内容                                                                    | 状态      |
| :------ | :---------------------------------------------------------------------- | :-------- |
| Task 1  | 基础设施：Next.js + Supabase + Vercel 初始化                            | ✅ 完成   |
| Task 2  | AI 跨平台规则：AGENTS.md / CLAUDE.md / .kiro/rules.md                   | ✅ 完成   |
| Task 3  | 双层文档机制：README + docs/                                            | ✅ 完成   |
| Task 4  | GitHub Actions CI/CD 质量门禁                                           | ✅ 完成   |
| Task 5  | 品牌设计令牌注入（globals.css @theme）                                  | ✅ 完成   |
| Task 6  | Supabase 建表：applications / suppliers / contracts / buildings         | ✅ 完成   |
| Task 7  | Auth 认证 + 路由中间件（三态重定向）                                    | ✅ 完成   |
| Task 8  | P0 核心视图：Landing / Login / Dashboard                                | ✅ 完成   |
| Task 9  | 重型微服务：PDF 解析 + Playwright 爬虫 Worker                           | ✅ 完成   |
| P1-BD   | BD Admin Dashboard：申请列表 / 审批 / 供应商管理 / 手动邀请             | ✅ 完成   |
| P1-Core | Building Onboarding Portal：Schema / Scoring / API / Dashboard / 编辑页 | ✅ 完成   |
| P1-Sign | Online Contract Signing：DocuSign eSignature 集成（替代 Mock OpenSign） | ✅ 完成   |
| P1-i18n | 全站 UI 英文化：组件文案、API 消息、验证错误、测试断言                  | ✅ 完成   |
| P1-Q    | 供应商全流程 P0 质量加固：事务一致性、Webhook 原子性、字段校验、乐观锁  | ✅ 完成   |
| P1-AI   | AI 多源提取管道 + 数据融合（纯函数 + API 已完成，待 Worker 联调）       | ✅ 完成   |
| P1-UX   | UI/UX 全面审计：Persona 走查 + 设计规范对齐 + ESLint 零警告             | ✅ 完成   |
| P1-Pub  | 内部预览 + 发布到主站                                                   | 🚧 第二轮 |

**当前里程碑**：P0 基础设施 + P1 全部核心功能 + UI/UX 审计加固均已完成。下一阶段：P1-Pub 内部预览与发布 → P2 运营工具。

## 基础设施与选型

- **框架**: Next.js 16.x (App Router + Turbopack)
- **开发语言**: TypeScript（严格模式，禁用 `any`）
- **样式**: React 19 / Tailwind CSS 4
- **表单与校验**: react-hook-form + Zod
- **图标**: lucide-react
- **测试**: Vitest 3 + happy-dom + Testing Library
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
| `EXTRACTION_WORKER_URL`         | Extraction Worker 基础 URL（Fly.io 部署地址）         |

> 每次新增环境变量后，必须同步更新本表。

## Extraction Worker（`worker/`）

独立的 Node.js 微服务，负责从合同 PDF 和楼盘网站自动提取结构化数据。

### 架构

```
主应用 POST /api/extraction/trigger
  → Worker POST /extract（立即返回 202）
  → 后台异步处理：PDF 解析 / Playwright 爬虫 → DeepSeek LLM 提取
  → Worker POST /api/extraction/callback 回调结果
  → 主应用融合数据、更新评分
```

### 支持的提取源

| Source          | 输入              | 提取方式                        |
| :-------------- | :---------------- | :------------------------------ |
| `contract_pdf`  | Supabase 签名 URL | 下载 PDF → pdf-parse → LLM 提取 |
| `website_crawl` | 楼盘网站 URL      | Playwright 爬取 → LLM 提取      |
| `google_sheets` | Google Sheets URL | 🚧 后续迭代                     |

### Worker 环境变量

| 变量名称                    | 说明                                   |
| :-------------------------- | :------------------------------------- |
| `PORT`                      | 服务端口（默认 3000）                  |
| `SUPABASE_SERVICE_ROLE_KEY` | 与主应用相同，用于回调认证             |
| `DEEPSEEK_API_KEY`          | DeepSeek API Key                       |
| `QWEN_API_KEY`              | 通义千问 API Key（可选，作为备用 LLM） |
| `JOB_TIMEOUT_MS`            | 单任务超时时间（默认 300000 = 5 分钟） |

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

| 路径 (`src/app/`)          | 功能描述                                                            | 访问权限         |
| :------------------------- | :------------------------------------------------------------------ | :--------------- |
| `/`                        | 供应商招募 Landing Page + 申请表单                                  | 公开             |
| `/login`                   | 邮箱 OTP 两步登录                                                   | 公开             |
| `/dashboard`               | 供应商控制台：合同签署（PENDING_CONTRACT）/ Building 列表（SIGNED） | 需登录           |
| `/onboarding/[buildingId]` | Building Onboarding 编辑页面：字段编辑、评分、Gap Report            | 需登录（SIGNED） |
| `/admin`                   | BD 管理后台入口（重定向到申请列表）                                 | BD 角色          |
| `/admin/applications`      | 供应商申请列表：筛选、审批                                          | BD 角色          |
| `/admin/suppliers`         | 供应商管理列表：状态筛选、楼宇计数                                  | BD 角色          |
| `/admin/suppliers/[id]`    | 供应商详情：基本信息、关联楼宇、合同信息                            | BD 角色          |
| `/admin/invite`            | 手动邀请供应商表单                                                  | BD 角色          |
| `/auth/confirm`            | Supabase Auth 邮件回调处理                                          | 系统内部         |

> 新增或删除路由后，必须同步更新本表。

## API 路由

| 路径                                  | 方法  | 鉴权方式                               | 说明                                                |
| :------------------------------------ | :---- | :------------------------------------- | :-------------------------------------------------- |
| `/api/apply`                          | POST  | 无（公开）                             | 供应商提交申请，写入 `applications` 表              |
| `/api/admin/approve-supplier`         | POST  | Supabase Session（BD 角色）            | BD 审批：创建 supplier + 发邀请邮件 + 生成合同记录  |
| `/api/admin/invite-supplier`          | POST  | Supabase Session（BD 角色）            | BD 手动邀请供应商：创建 Auth 用户 + supplier + 合同 |
| `/api/admin/contracts/[contractId]`   | PUT   | Supabase Session（BD 角色）            | 保存合同动态字段（仅 DRAFT 状态）                   |
| `/api/admin/contracts/[contractId]`   | POST  | Supabase Session（BD 角色）            | 推送审阅（DRAFT → PENDING_REVIEW）                  |
| `/api/contracts/[contractId]/confirm` | POST  | Supabase Session（供应商）             | 供应商确认签署或请求修改                            |
| `/api/webhooks/docusign`              | POST  | HMAC Signature                         | DocuSign 签署完成回调，更新合同 + 供应商状态        |
| `/api/buildings/[buildingId]/fields`  | GET   | Supabase Auth Session                  | 获取 building 字段数据 + 评分 + Gap Report          |
| `/api/buildings/[buildingId]/fields`  | PATCH | Supabase Auth Session                  | 更新字段值（乐观锁 + 审计日志 + 字段值校验）        |
| `/api/buildings/[buildingId]/submit`  | POST  | Supabase Auth Session                  | 提交楼宇审核（previewable → ready_to_publish）      |
| `/api/extraction/trigger`             | POST  | `Authorization: Bearer` (service_role) | 触发多源数据提取，创建 3 个 extraction_jobs         |
| `/api/extraction/callback`            | POST  | `Authorization: Bearer` (service_role) | 接收 Worker 提取结果，融合数据并更新评分            |

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

| 表名                       | 说明                                      |
| :------------------------- | :---------------------------------------- |
| `applications`             | 公开申请暂存表，无需 Auth 用户关联        |
| `suppliers`                | 已审批的供应商身份表，关联 `auth.users`   |
| `contracts`                | 合同流转表，支持 DocuSign eSignature 追踪 |
| `buildings`                | 楼宇房源数据表                            |
| `building_onboarding_data` | Building Onboarding 字段值 + 乐观锁版本号 |
| `field_audit_logs`         | 字段修改审计日志                          |
| `extraction_jobs`          | AI 提取任务记录                           |

## 项目结构

```
├── src/                     # 主应用（Next.js App Router）
│   ├── app/                 # 页面路由 + API 路由
│   ├── components/          # UI 组件
│   └── lib/                 # 工具库（API、LLM、Supabase 等）
├── worker/                  # Extraction Worker 微服务
│   ├── src/
│   │   ├── extractors/      # 提取器（contract-pdf、website-crawl）
│   │   ├── llm/             # LLM 客户端 + Prompt + 字段映射
│   │   ├── pdf/             # PDF 下载与解析
│   │   ├── crawl/           # Playwright 浏览器管理 + 爬虫
│   │   └── schema/          # 字段定义（复制自主应用）
│   ├── Dockerfile
│   └── fly.toml             # Fly.io 部署配置
├── supabase/                # 数据库迁移
└── docs/                    # 项目文档
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
- `AGENTS.md` / `CLAUDE.md` — AI 跨工具协作开发规约

---

## 阶段性总结与审计（2026-03-02）

### P1 阶段完成度

P1 阶段全部核心功能已完成并部署至生产环境，覆盖供应商全生命周期：

```
供应商申请 → BD 审批 → 合同编辑 → 供应商审阅 → DocuSign 签署 → 房源编辑 → 评分与发布
```

### 代码库健康度

| 维度              | 指标                                        |
| :---------------- | :------------------------------------------ |
| 页面 + API 路由   | 31 个（15 页面 + 16 API）                   |
| UI 组件           | 43 个（6 个功能模块）                       |
| 核心库模块        | 8 个子目录、30+ 个模块文件                  |
| 单元测试          | 21 个文件、358 个测试用例                   |
| 数据库表          | 7 个核心表、9 个迁移文件                    |
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
7. **多源 LLM 故障转移**：Qwen → DeepSeek → Kimi → MiniMax 按优先级降级
8. **Webhook 安全**：HMAC 签名验证 + 幂等处理

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

| 任务         | 描述                                                          | 预估复杂度 |
| :----------- | :------------------------------------------------------------ | :--------- |
| i18n 多语言  | 运行时语言切换（英 / 中 / 日 / 阿拉伯语），CSS 逻辑属性已就绪 | 高         |
| 数据分析面板 | 供应商转化漏斗、签约耗时、数据完整度分布                      | 中         |
| Worker 联调  | 主应用与 Fly.io Extraction Worker 端到端联调测试              | 中         |
| E2E 自动化   | Playwright E2E 测试覆盖核心签约流程，集成到 CI                | 高         |
