# 需求文档：BD Admin Dashboard

## 简介

BD Admin Dashboard 是 on.uhomes.com Onboarding 系统的后台管理界面，供异乡好居商务拓展（BD）人员使用。当前 BD 操作依赖 curl 命令调用 API，无法持续运营。本功能提供一个可视化管理界面，使 BD 能够高效邀请供应商、查看申请、管理合同、追踪入驻进度。

## 术语表

- **BD**：Business Development，异乡好居的商务拓展人员，负责邀请供应商、协助入驻
- **Supplier（供应商）**：在平台上注册并管理房源的合作方
- **Application（申请）**：通过 Landing Page 提交的供应商入驻申请记录，存储于 `applications` 表
- **Admin_Dashboard**：BD 专属的后台管理界面，路由为 `/admin`
- **Middleware（中间件）**：Next.js 请求拦截层，负责根据用户角色和状态进行路由守卫
- **OTP**：One-Time Password，一次性验证码，用于邮箱登录认证
- **Onboarding_Status（入驻状态）**：供应商的入驻流程状态，包括 NEW、PENDING_CONTRACT、SIGNED
- **Supabase_Admin_Client**：使用 Service Role Key 创建的 Supabase 客户端，拥有绕过 RLS 的管理员权限

## 需求

### 需求 1：BD 角色路由守卫

**用户故事：** 作为 BD 人员，我希望登录后自动跳转到管理后台，以便快速进入工作界面。

#### 验收标准

1. WHEN 一个 `role='bd'` 的用户登录成功，THE Middleware SHALL 将该用户重定向到 `/admin` 路由
2. WHEN 一个 `role='bd'` 的用户访问 `/dashboard` 或 `/` 页面，THE Middleware SHALL 将该用户重定向到 `/admin`
3. WHEN 一个 `role='supplier'` 的用户访问 `/admin` 路由，THE Middleware SHALL 将该用户重定向到 `/dashboard`
4. WHEN 一个未认证用户访问 `/admin` 路由，THE Middleware SHALL 将该用户重定向到 `/login`
5. WHEN Middleware 查询用户角色时，THE Middleware SHALL 从 `suppliers` 表查询 `role` 和 `status` 字段，使用 `user_id` 匹配当前认证用户

### 需求 2：BD 管理后台布局

**用户故事：** 作为 BD 人员，我希望有一个清晰的管理界面布局，以便高效导航各功能模块。

#### 验收标准

1. THE Admin_Dashboard SHALL 提供侧边栏导航，包含以下菜单项：申请列表、供应商列表、合同管理
2. THE Admin_Dashboard SHALL 在页面顶部显示当前登录 BD 的邮箱和登出按钮
3. THE Admin_Dashboard SHALL 遵循 Mobile-First 响应式设计，适配三个断点：小于 768px、768-1024px、大于 1024px
4. WHILE 屏幕宽度小于 768px，THE Admin_Dashboard SHALL 将侧边栏折叠为汉堡菜单

### 需求 3：查看申请列表

**用户故事：** 作为 BD 人员，我希望查看所有通过 Landing Page 提交的供应商申请，以便筛选和处理潜在合作方。

#### 验收标准

1. WHEN BD 访问申请列表页面，THE Admin_Dashboard SHALL 从 `applications` 表加载并展示所有申请记录
2. THE Admin_Dashboard SHALL 为每条申请展示以下字段：公司名称、联系邮箱、联系电话、城市、国家、网站、状态、提交时间
3. WHEN BD 点击筛选条件，THE Admin_Dashboard SHALL 支持按申请状态（PENDING / CONVERTED / REJECTED）筛选申请列表
4. THE Admin_Dashboard SHALL 按提交时间倒序排列申请记录

### 需求 4：审批供应商（邀请入驻）

**用户故事：** 作为 BD 人员，我希望通过可视化界面审批申请并邀请供应商入驻，以替代当前的 curl 命令操作。

#### 验收标准

