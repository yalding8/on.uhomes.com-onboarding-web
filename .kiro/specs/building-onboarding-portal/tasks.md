# Implementation Plan: Building Onboarding Portal

## Overview

基于设计文档，将 building onboarding portal 拆分为渐进式的编码任务。从数据模型和核心纯函数开始，逐步构建 API 层和前端页面，确保每一步都可验证。

## Tasks

- [x] 1. 数据库 Schema 扩展与 Field Schema 定义
  - [x] 1.1 创建数据库迁移文件
    - 在 `supabase/migrations/` 下新增迁移文件
    - 扩展 `buildings` 表：添加 `onboarding_status` 列
    - 扩展 `suppliers` 表：添加 `role` 列
    - 创建 `building_onboarding_data` 表（含 `field_values` jsonb、`version` 乐观锁）
    - 创建 `field_audit_logs` 表
    - 创建 `extraction_jobs` 表
    - 配置 RLS 策略（Supplier 只读写自己的、BD/Data Team 读写全部）
    - 添加 `updated_at` 触发器
    - _Requirements: 8.1, 8.4, 9.1, 9.2, 9.3_

  - [x] 1.2 定义 Field Schema 配置
    - 创建 `src/lib/onboarding/field-schema.ts`
    - 定义 `FieldCategory`、`FieldType`、`ExtractTier`、`FieldDefinition` 类型
    - 基于 CSV 数据需求定义完整的 `FIELD_SCHEMA` 常量数组，覆盖 10 个分类的所有字段
    - 每个字段包含 key、label、category、type、weight (1-10)、extractTier (A/B/C)、required
    - 导出 `getFieldsByCategory()`、`getRequiredFields()`、`getTotalWeight()` 工具函数
    - _Requirements: 2.1_

  - [ ]\* 1.3 编写 Field Schema 属性测试
    - **Property 4: Field Schema 结构完整性**
    - **Validates: Requirements 2.1**

- [x] 2. Scoring Engine 与 Gap Report 核心模块
  - [x] 2.1 实现 Scoring Engine
    - 创建 `src/lib/onboarding/scoring-engine.ts`
    - 实现 `calculateScore(fieldSchema, fieldValues): ScoreResult`
    - 公式：`round(filledWeight / totalWeight * 100)`
    - 返回 score、totalWeight、filledWeight、missingFields、fieldDetails
    - _Requirements: 4.1, 4.3_

  - [ ]\* 2.2 编写 Scoring Engine 属性测试
    - **Property 8: 评分计算正确性**
    - **Validates: Requirements 4.1, 4.3**

  - [x] 2.3 实现 Gap Report 生成器
    - 创建 `src/lib/onboarding/gap-report.ts`
    - 实现 `generateGapReport(fieldSchema, fieldValues): GapReport`
    - 缺失字段按 category 分组，suggestion 根据 extractTier 映射（C→需手动填写, B→需确认, A→可自动提取）
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ]\* 2.4 编写 Gap Report 属性测试
    - **Property 5: Gap Report 正确性**
    - **Validates: Requirements 2.2, 2.3, 2.4**

  - [x] 2.5 实现状态阈值转换逻辑
    - 创建 `src/lib/onboarding/status-engine.ts`
    - 实现 `resolveStatus(currentStatus, oldScore, newScore): BuildingStatus`
    - 处理 80 分阈值的双向转换：<80→≥80 = previewable，≥80→<80 = incomplete
    - _Requirements: 4.4, 4.5_

  - [ ]\* 2.6 编写状态阈值转换属性测试
    - **Property 9: 状态阈值双向转换**
    - **Validates: Requirements 4.4, 4.5**

