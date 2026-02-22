# Claude Code 针对 on.uhomes.com Onboarding 项目的开发规约

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

## 4. 开发常规约定

- **超限阻断**：单文件超过 300 行时，禁止直接添砖加瓦，必须先剥离复用的 UI 组件或抽取 hook 业务逻辑。
- **重构预警**：一旦产生页面路由的增删，或者配置了新的 `.env` 变量，需**立即于相同 PR 内更新 `README.md`，保持项目的文档强一致性**。
- **安全检查**：不得在生产环境随意提交 console 数据，必须使用强类型的 TS 写法（屏蔽 `any` 操作）。
