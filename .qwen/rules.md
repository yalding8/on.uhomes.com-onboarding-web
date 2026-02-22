# Qwen Code 针对 on.uhomes.com Onboarding 项目的开发规约

## 1. 架构原则

- **框架限制**：强制使用 Next.js App Router (即 `app/` 目录)。绝不允许使用旧版的 Pages Router (`pages/` 目录)。
- **部署策略**：系统整体部署在 Vercel（依赖 Edge Network 与自动预览功能），不能选用只能在有状态服务器运行的技术。由于业务不直连 uhomes 主站后台，而是与 pro/crm 通过 API 解耦，本项目内的所有服务端请求统一封装于 `src/lib/api/` 中。

## 2. 数据库与后端选型

- **选型**：已确认采用 **Supabase (PostgreSQL + Auth + Edge Functions)**，利用其天然的 OTP 邮箱登录、成熟的 Postgres 能力以及与 Vercel 的高度兼容性。本阶段不需要自己从零搭建 Node.js 后端服务。

## 3. UI 视觉与样式约束

- **品牌规范强制落地**：必须且只能使用 `src/app/globals.css` 中 `@theme` 块内定义的 CSS 变量 中预设的品牌相关设计令牌，**禁止页面组件内硬编码其他十六位颜色或 RGB 颜色。**
  - 品牌主色 `primary`：`#FF5A5F` （使用于主要 CTA，状态强提示等）
  - 文本强调色 `text-primary`：`#222222`
- **响应式 (Responsive Design)**：贯彻 Mobile-First 战略，每个页面或区块必须具有移动端的极佳体验，且提供横跨三个断点的适配策略：`< 768px` (Mobile) / `768 - 1024px` (Tablet) / `> 1024px` (Desktop)。

## 4. 代码质量与安全

- **类型安全**：严格使用 TypeScript，禁止使用 `any` 类型。所有函数、组件、变量必须有明确的类型定义。
- **生产环境安全**：禁止在生产环境代码中使用 `console.log`、`console.error` 等调试语句。如需日志记录，使用统一的日志工具封装。
- **错误处理**：所有异步操作必须有完整的错误处理机制，使用 try-catch 或 .catch() 捕获异常。

## 5. 代码组织与文件管理

- **超限阻断**：单文件超过 300 行时，禁止直接添砖加瓦，必须先剥离复用的 UI 组件或抽取 hook 业务逻辑。
- **组件拆分原则**：
  - 业务逻辑复杂的组件应抽取为独立组件
  - 可复用的 UI 元素应抽取为原子组件
  - 数据获取逻辑应封装在 `src/lib/api/` 或自定义 hooks 中
- **目录结构规范**：
  - `src/app/`：页面级路由（Next.js App Router 约定）
  - `src/components/`：基础无状态 UI 组件（按功能模块划分）
  - `src/lib/`：工具函数库及 `api/` 统一请求封装
  - `src/styles/`：全局样式及响应式断点规则

## 6. 文档同步要求

- **重构预警**：一旦产生页面路由的增删，或者配置了新的 `.env` 变量，需**立即于相同 PR 内更新 `README.md`，保持项目的文档强一致性**。
- **路由表更新**：新增或删除 `src/app/` 下的路由时，必须同步更新 `README.md` 中的"核心页面路由"表格。
- **环境变量更新**：新增 `.env` 变量时，必须同步更新 `README.md` 中的"环境变量"表格。

## 7. 测试与质量保障

- **单元测试**：关键业务逻辑、工具函数、API 封装必须编写单元测试，使用 Vitest 框架。
- **组件测试**：核心业务组件应编写组件测试，确保渲染正确性和交互逻辑。
- **类型检查**：所有代码必须通过 TypeScript 类型检查（`tsc --noEmit`）。
- **代码格式化**：所有代码必须通过 Prettier 格式化（`prettier --check .`）。
- **ESLint 检查**：所有代码必须通过 ESLint 检查（`eslint`）。

