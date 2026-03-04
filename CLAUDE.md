# AI Agent 针对 on.uhomes.com Onboarding 项目的开发规约

> 本文件仅包含**编码规范与行为约束**。系统架构、路由设计、状态机逻辑请参阅 `docs/ARCHITECTURE.md`。

---

## 1. 架构原则

- **框架限制**：强制使用 Next.js App Router（`app/` 目录）。绝不允许使用旧版 Pages Router（`pages/` 目录）。
- **部署策略**：系统整体部署在 Vercel。本系统不直连 uhomes 主站，通过 API 与 `pro` / `crm` 解耦，所有外部服务端请求封装于 `src/lib/api/`。
- **技术栈**：Supabase（PostgreSQL + Auth OTP + RLS）作为唯一数据库与认证方案，不引入其他数据库。

---

## 2. UI 视觉与样式

> 完整设计规范参见 `docs/DESIGN_GUIDELINES.md`（常驻约束，AI Agent 必须遵守）。

- **品牌规范**：只能使用 `src/app/globals.css` 中 `@theme` 块定义的 CSS 变量，**禁止组件内硬编码 hex 色值**。
  - 品牌主色 `primary`：`#FF5A5F`（CTA 按钮、状态强提示）
  - 文本强调色 `text-primary`：`#222222`
- **响应式**：Mobile-First，三断点适配：`< 768px` / `768–1024px` / `> 1024px`。
- **设计哲学**：「温暖专业」（Warm Professional）— 专业但不冰冷、简洁但不空洞、国际化但不泛化。
- **空状态**：禁止只放一行灰色文字。必须包含：视觉元素（图标/插画）+ 说明文字 + 行动指引。
- **等待状态**：必须包含预期时间说明和联系渠道，不能让用户感到被遗忘。
- **微交互**：可交互卡片必须有 hover 上浮 + 阴影反馈，按钮必须有 active 缩放反馈。
- **状态双编码**：所有状态必须同时用颜色和形状/图标表意，不能单靠颜色区分。
- **国际化准备**：
  - 新代码优先使用 CSS 逻辑属性：`ms-*`/`me-*` 代替 `ml-*`/`mr-*`，`text-start`/`text-end` 代替 `text-left`/`text-right`
  - 文本容器不使用固定宽度，为多语言文本扩展预留空间
  - 仅使用文化中性图标（Lucide 抽象概念图标），禁止手势/动物/宗教符号

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

## 8. Git 推送与多仓库同步

本项目同时托管在 **GitHub**（主仓库）和 **GitLab**（内部镜像）。每次执行 `git push` 到 GitHub 后，**必须同步推送到 GitLab**。

### 基础设施区分（三者独立，绝不混淆）

| 服务           | 地址                   | 用途                               | SSH Key                        |
| :------------- | :--------------------- | :--------------------------------- | :----------------------------- |
| **GitHub**     | `github.com`           | 代码主仓库（`origin`）             | `~/.ssh/id_ed25519`            |
| **GitLab**     | `git.uhomes.com:20022` | 内部镜像仓库（`gitlab`），**直连** | `~/.ssh/id_rsa`                |
| **JumpServer** | `jump.uhouzz.net:2222` | 堡垒机 / 部署服务器                | `~/.ssh/id_ed25519_jumpserver` |

> **GitLab 与 JumpServer 无关联**。GitLab SSH 直连，不需要 ProxyJump。JumpServer 仅在部署、运维登录生产服务器时使用。

### Remote 配置

| 名称     | 地址                                                                     |
| :------- | :----------------------------------------------------------------------- |
| `origin` | `https://github.com/yalding8/on.uhomes.com-onboarding-web.git`（GitHub） |
| `gitlab` | `ssh://git@git.uhomes.com:20022/ning_ding/on.uhomes.com.git`（GitLab）   |

如果 `gitlab` remote 尚未配置，先执行：

```bash
git remote add gitlab ssh://git@git.uhomes.com:20022/ning_ding/on.uhomes.com.git
```

### 推送规则

每次向 GitHub 推送代码时，紧接着执行 GitLab 同步：

```bash
# 1. 推送到 GitHub（主仓库）
git push origin <branch>

# 2. 同步到 GitLab（分支 + tags，使用 --no-thin 避免服务端 unpack 失败）
git push gitlab --all --no-thin
git push gitlab --tags
```

> **注意**：两个 push 操作都需要用户确认后才可执行。

## 9. 开发流程规则 (Gated Development Process)

> 参考文档：[[国际化专家设计方案-评审-测试-开发全流程]]

### 9.1 轨道分级

每个任务启动前，先判断轨道：

| 轨道         | 触发条件                                            | 流程            |
| :----------- | :-------------------------------------------------- | :-------------- |
| **Major**    | 新数据库表、新 API 端点、新页面、涉及安全/合规/支付 | 完整 6 阶段流程 |
| **Standard** | 现有功能增强、UI 调整、重构                         | 简化 3 阶段流程 |
| **Hotfix**   | Bug 修复、文案/配置调整                             | 快速通道        |

### 9.2 Major Track — 完整流程（6 阶段）

```
方案设计 → 方案评审 (≥8/10) → 测试用例先行 → 编码实现 → 全量测试 → 上线评审
```

1. **方案设计**：输出包含数据模型变更、用户流程图、技术选型的设计文档
2. **方案评审**：对照以下清单逐项自查，所有维度 ≥ 8/10 方可继续
3. **测试用例先行**：在编码前完成 Unit / Integration / E2E 测试用例设计
4. **编码实现**：代码必须通过已设计的测试用例
5. **全量测试**：新增测试 + 回归测试全部通过
6. **上线评审**：对照上线清单逐项确认

### 9.3 方案评审清单（Major Track 适用）

- [ ] 方案覆盖了国际化场景（至少考虑 US/UK/AU/CA/EU 五个市场）
- [ ] 数据模型变更有向后兼容策略（JSONB 字段需 schema_version）
- [ ] 新增 API 有 Rate Limiting 设计
- [ ] 涉及个人数据的功能有 GDPR 合规设计（含 CCPA/PDPO 等目标市场隐私法）
- [ ] 测试用例覆盖正常/边界/异常三种场景
- [ ] 错误路径有 Sentry 监控告警
- [ ] 新增页面有空状态 + 加载状态 + 错误状态设计
- [ ] 方案文档已更新到 `docs/` 目录

### 9.4 Standard Track — 简化流程（3 阶段）

```
简要方案描述 → 编写核心测试 + 编码 → 自审上线清单
```

1. 用 1-2 段文字描述改动内容和影响范围
2. 编写核心路径测试用例，同步编码实现
3. 对照上线清单自审，确认无遗漏

### 9.5 Hotfix Track — 快速通道

```
直接修复 → 补充/更新测试 → 提交
```

- 修复后必须确保现有测试全部通过
- 如果 fix 涉及之前未覆盖的场景，补充对应测试用例

### 9.6 上线清单（所有轨道通用）

- [ ] `npx vitest run` 全部通过
- [ ] `npx tsc --noEmit` 无错误
- [ ] `npx next build` 构建成功
- [ ] 新增路由/环境变量已同步 `README.md`
- [ ] 数据库变更已有 migration 文件
