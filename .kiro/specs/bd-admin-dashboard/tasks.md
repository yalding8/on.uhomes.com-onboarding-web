# 实现计划：BD Admin Dashboard

## 概述

基于现有 Next.js App Router + Supabase 技术栈，为 BD 人员构建可视化管理后台。采用增量实现策略：先搭建鉴权和路由基础，再逐步实现各功能页面。

## 任务

- [x] 1. 中间件扩展与 BD 鉴权基础
  - [x] 1.1 扩展中间件支持 BD 角色路由
    - 修改 `src/lib/supabase/middleware.ts`，查询 `role` 和 `status` 字段
    - BD 用户（role='bd'）访问非 /admin 路径时重定向到 `/admin`
    - 非 BD 用户访问 `/admin/*` 路径时重定向到 `/dashboard`
    - 未认证用户访问 `/admin/*` 路径时重定向到 `/login`
    - 保持原有三态路由逻辑不变
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]\* 1.2 编写中间件路由属性测试
    - **Property 1: BD 用户路由到 /admin**
    - **Property 2: 非 BD 用户无法访问 /admin**
    - **Validates: Requirements 1.1, 1.3, 1.4**

  - [x] 1.3 创建 BD 鉴权辅助函数
    - 创建 `src/lib/admin/auth.ts`，实现 `verifyBdRole()` 函数
    - 从 cookie 获取 session，查询 suppliers 表验证 role='bd'
    - 返回用户信息或 403 Response
    - _Requirements: 7.2, 7.3_

  - [ ]\* 1.4 编写 BD 鉴权属性测试
    - **Property 12: BD API 鉴权**
    - **Validates: Requirements 7.2, 7.3**

- [x] 2. Admin 布局与导航
  - [x] 2.1 创建 Admin Layout
    - 创建 `src/app/admin/layout.tsx`（Server Component）
    - 验证用户身份和 BD 角色（双重保障）
    - 渲染顶部栏（BD 邮箱 + 登出按钮）和侧边栏容器
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 创建侧边栏导航组件
    - 创建 `src/components/admin/Sidebar.tsx`（Client Component）
    - 导航菜单项：申请列表、供应商列表、邀请供应商
    - 高亮当前活跃路由
    - 移动端（<768px）折叠为汉堡菜单
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 2.3 创建 Admin 首页重定向
    - 创建 `src/app/admin/page.tsx`，重定向到 `/admin/applications`
    - _Requirements: 2.1_

- [x] 3. Checkpoint - 确保布局和路由基础正常
  - 确保所有测试通过，如有问题请告知。

- [x] 4. 申请列表功能
  - [x] 4.1 创建申请列表页面
    - 创建 `src/app/admin/applications/page.tsx`（Server Component）
    - 使用 Supabase Admin Client 查询 applications 表
    - 按 created_at 倒序排列
    - 展示所有字段：公司名称、联系邮箱、联系电话、城市、国家、网站、状态、提交时间
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 4.2 创建申请列表客户端组件（含筛选）
    - 创建 `src/components/admin/ApplicationList.tsx`（Client Component）
    - 实现状态筛选（PENDING / CONVERTED / REJECTED）
    - 状态标签使用不同颜色区分
    - _Requirements: 3.3_

  - [ ]\* 4.3 编写申请列表筛选与排序属性测试
    - **Property 3: 申请列表筛选正确性**
    - **Property 4: 申请列表排序正确性**
    - **Validates: Requirements 3.1, 3.3, 3.4**