- [x] 3. Checkpoint — 核心纯函数验证
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. 数据融合与提取管道 _(第二轮：依赖 External Worker)_
  - [ ] 4.1 实现多源数据融合模块
    - 创建 `src/lib/onboarding/data-merge.ts`
    - 实现 `mergeExtractionResults(results: ExtractionResult[]): Record<string, FieldValue>`
    - 优先级：contract_pdf > google_sheets > website_crawl
    - 每个字段携带 source、confidence 元数据
    - 冲突字段保留所有来源值
    - _Requirements: 1.6, 1.7_

  - [ ]\* 4.2 编写数据融合属性测试
    - **Property 3: 多源数据融合优先级与来源追踪**
    - **Validates: Requirements 1.6, 1.7**

  - [ ] 4.3 实现异步补充保护逻辑
    - 在 `data-merge.ts` 中添加 `mergeWithProtection(existing, incoming): Record<string, FieldValue>`
    - 已确认字段（confirmedBy 不为空）不被覆盖
    - _Requirements: 8.3_

  - [ ]\* 4.4 编写异步补充保护属性测试
    - **Property 12: 异步补充保护已确认字段**
    - **Validates: Requirements 8.3**

  - [ ] 4.5 实现提取触发 API
    - 创建 `src/app/api/extraction/trigger/route.ts`
    - POST 接口：接收 buildingId、supplierId、contractPdfUrl、websiteUrl、googleSheetsUrl
    - 创建 3 个 extraction_jobs 记录（pending 状态）
    - 向 External Worker 发送 HTTP 请求触发提取（使用 service_role key 鉴权）
    - _Requirements: 1.1_

  - [ ] 4.6 实现提取回调 API
    - 创建 `src/app/api/extraction/callback/route.ts`
    - POST 接口：接收 External Worker 的提取结果
    - 验证请求签名（service_role key）
    - 调用 mergeWithProtection 合并数据到 building_onboarding_data
    - 更新 extraction_job 状态
    - 重新计算 Quality Score 并更新 building 状态
    - 写入 field_audit_logs
    - _Requirements: 1.5, 1.7, 8.2_

- [x] 5. Building Fields CRUD API
  - [x] 5.1 实现 GET /api/buildings/[buildingId]/fields
    - 创建 `src/app/api/buildings/[buildingId]/fields/route.ts`
    - 查询 building_onboarding_data，计算 score，生成 gap report
    - 返回 fields、score、gapReport、status
    - RLS 自动过滤权限
    - _Requirements: 3.2, 3.8_

  - [x] 5.2 实现 PATCH /api/buildings/[buildingId]/fields
    - 在同一 route 文件中添加 PATCH handler
    - 接收字段更新 payload，Zod 校验
    - 乐观锁检查（version 匹配）
    - 更新 field_values，写入 audit log
    - 重新计算 score，调用 resolveStatus 更新状态
    - _Requirements: 3.3, 4.2, 8.2_

  - [ ]\* 5.3 编写审计日志属性测试
    - **Property 6: 审计日志完整性**
    - **Validates: Requirements 3.3, 8.2**

- [ ] 6. Checkpoint — API 层验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Middleware 扩展与权限适配
  - [x] 7.1 修改 middleware 路由逻辑
    - 修改 `src/lib/supabase/middleware.ts`
    - SIGNED 用户不再直接跳转 pro.uhomes.com
    - SIGNED 用户可访问 /dashboard 和 /onboarding/\*
    - SIGNED 用户访问 / 或 /login 时重定向到 /dashboard
    - 未认证用户访问 /onboarding/\* 重定向到 /login
    - _Requirements: 9.4_

  - [x] 7.2 创建角色解析工具函数
    - 创建 `src/lib/auth/role-resolver.ts`
    - 从 suppliers 表查询当前用户的 role（supplier/bd/data_team）
    - 导出 `getCurrentUserRole()` 供 API 和页面使用
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 8. Dashboard 增强
  - [x] 8.1 重构 Dashboard 页面
    - 修改 `src/app/dashboard/page.tsx`
    - 查询当前 Supplier 名下所有 buildings（含 score、onboarding_status）
    - 渲染 BuildingCard 列表
    - 保留现有合同签署功能（当无 SIGNED 合同时显示）
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.2 创建 BuildingCard 组件
    - 创建 `src/components/onboarding/BuildingCard.tsx`
    - 展示 building_name、ScoreBar、缺失字段数量、状态标签
    - 点击导航至 `/onboarding/[buildingId]`
    - _Requirements: 6.2, 6.3_

  - [x] 8.3 创建 ScoreBar 组件
    - 创建 `src/components/onboarding/ScoreBar.tsx`
    - 进度条展示 0-100 分，≥80 绿色，<80 橙色
    - _Requirements: 6.2_