## 8. Git 与版本控制

- **Commit 规范**：使用语义化提交信息，格式为：`<type>(<scope>): <subject>`
  - type: feat, fix, docs, style, refactor, test, chore
  - scope: 可选，表示影响的模块或文件
  - subject: 简短描述变更内容
- **分支策略**：采用 GitHub Flow 模型
  - `main` 为保护分支，仅通过 PR 合并
  - 开发在 `feature/*`, `fix/*`, `docs/*` 等分支进行
- **PR 要求**：
  - 必须通过所有 CI 检查（Lint, Type Check, Build）
  - 必须更新相关文档（README.md）
  - 必须有清晰的变更描述

## 9. API 与数据交互规范

- **请求封装**：所有 API 请求必须封装在 `src/lib/api/` 目录下，按业务模块划分文件。
- **错误处理**：API 封装层必须统一处理网络错误、超时、认证失败等情况。
- **数据验证**：使用 Zod 进行请求参数和响应数据的运行时验证。
- **Supabase 使用**：
  - 客户端使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - 服务端使用 `SUPABASE_SERVICE_ROLE_KEY`
  - 严格遵循 RLS (Row Level Security) 策略

## 10. 性能优化

- **代码分割**：大型组件或页面应使用动态导入（`next/dynamic`）进行代码分割。
- **图片优化**：使用 Next.js 的 `next/image` 组件优化图片加载。
- **缓存策略**：合理使用 React.memo、useMemo、useCallback 优化渲染性能。
- **服务端组件**：尽可能使用服务端组件（Server Components）减少客户端 JavaScript 体积。

## 11. 安全规范

- **XSS 防护**：禁止使用 `dangerouslySetInnerHTML`，必须对用户输入进行转义。
- **CSRF 防护**：API 请求必须包含 CSRF token（如适用）。
- **敏感信息**：禁止在客户端代码中硬编码 API Key、密码等敏感信息。
- **权限控制**：所有敏感操作必须进行权限验证，使用 Supabase RLS 或服务端中间件。

## 12. 可访问性 (Accessibility)

- **语义化 HTML**：使用正确的 HTML 语义标签（button, input, label 等）。
- **ARIA 属性**：为复杂交互组件添加适当的 ARIA 属性。
- **键盘导航**：确保所有功能可通过键盘访问。
- **对比度**：确保文本与背景的对比度符合 WCAG 2.1 AA 标准。

## 13. 国际化 (i18n)

- **文本提取**：所有用户可见的文本必须提取到翻译文件中。
- **动态内容**：使用模板字符串处理动态内容的国际化。
- **日期/数字格式**：使用 `Intl` API 或相关库处理日期、数字、货币的本地化格式。

## 14. 监控与日志

- **错误监控**：集成错误监控工具（如 Sentry），捕获未处理的异常。
- **性能监控**：监控关键页面的加载性能和交互性能。
- **日志级别**：区分不同级别的日志（debug, info, warn, error）。
- **敏感信息过滤**：日志中不得包含用户敏感信息（密码、token 等）。

## 15. AI 生成代码的特殊要求

- **代码审查**：AI 生成的代码必须经过人工审查，确保符合项目规范。
- **注释清晰**：复杂逻辑必须添加清晰的注释，说明实现思路和注意事项。
- **测试覆盖**：AI 生成的代码必须包含相应的测试用例。
- **渐进式改进**：避免一次性大规模重构，采用渐进式改进策略。

## 16. 自动化工具

- **规则检查**：使用 `./scripts/check-rules.sh` 检查代码是否符合规则
- **规则同步**：使用 `./scripts/sync-rules.sh` 同步所有 AI 工具的规则文件
- **CI/CD**：所有 PR 必须通过 `.github/workflows/rules-check.yml` 中定义的检查

---

**最后更新时间**：2026-02-22
**维护者**：开发团队
**适用工具**：Qwen Code
**加载方式**：每次开发自动加载（通过 ~/.qwen/QWEN.md 记忆）