- [x] 5. 审批供应商功能
  - [x] 5.1 重构审批 API 为 Session 鉴权
    - 修改 `src/app/api/admin/approve-supplier/route.ts`
    - 从 `x-admin-secret` Header 鉴权改为调用 `verifyBdRole()` Session 鉴权
    - 保持核心业务逻辑不变（创建 Auth 用户、suppliers、contracts、更新 application）
    - 增加非 PENDING 状态检查
    - _Requirements: 4.2, 4.5, 7.2_

  - [x] 5.2 创建审批确认对话框组件
    - 创建 `src/components/admin/ApproveDialog.tsx`（Client Component）
    - 展示申请详情和合同类型选择
    - 确认/取消按钮，loading 状态防止重复提交
    - 非 PENDING 状态的申请禁用审批按钮
    - _Requirements: 4.1, 4.3, 4.5_

  - [x] 5.3 将审批对话框集成到申请列表
    - 在 `ApplicationList.tsx` 中集成 ApproveDialog
    - 点击审批按钮打开对话框，确认后调用 API
    - 成功后刷新列表，失败显示错误信息
    - _Requirements: 4.1, 4.3, 4.4_

  - [ ]\* 5.4 编写审批流程属性测试
    - **Property 6: 供应商创建流程一致性**
    - **Property 7: 审批失败保持原始状态**
    - **Property 8: 非 PENDING 申请不可审批**
    - **Validates: Requirements 4.2, 4.4, 4.5**

- [x] 6. Checkpoint - 确保申请列表和审批功能正常
  - 确保所有测试通过，如有问题请告知。

- [x] 7. 供应商列表与详情
  - [x] 7.1 创建供应商列表页面
    - 创建 `src/app/admin/suppliers/page.tsx`（Server Component）
    - 查询 suppliers 表（role='supplier'），聚合楼宇数量
    - 展示字段：公司名称、联系邮箱、入驻状态、楼宇数量、创建时间
    - 点击行导航到详情页
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 7.2 创建供应商列表客户端组件（含筛选）
    - 创建 `src/components/admin/SupplierList.tsx`（Client Component）
    - 实现状态筛选（NEW / PENDING_CONTRACT / SIGNED）
    - _Requirements: 5.3_

  - [ ]\* 7.3 编写供应商列表属性测试
    - **Property 9: 供应商列表仅含 supplier 角色**
    - **Property 10: 供应商状态筛选正确性**
    - **Property 5: 记录渲染完整性**
    - **Validates: Requirements 5.1, 5.2, 5.3, 3.2**

  - [x] 7.4 创建供应商详情页面
    - 创建 `src/app/admin/suppliers/[id]/page.tsx`（Server Component）
    - 查询供应商基本信息、关联楼宇列表、合同信息
    - 空楼宇时显示空状态提示
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]\* 7.5 编写供应商详情属性测试
    - **Property 11: 供应商详情数据完整性**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 8. 手动邀请供应商功能
  - [x] 8.1 创建邀请 API
    - 创建 `src/app/api/admin/invite-supplier/route.ts`
    - 使用 `verifyBdRole()` 鉴权
    - 验证必填字段和邮箱格式
    - 检查邮箱是否已存在于 suppliers 表
    - 执行：inviteUserByEmail → 插入 suppliers → 插入 contracts
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 8.2 创建邀请表单页面和组件
    - 创建 `src/app/admin/invite/page.tsx`（Server Component 容器）
    - 创建 `src/components/admin/InviteForm.tsx`（Client Component）
    - 表单字段：邮箱（必填）、公司名称（必填）、电话（选填）、城市（选填）、网站（选填）
    - 前端验证 + 提交后显示成功/错误提示
    - _Requirements: 8.1, 8.2, 8.5_

  - [ ]\* 8.3 编写邀请功能属性测试
    - **Property 13: 邀请表单验证**
    - **Property 14: 重复邮箱邀请拒绝**
    - **Validates: Requirements 8.2, 8.4**

- [x] 9. Final Checkpoint - 全部功能集成验证
  - 确保所有测试通过，如有问题请告知。

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号，确保可追溯性
- Checkpoint 任务用于增量验证，确保每个阶段的功能正常
- 属性测试使用 fast-check 库，每个属性至少运行 100 次迭代
- 单元测试验证具体示例和边界情况