- [x] 9. Building Onboarding 编辑页面
  - [x] 9.1 创建 Onboarding Page 页面骨架
    - 创建 `src/app/onboarding/[buildingId]/page.tsx`
    - Server Component：获取 building 数据、score、gap report
    - 页面顶部：ScoreBar + 缺失字段数量 + 完成百分比
    - 页面主体：按 category 分组的 FieldGroup 列表
    - _Requirements: 3.1, 3.7, 3.8_

  - [x] 9.2 创建 FieldGroup 组件
    - 创建 `src/components/onboarding/FieldGroup.tsx`
    - 按 category 分组，可折叠展开
    - 展示该分类下所有字段的 FieldEditor
    - 分类标题旁显示该分类的完成度
    - _Requirements: 3.7_

  - [x] 9.3 创建 FieldEditor 组件
    - 创建 `src/components/onboarding/FieldEditor.tsx`
    - 根据 FieldDefinition.type 渲染不同输入控件（text/number/select/multi_select/url/email/phone/boolean/image_urls）
    - 字段旁展示 SourceBadge（数据来源标签）
    - 编辑后调用 PATCH API 保存
    - _Requirements: 3.2, 3.3_

  - [x] 9.4 创建 SourceBadge 和 GapReportPanel 组件
    - 创建 `src/components/onboarding/SourceBadge.tsx`：展示数据来源（合同/网站/Sheets/手动）
    - 创建 `src/components/onboarding/GapReportPanel.tsx`：侧边栏展示缺失字段清单
    - _Requirements: 3.2, 2.4_

- [x] 10. Checkpoint — 编辑页面验证
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. 内部预览与发布流程 _(第二轮：依赖主站 API)_
  - [ ] 11.1 创建预览页面
    - 创建 `src/app/onboarding/[buildingId]/preview/page.tsx`
    - 模拟 uhomes.com 主站的房源卡片和详情页布局
    - 展示 building_name、address、price_range、cover_image、unit_types、amenities
    - 底部：「确认发布」和「返回编辑」按钮
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 11.2 创建 PreviewCard 组件
    - 创建 `src/components/onboarding/PreviewCard.tsx`
    - 模拟 uhomes.com 房源列表卡片样式
    - _Requirements: 5.2_

  - [ ] 11.3 实现发布 API
    - 创建 `src/app/api/buildings/[buildingId]/publish/route.ts`
    - POST：检查 status === 'ready_to_publish'
    - 调用 uhomes.com 主站 API 推送数据
    - 成功 → status = 'published'，发送邮件通知
    - 失败 → 保持 status，记录错误，支持重试（最多 3 次指数退避）
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]\* 11.4 编写渲染数据完整性属性测试
    - **Property 10: 渲染数据完整性**
    - **Validates: Requirements 5.2, 6.2**

- [ ] 12. 集成 OpenSign Webhook 触发提取 _(第二轮：依赖 External Worker)_
  - [ ] 12.1 扩展 OpenSign Webhook 处理
    - 修改现有 `/api/webhooks/opensign` route
    - 合同签署完成后：更新合同状态 → 创建 building 记录 → 触发 extraction pipeline
    - 将合同 PDF URL、供应商网站 URL 传递给 extraction trigger API
    - _Requirements: 1.1_

- [ ] 13. Final Checkpoint — 全流程验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 每个任务引用了具体的需求编号，确保可追溯
- Checkpoints 确保渐进式验证
- 属性测试使用 fast-check 库，需先安装：`npm install -D fast-check`
- External Worker（PDF 解析、Playwright 爬取）的实现不在本 spec 范围内，本 spec 仅定义触发和回调接口
