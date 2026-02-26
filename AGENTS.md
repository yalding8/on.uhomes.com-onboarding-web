# AI Agent 针对 on.uhomes.com Onboarding 项目的开发规约

> 本文件仅包含**编码规范与行为约束**。系统架构、路由设计、状态机逻辑请参阅 `docs/ARCHITECTURE.md`。

---

## 1. 架构原则

- **框架限制**：强制使用 Next.js App Router（`app/` 目录）。绝不允许使用旧版 Pages Router（`pages/` 目录）。
- **部署策略**：系统整体部署在 Vercel。本系统不直连 uhomes 主站，通过 API 与 `pro` / `crm` 解耦，所有外部服务端请求封装于 `src/lib/api/`。
- **技术栈**：Supabase（PostgreSQL + Auth OTP + RLS）作为唯一数据库与认证方案，不引入其他数据库。

---

## 2. UI 视觉与样式

- **品牌规范**：只能使用 `src/app/globals.css` 中 `@theme` 块定义的 CSS 变量，**禁止组件内硬编码 hex 色值**。
  - 品牌主色 `primary`：`#FF5A5F`（CTA 按钮、状态强提示）
  - 文本强调色 `text-primary`：`#222222`
- **响应式**：Mobile-First，三断点适配：`< 768px` / `768–1024px` / `> 1024px`。

---

## 3. 代码质量

- **类型安全**：严格使用 TypeScript，禁止 `any` 类型。所有函数、组件、变量必须有明确的类型定义。
- **错误处理**：所有异步操作必须用 `try-catch` 或 `.catch()` 捕获异常，不允许未处理的 Promise rejection。
- **日志规范**：
  - 禁止在业务逻辑中使用 `console.log`（调试完毕后必须删除）。
  - 错误日志统一使用 `console.error`，仅限 `catch` 块内，格式：`console.error('[模块名]', error)`。
  - 后续如引入统一 logger（`src/lib/logger.ts`），全部迁移至该工具，届时此规则更新。

---

## 4. 代码组织

- **单一职责**：一个文件只做一件事。当文件中出现多个独立关注点（如既处理数据获取又包含复杂 UI 逻辑）时，必须拆分——**以关注点是否内聚为判断标准，而非机械的行数限制**。经验值：超过 300 行时主动审视是否需要拆分。
- **文档同步**：新增页面路由或 `.env` 变量时，必须在同一 PR 内更新 `README.md` 对应表格。

---

## 5. API 路由鉴权原则

所有 `/api/*` 路由豁免中间件的 Auth 重定向，**由路由自身负责鉴权**。鉴权方式分三类：

| 类型         | 适用场景                              | 实现方式                                       |
| :----------- | :------------------------------------ | :--------------------------------------------- |
| 公开接口     | Landing Page 表单提交等无需登录的操作 | 无鉴权，但做必要的输入校验和写入范围限制       |
| Session 鉴权 | 供应商或 BD 的登录态操作              | 通过 Supabase Session 验证，并校验 `role` 字段 |
| Webhook 签名 | 第三方回调（DocuSign 等）             | HMAC 签名验证，拒绝无效签名请求                |

> 新增 API 路由时，必须在 `docs/ARCHITECTURE.md` 的 API 路由表中补充记录。

---

## 6. 修改前的必要检查

在修改任何现有文件前，先确认：

1. 该文件是否已存在对应的测试文件（`__tests__/`）？如有，修改后需同步更新测试。
2. 修改是否涉及数据库表结构？如有，需评估是否需要新增 Supabase migration。
3. 修改是否影响路由或环境变量？如有，需同步更新 `README.md`。

## 7. 提交前必须通过的本地检查

每次 commit 前，**必须**在本地依次通过以下检查，否则 CI 会失败并触发自动回滚：

```bash
npx prettier --write .   # 格式化所有文件
npx tsc --noEmit         # TypeScript 类型检查
bash scripts/check-file-lines.sh  # 文件行数检查（≤ 300 行）
```

> CI 门禁（Main Branch Guard）运行顺序：Prettier → ESLint → tsc → 行数检查 → Vitest → Build。
> 任意一步失败，后续步骤全部跳过，且会尝试自动 revert。
