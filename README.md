# on.uhomes.com Onboarding Platform

本库是一个面向全球公寓供应商的自助式 B2B Onboarding 前台系统。旨在实现供应商合同签署到自动化生成 uhomes 房源展示信息的极速上线。

## 基础设施与选型

- **框架**: Next.js 15+ (App Router)
- **开发语言**: TypeScript
- **状态与样式**: React / Tailwind CSS
- **部署环境**: Vercel
- **后端 / 数据库**: Supabase (PostgreSQL + Auth + Edge Functions) - 提供稳定的邮箱验证码登录、关系型数据表操作及防范篡分的 Row Level Security

## 快速开始

```bash
# 1. 拷贝环境变量示例并填充你的真实 Key
cp .env.example .env.local

# 2. 安装依赖
npm install

# 3. 本地启动服务（默认监听 http://localhost:3000）
npm run dev
```

## 环境变量 (.env.local)

| 变量名称                        | 说明                                          |
| :------------------------------ | :-------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 项目 URL                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名公钥，用于前端读取基础路由态数据 |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase 管理员 Key，仅限服务端安全请求       |

> _注意：每次新增涉及系统环境和应用部署的变量后，必须更新上表。_

## 核心页面路由

本工程采用强约束的 Next.js 约定的路由模式：

| 目录路径 (`src/app/`) | 页面功能描述                                       | 访问权限                           |
| :-------------------- | :------------------------------------------------- | :--------------------------------- |
| `/`                   | 引导展示落地页及获取合作的简易申请表单             | **公开访问** (供新用户触达)        |
| `/login`              | 提供邮箱 OTP (One-Time Password) 验证的登录机制    | **公开访问**                       |
| `/dashboard`          | 基于登录用户的态势数据承载，用于展示当前签约进度等 | **需登录状态（针对处于签约意向）** |

> _注意：添加新的应用端路由后，请第一时间补充修改上方路由表格。_

## 技术栈与设计令牌控制

本项目将使用 `primary (#FF5A5F)` 渲染主核心视觉交互。禁止脱离 `tailwind.config.ts` 设计规范配置非关联的固定 hex 色系。所有移动端和桌面端（分 `< 768px`, `768 - 1024px`, `> 1024px` 断点）共享统一的样式封装。

## 文档索引

- `docs/ARCHITECTURE.md`
- `docs/API_REFERENCE.md`
- `AGENTS.md` / `CLAUDE.md` / `.kiro/rules.md` (AI 跨工具协作约定的执行强规卡点)
