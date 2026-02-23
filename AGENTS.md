# Google Antigravity 针对 on.uhomes.com Onboarding 项目的开发规约

## 1. 架构原则

- **框架限制**：强制使用 Next.js App Router（即 `app/` 目录）。绝不允许使用旧版 Pages Router（`pages/` 目录）。
- **部署策略**：系统整体部署在 Vercel（依赖 Edge Network 与 PR Preview 机制）。本系统不直连 uhomes 主站，通过 API 与 `pro` / `crm` 解耦，所有服务端请求封装于 `src/lib/api/`。

## 2. 数据库与后端选型

- **选型**：Supabase（PostgreSQL + Auth + RLS）。
- **表结构**（当前已建）：
  - `applications`：公开申请暂存表，无需 Auth 用户关联，供 Landing Page 写入
  - `suppliers`：已审批供应商，`user_id` 关联 `auth.users`，状态流：`NEW → PENDING_CONTRACT → SIGNED`
  - `contracts`：合同记录，含 OpenSign 签署追踪字段（`signature_request_id`, `embedded_signing_url`）
  - `buildings`：楼宇房源数据，Task 9 爬虫回写目标
- **Auth 机制**：Supabase OTP 邮件登录。BD 通过 `/api/admin/approve-supplier` 触发 `inviteUserByEmail`，供应商点邮件链接完成首次登录绑定。

## 3. UI 视觉与样式约束

- **品牌规范**：只能使用 `src/app/globals.css` 中 `@theme` 块定义的 CSS 变量，**禁止组件内硬编码 hex 色值**。
  - 品牌主色 `primary`：`#FF5A5F`（CTA 按钮、状态强提示）
  - 文本强调色 `text-primary`：`#222222`
- **响应式**：Mobile-First，三断点适配：`< 768px` / `768–1024px` / `> 1024px`。

## 4. 开发常规约定

- **超限阻断**：单文件超过 300 行，必须先拆分组件或抽取 hook，再添加新逻辑。
- **文档同步**：新增路由或 `.env` 变量，必须在同一 PR 内更新 `README.md` 对应表格。
- **安全检查**：生产代码禁止 `console.log`；全程强类型 TypeScript，禁用 `any`。

## 5. API 路由规范

所有 `/api/*` 路由**豁免**中间件的 Auth 重定向，由路由自身处理鉴权：

| 路由 | 鉴权方式 | 说明 |
| :--- | :--- | :--- |
| `/api/apply` | 无（公开） | 写入 `applications` 表，不得写入 `suppliers` |
| `/api/admin/approve-supplier` | `x-admin-secret` Header | 仅 BD 内部调用 |
| `/api/webhooks/opensign` | `x-opensign-signature` Header | OpenSign 回调，Mock 值为 `TEST_SECRET_MOCK` |

## 6. 中间件路由守卫（三态重定向）

登录用户根据 `suppliers.status` 自动路由：

| 状态 | 行为 |
| :--- | :--- |
| 无 supplier 记录（`NEW`） | 重定向到 `/`（Landing Page） |
| `PENDING_CONTRACT` | 重定向到 `/dashboard` |
| `SIGNED` | 重定向到 `https://pro.uhomes.com` |

未登录用户仅可访问：`/`、`/login`、`/auth/*`、`/api/*`。
