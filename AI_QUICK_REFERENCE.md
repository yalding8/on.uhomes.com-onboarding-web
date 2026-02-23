# AI 开发快速参考卡 (Quick Reference Card)

## 🚀 核心架构

```
✅ Next.js App Router (app/)
✅ Vercel 部署
✅ Supabase (PostgreSQL + Auth)
✅ src/lib/api/ 统一封装
❌ 禁止 Pages Router
❌ 禁止有状态服务器技术
```

## 🎨 UI 规范

```css
/* 品牌色 - 仅限使用 */
--color-primary: #ff5a5f /* 主要 CTA、状态强提示 */
  --color-text-primary: #222222 /* 主标题文字 */ /* 响应式断点 */ < 768px
  /* Mobile - Mobile-First */ 768-1024px /* Tablet */ > 1024px /* Desktop */ ✅
  使用 globals.css 中的 CSS 变量 ❌ 禁止硬编码颜色值;
```

## 🔒 代码质量

```typescript
✅ 严格 TypeScript（禁止 any）
✅ 完整错误处理（try-catch）
✅ 生产环境禁用 console
✅ 单文件 ≤ 300 行（超限必须拆分）
```

## 📁 目录结构

```
src/
├── app/          # 页面路由 (Next.js App Router)
├── components/   # UI 组件（按功能模块划分）
├── lib/
│   └── api/      # API 请求封装（按业务模块）
└── styles/       # 全局样式
```

## 📝 文档同步

```
新增路由 → 更新 README.md "核心页面路由" 表格
新增环境变量 → 更新 README.md "环境变量" 表格
```

## 🧪 测试要求

```bash
✅ 单元测试（Vitest）
✅ 组件测试
✅ tsc --noEmit（类型检查）
✅ prettier --check .（格式检查）
✅ eslint（代码规范）
```

## 🔐 安全规范

```typescript
✅ 使用 Zod 进行数据验证
✅ 服务端使用 SUPABASE_SERVICE_ROLE_KEY
✅ 客户端使用 NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ 遵循 RLS (Row Level Security)
❌ 禁止在客户端硬编码敏感信息
❌ 禁止使用 dangerouslySetInnerHTML
```

## 📦 Supabase 使用

```typescript
// 客户端组件
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// 服务端组件/Server Actions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // 服务端专用
  { auth: { autoRefreshToken: false, persistSession: false } },
);
```

## 🎯 Commit 规范

```
<type>(<scope>): <subject>

type: feat | fix | docs | style | refactor | test | chore
scope: 可选，影响的模块
subject: 简短描述

示例：
feat(auth): 添加 OTP 邮箱登录功能
fix(dashboard): 修复供应商状态显示错误
docs(readme): 更新环境变量说明
```

## ⚡ 性能优化

```typescript
✅ 使用服务端组件（Server Components）
✅ 图片使用 next/image 优化
✅ 大型组件使用 next/dynamic 动态导入
✅ 合理使用 React.memo / useMemo / useCallback
```

## ♿ 可访问性

```html
✅ 语义化 HTML 标签 ✅ 正确的 label 和 aria 属性 ✅ 键盘导航支持 ✅ 符合 WCAG
2.1 AA 对比度标准
```

## 🌍 国际化

```typescript
✅ 文本提取到翻译文件
✅ 使用模板字符串处理动态内容
✅ 使用 Intl API 处理日期/数字格式
```

## 📊 监控

```typescript
✅ 集成错误监控（如 Sentry）
✅ 性能监控（加载时间、交互性能）
✅ 过滤日志中的敏感信息
```

---

**重要提醒**：

1. 每次 coding 前务必查阅完整版 rules.md
2. AI 生成代码必须经过人工审查
3. 保持文档与代码同步更新
4. 渐进式改进，避免大规模重构

**规则文件位置**：

- Qwen Code: .qwen/rules.md
- Google Antigravity: AGENTS.md
- Claude: CLAUDE.md
- Kiro: .kiro/rules.md