1. WHEN BD 在申请列表中点击一条 PENDING 状态的申请的"审批"按钮，THE Admin_Dashboard SHALL 显示审批确认对话框，包含申请详情和合同类型选择
2. WHEN BD 确认审批操作，THE Admin_Dashboard SHALL 调用后端 API 执行以下操作：通过 `inviteUserByEmail` 创建 Auth 用户、在 `suppliers` 表创建记录（状态为 PENDING_CONTRACT）、在 `contracts` 表创建合同记录、将申请状态更新为 CONVERTED
3. WHEN 审批操作成功完成，THE Admin_Dashboard SHALL 显示成功提示并刷新申请列表
4. IF 审批操作失败，THEN THE Admin_Dashboard SHALL 显示具体错误信息，保持申请原始状态不变
5. WHEN BD 尝试审批一条非 PENDING 状态的申请，THE Admin_Dashboard SHALL 禁用审批按钮并显示当前状态标签

### 需求 5：查看供应商列表

**用户故事：** 作为 BD 人员，我希望查看所有已审批供应商的状态和入驻进度，以便追踪和管理合作关系。

#### 验收标准

1. WHEN BD 访问供应商列表页面，THE Admin_Dashboard SHALL 从 `suppliers` 表加载并展示所有 `role='supplier'` 的记录
2. THE Admin_Dashboard SHALL 为每个供应商展示以下字段：公司名称、联系邮箱、入驻状态（NEW / PENDING_CONTRACT / SIGNED）、关联楼宇数量、创建时间
3. WHEN BD 点击筛选条件，THE Admin_Dashboard SHALL 支持按入驻状态筛选供应商列表
4. WHEN BD 点击某个供应商行，THE Admin_Dashboard SHALL 导航到该供应商的详情页面

### 需求 6：查看供应商详情

**用户故事：** 作为 BD 人员，我希望查看单个供应商的完整信息，包括其楼宇和合同状态，以便全面了解入驻进展。

#### 验收标准

1. WHEN BD 访问供应商详情页面，THE Admin_Dashboard SHALL 展示供应商基本信息：公司名称、联系邮箱、角色、入驻状态、创建时间
2. WHEN BD 访问供应商详情页面，THE Admin_Dashboard SHALL 展示该供应商关联的所有楼宇列表，包含楼宇名称、地址、入驻状态、评分
3. WHEN BD 访问供应商详情页面，THE Admin_Dashboard SHALL 展示该供应商的合同信息，包含合同状态、签署链接状态、创建时间
4. IF 供应商没有关联楼宇，THEN THE Admin_Dashboard SHALL 显示空状态提示信息

### 需求 7：BD 认证与权限

**用户故事：** 作为系统管理员，我希望 BD 使用现有 OTP 登录机制认证，并确保只有 BD 角色能访问管理后台。

#### 验收标准

1. THE Admin_Dashboard SHALL 复用现有的 OTP 邮箱登录流程进行 BD 认证
2. WHEN BD 管理后台的 API 路由收到请求，THE API SHALL 验证当前用户的 `role` 为 `bd`，拒绝非 BD 角色的访问
3. IF 一个非 BD 角色的用户尝试调用 BD 管理 API，THEN THE API SHALL 返回 403 Forbidden 响应
4. THE Admin_Dashboard SHALL 使用 Supabase_Admin_Client（Service Role Key）执行需要绕过 RLS 的管理操作

### 需求 8：BD 手动邀请供应商

**用户故事：** 作为 BD 人员，我希望能直接输入供应商信息并发送邀请，以便主动拓展合作方（不依赖 Landing Page 申请）。

#### 验收标准

1. WHEN BD 点击"邀请供应商"按钮，THE Admin_Dashboard SHALL 显示邀请表单，包含以下字段：联系邮箱（必填）、公司名称（必填）、联系电话（选填）、城市（选填）、网站（选填）
2. WHEN BD 提交邀请表单，THE Admin_Dashboard SHALL 验证必填字段非空且邮箱格式合法
3. WHEN 表单验证通过，THE Admin_Dashboard SHALL 调用后端 API 执行：通过 `inviteUserByEmail` 创建 Auth 用户、在 `suppliers` 表创建记录（状态为 PENDING_CONTRACT）、在 `contracts` 表创建合同记录
4. IF 邀请的邮箱已存在于 `suppliers` 表，THEN THE Admin_Dashboard SHALL 显示错误提示"该邮箱已注册为供应商"
5. WHEN 邀请操作成功，THE Admin_Dashboard SHALL 显示成功提示并清空表单
