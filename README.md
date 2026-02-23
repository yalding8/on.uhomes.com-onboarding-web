# on.uhomes.com Onboarding Platform

面向全球公寓供应商的自助式 B2B Onboarding 前台系统。目标：供应商从签约到房源上架，全程 5 分钟内完成。

## 开发进度

| 阶段 | 内容 | 状态 |
| :--- | :--- | :--- |
| Task 1 | 基础设施：Next.js + Supabase + Vercel 初始化 | ✅ 完成 |
| Task 2 | AI 跨平台规则：AGENTS.md / CLAUDE.md / .kiro/rules.md | ✅ 完成 |
| Task 3 | 双层文档机制：README + docs/ | ✅ 完成 |
| Task 4 | GitHub Actions CI/CD 质量门禁 | ✅ 完成 |
| Task 5 | 品牌设计令牌注入（globals.css @theme） | ✅ 完成 |
| Task 6 | Supabase 建表：applications / suppliers / contracts / buildings | ✅ 完成 |
| Task 7 | Auth 认证 + 路由中间件（三态重定向） | ✅ 完成 |
| Task 8 | P0 核心视图：Landing / Login / Dashboard / ContractViewer | ✅ 完成 |
| Task 9 | 重型微服务：PDF 解析 + Playwright 爬虫 Worker | 🚧 待开发 |
| P1-Core | Building Onboarding Portal：Schema / Scoring / API / Dashboard / 编辑页 | ✅ 完成 |
| P1-AI | AI 多源提取管道 + 数据融合 | 🚧 第二轮 |
| P1-Pub | 内部预览 + 发布到主站 | 🚧 第二轮 |

**当前里程碑**：合同签署全流程（申请 → BD 审批 → 邮件邀请 → OTP 登录 → 合同签署）已在 Supabase 真实环境中联调通过。

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

| 变量名称 | 说明 |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名公钥，用于前端路由态读取 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 管理员 Key，仅限服务端使用 |
| `ADMIN_SECRET` | BD 内部审批接口鉴权密钥，禁止对外暴露 |
| `OPENSIGN_WEBHOOK_SECRET` | OpenSign Webhook 签名验证；本地 Mock 时设为 `TEST_SECRET_MOCK` |

> 每次新增环境变量后，必须同步更新本表。

## 核心页面路由

| 路径 (`src/app/`) | 功能描述 | 访问权限 |
| :--- | :--- | :--- |
| `/` | 供应商招募 Landing Page + 申请表单 | 公开 |
| `/login` | 邮箱 OTP 两步登录 | 公开 |
| `/dashboard` | 供应商控制台：合同签署（PENDING_CONTRACT）/ Building 列表（SIGNED） | 需登录 |
| `/onboarding/[buildingId]` | Building Onboarding 编辑页面：字段编辑、评分、Gap Report | 需登录（SIGNED） |
| `/auth/confirm` | Supabase Auth 邮件回调处理 | 系统内部 |

> 新增或删除路由后，必须同步更新本表。

## API 路由

| 路径 | 方法 | 鉴权方式 | 说明 |
| :--- | :--- | :--- | :--- |
| `/api/apply` | POST | 无（公开） | 供应商提交申请，写入 `applications` 表 |
| `/api/admin/approve-supplier` | POST | `x-admin-secret` Header | BD 审批：创建 supplier + 发邀请邮件 + 生成合同记录 |
| `/api/webhooks/opensign` | POST | `x-opensign-signature` Header | 接收 OpenSign 签署完成回调，更新合同状态 |
| `/api/buildings/[buildingId]/fields` | GET | Supabase Auth Session | 获取 building 字段数据 + 评分 + Gap Report |
| `/api/buildings/[buildingId]/fields` | PATCH | Supabase Auth Session | 更新字段值（乐观锁 + 审计日志） |

## Demo 流程（本地）

```bash
# ① 供应商提交申请
curl -X POST http://localhost:3000/api/apply \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Demo LLC","contact_email":"you@example.com","contact_phone":"+1 555 0000","city":"Toronto","country":"Canada"}'

# ② BD 审批（从 Supabase applications 表获取 application_id）
curl -X POST http://localhost:3000/api/admin/approve-supplier \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: demo-secret" \
  -d '{"application_id":"<uuid>"}'

# ③ 供应商收邮件 → 点链接登录 → /dashboard → 点击 "Sign Contract (Mock)"
```

## 数据库表结构

| 表名 | 说明 |
| :--- | :--- |
| `applications` | 公开申请暂存表，无需 Auth 用户关联 |
| `suppliers` | 已审批的供应商身份表，关联 `auth.users` |
| `contracts` | 合同流转表，支持 OpenSign 签署追踪 |
| `buildings` | 楼宇房源数据表 |
| `building_onboarding_data` | Building Onboarding 字段值 + 乐观锁版本号 |
| `field_audit_logs` | 字段修改审计日志 |
| `extraction_jobs` | AI 提取任务记录 |

## 文档索引

- `docs/ARCHITECTURE.md` — 架构决策与系统交互链路
- `docs/API_REFERENCE.md` — 接口通信规范
- `AGENTS.md` / `CLAUDE.md` — AI 跨工具协作开发规约
