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
| Task 9  | 重型微服务：PDF 解析 + Playwright 爬虫 Worker                           | 🚧 待开发 |
| P1-BD   | BD Admin Dashboard：申请列表 / 审批 / 供应商管理 / 手动邀请             | ✅ 完成   |
| P1-Core | Building Onboarding Portal：Schema / Scoring / API / Dashboard / 编辑页 | ✅ 完成   |
| P1-Sign | Online Contract Signing：DocuSign eSignature 集成（替代 Mock OpenSign） | ✅ 完成   |
| P1-i18n | 全站 UI 英文化：组件文案、API 消息、验证错误、测试断言                  | ✅ 完成   |
| P1-Q    | 供应商全流程 P0 质量加固：事务一致性、Webhook 原子性、字段校验、乐观锁  | ✅ 完成   |
| P1-AI   | AI 多源提取管道 + 数据融合（纯函数 + API 已完成，待 Worker 联调）       | ✅ 完成   |
| P1-Pub  | 内部预览 + 发布到主站                                                   | 🚧 第二轮 |

**当前里程碑**：P0 基础设施 + P1-BD 管理后台 + P1-Core Building Onboarding + P1-Sign DocuSign 在线签约 + P1-i18n 全站英文化 + P1-Q 全流程质量加固均已完成。剩余第二轮任务：AI 多源提取管道、内部预览与发布、重型微服务。

## 基础设施与选型

- **框架**: Next.js 16.x (App Router + Turbopack)
- **开发语言**: TypeScript（严格模式，禁用 `any`）
- **样式**: React 19 / Tailwind CSS 4
- **表单与校验**: react-hook-form + Zod
- **图标**: lucide-react
- **测试**: Vitest
- **部署**: Vercel（PR Preview + Edge Network）
- **后端 / 数据库**: Supabase（PostgreSQL + Auth OTP + RLS）

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

| 变量名称                        | 说明                                                       |
| :------------------------------ | :--------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 项目 URL                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名公钥，用于前端路由态读取                      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase 管理员 Key，仅限服务端使用                        |
| `DOCUSIGN_CLIENT_ID`            | DocuSign Integration Key（Client ID）                      |
| `DOCUSIGN_USER_ID`              | DocuSign User ID，用于 JWT impersonation                   |
| `DOCUSIGN_ACCOUNT_ID`           | DocuSign Account ID                                        |
| `DOCUSIGN_PRIVATE_KEY`          | Base64 编码的 RSA 私钥，用于 JWT 认证                      |
| `DOCUSIGN_AUTH_SERVER`          | DocuSign 认证服务器（沙箱：`account-d.docusign.com`）      |
| `DOCUSIGN_TEMPLATE_ID`          | DocuSign 合同 PDF 模板 ID                                  |
| `DOCUSIGN_WEBHOOK_SECRET`       | DocuSign Webhook HMAC 签名验证密钥                         |
| `EXTRACTION_WORKER_URL`         | External Worker 基础 URL（可选，未配置时跳过 Worker 调度） |

> 每次新增环境变量后，必须同步更新本表。

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
| `contracts`                | 合同流转表，支持 OpenSign 签署追踪        |
| `buildings`                | 楼宇房源数据表                            |
| `building_onboarding_data` | Building Onboarding 字段值 + 乐观锁版本号 |
| `field_audit_logs`         | 字段修改审计日志                          |
| `extraction_jobs`          | AI 提取任务记录                           |

## 文档索引

- `docs/ARCHITECTURE.md` — 架构决策与系统交互链路
- `docs/API_REFERENCE.md` — 接口通信规范
- `docs/E2E_TEST_GUIDE.md` — P0 供应商签约全流程 E2E 测试指南
- `docs/DOCUSIGN_E2E_TEST_GUIDE.md` — DocuSign 在线签约 E2E 测试指南
- `AGENTS.md` / `CLAUDE.md` — AI 跨工具协作开发规约
