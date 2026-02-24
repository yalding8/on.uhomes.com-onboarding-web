# 实现计划：在线合同签署（DocuSign 集成）

## 概述

将现有 Mock OpenSign 签约流程替换为真实 DocuSign eSignature 集成。按照数据层 → 核心逻辑层 → API 层 → UI 层的顺序递增实现，每一步都可验证。

## 任务

- [x] 1. 数据库 Schema 变更与核心类型定义
  - [x] 1.1 创建 Supabase Migration 文件 `supabase/migrations/20260224100000_docusign_contract_signing.sql`
    - 更新 contracts 表 status CHECK 约束，新增 PENDING_REVIEW 和 CONFIRMED 状态
    - 新增 `contract_fields` JSONB 列（默认 `'{}'::jsonb`）
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 1.2 定义合同相关 TypeScript 类型 `src/lib/contracts/types.ts`
    - 定义 `ContractStatus` 联合类型、`ContractFields` 接口、`FieldValidationResult` 接口
    - _Requirements: 1.1, 3.1_

- [x] 2. 合同状态机与字段验证（纯函数层）
  - [x] 2.1 实现合同状态机 `src/lib/contracts/status-machine.ts`
    - 实现 `VALID_TRANSITIONS` 映射表、`canTransition()`、`validateTransition()` 函数
    - _Requirements: 1.1, 1.3, 1.4, 1.5_
  - [x] 2.2 编写状态机属性测试 `src/lib/contracts/__tests__/status-machine.test.ts`
    - **Property 1: 合同状态机转换正确性**
    - **Property 4: 合同可编辑性由状态决定**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 3.5**
  - [x] 2.3 实现合同字段验证 `src/lib/contracts/field-validation.ts`
    - 实现 `validateContractFields()` 纯函数，校验必填字段、commission_rate 数值范围、日期先后顺序
    - _Requirements: 3.3, 4.1, 4.3_
  - [x] 2.4 编写字段验证属性测试 `src/lib/contracts/__tests__/field-validation.test.ts`
    - **Property 2: 合同字段验证完整性**
    - **Property 3: 合同字段持久化往返一致性**
    - **Validates: Requirements 3.3, 3.4, 4.1, 4.3**

- [x] 3. 检查点 - 确保纯函数层测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. DocuSign 服务层
  - [x] 4.1 实现 HMAC 签名验证 `src/lib/docusign/hmac.ts`
    - 实现 `verifyDocuSignHmac()` 函数，使用 crypto.createHmac('sha256', secret)
    - _Requirements: 7.2, 7.3_
  - [x] 4.2 编写 HMAC 验证属性测试 `src/lib/docusign/__tests__/hmac.test.ts`
    - **Property 6: HMAC 签名验证正确性**
    - **Validates: Requirements 7.2, 7.3**
  - [x] 4.3 实现 DocuSign Tab 映射 `src/lib/docusign/tab-mapping.ts`
    - 实现 `buildTextTabs()` 函数，将 ContractFields 转换为 DocuSign Text Tabs 数组
    - _Requirements: 6.2_
  - [x] 4.4 编写 Tab 映射属性测试 `src/lib/docusign/__tests__/tab-mapping.test.ts`
    - **Property 5: DocuSign Text Tabs 映射完整性**
    - **Validates: Requirements 6.2**
  - [x] 4.5 实现 DocuSign 客户端 `src/lib/docusign/client.ts`
    - 实现 JWT Grant 认证（`getAccessToken()`）、信封创建（`createEnvelope()`）、文档下载（`downloadSignedDocument()`）
    - 使用 `docusign-esign` npm 包
    - 环境变量缺失时抛出包含变量名的错误
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.1, 6.3, 10.1, 10.2_
  - [x] 4.6 编写 DocuSign 客户端单元测试 `src/lib/docusign/__tests__/client.test.ts`
    - **Property 10: 缺失环境变量错误提示**
    - **Property 12: Base64 私钥解码往返一致性**
    - **Validates: Requirements 2.3, 10.2**

- [x] 5. 检查点 - 确保 DocuSign 服务层测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 6. 修改现有审批/邀请 API（适配 DRAFT 初始状态）
  - [x] 6.1 修改 `src/app/api/admin/approve-supplier/route.ts`
    - 合同初始状态从 SENT 改为 DRAFT
    - signature_provider 设为 "DOCUSIGN"
    - 移除 mock embedded_signing_url 和 signature_request_id 生成
    - _Requirements: 9.1, 9.3_
  - [x] 6.2 修改 `src/app/api/admin/invite-supplier/route.ts`
    - 同 6.1 的变更
    - _Requirements: 9.2, 9.3_

- [x] 7. 新增 API 路由
  - [x] 7.1 实现 BD 合同字段保存与推送审阅 API `src/app/api/admin/contracts/[contractId]/route.ts`
    - PUT: 保存合同字段到 contract_fields（仅 DRAFT 状态）
    - POST: 验证字段完整性后推送审阅（DRAFT → PENDING_REVIEW）
    - BD Session 鉴权 + role 校验
    - _Requirements: 3.4, 4.1, 4.2, 4.3_
  - [x] 7.2 实现供应商确认/请求修改合同 API `src/app/api/contracts/[contractId]/confirm/route.ts`
    - POST action=confirm: PENDING_REVIEW → CONFIRMED → 调用 DocuSign 创建信封 → SENT
    - POST action=request_changes: PENDING_REVIEW → DRAFT
    - 供应商 Session 鉴权 + 合同归属验证
    - _Requirements: 5.2, 5.3, 6.1, 6.4, 6.5, 6.6_
  - [x] 7.3 实现 DocuSign Webhook 路由 `src/app/api/webhooks/docusign/route.ts`
    - HMAC 签名验证
    - envelope-completed 事件处理：更新合同状态 SIGNED + 供应商状态 SIGNED
    - 下载签署 PDF → 上传 Supabase Storage → 保存 document_url
    - 幂等性处理（已签署合同不重复处理）
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 8.1, 8.2, 8.3, 8.6_
  - [x] 7.4 编写 Webhook 路由测试 `src/app/api/webhooks/docusign/__tests__/route.test.ts`
    - **Property 7: Webhook 幂等性**
    - **Property 8: Webhook 级联状态更新**
    - **Property 9: 新建合同初始状态**
    - **Validates: Requirements 7.5, 7.6, 7.8, 9.1, 9.2, 9.3**

- [x] 8. 检查点 - 确保所有 API 路由测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 9. UI 组件实现
  - [x] 9.1 实现 BD 合同编辑页面 `src/app/admin/contracts/[contractId]/edit/page.tsx`
    - Server Component 加载合同 + 供应商数据
    - 拆分 Client Component `src/components/admin/ContractEditForm.tsx` 处理编辑交互
    - 自动预填 partner_company_name 和 partner_city
    - DRAFT 状态可编辑，非 DRAFT 只读
    - 保存按钮 + 推送审阅按钮
    - _Requirements: 3.1, 3.2, 3.5, 4.2, 4.4_
  - [x] 9.2 实现供应商合同预览组件 `src/components/signing/ContractPreview.tsx`
    - 替代现有 ContractViewer 的功能
    - 根据合同状态展示不同 UI：DRAFT 提示、PENDING_REVIEW 详情+操作按钮、CONFIRMED/SENT 进度、SIGNED 下载链接
    - _Requirements: 5.1, 5.4, 5.5, 8.5_
  - [x] 9.3 编写合同预览组件测试 `src/components/signing/__tests__/ContractPreview.test.tsx`
    - **Property 11: 合同预览字段渲染完整性**
    - **Validates: Requirements 5.1**
  - [x] 9.4 修改供应商 Dashboard `src/app/dashboard/page.tsx`
    - 适配新的合同状态（DRAFT、PENDING_REVIEW、CONFIRMED、SENT）
    - 使用 ContractPreview 替代 ContractViewer
    - 查询 contract_fields 数据传递给预览组件
    - _Requirements: 5.1, 5.4, 5.5_
  - [x] 9.5 在 BD 供应商详情页添加合同编辑入口
    - 修改 `src/app/admin/suppliers/[id]/page.tsx`，为 DRAFT 状态合同添加"编辑合同"链接
    - 显示合同当前状态和下载链接（SIGNED 状态）
    - _Requirements: 8.4_

- [x] 10. 配置与文档更新
  - [x] 10.1 更新 README.md
    - 新增 DocuSign 环境变量说明表格
    - 新增 API 路由说明（`/api/admin/contracts/[contractId]`、`/api/contracts/[contractId]/confirm`、`/api/webhooks/docusign`）
    - _Requirements: 10.3_
  - [x] 10.2 创建 Supabase Storage bucket 配置说明
    - 在 README 中说明 `signed-contracts` 存储桶的创建步骤和 RLS 策略
    - _Requirements: 8.2_

- [x] 11. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点确保增量验证，避免问题累积
- 属性测试验证通用正确性属性，单元测试验证具体边界情况
- 保留 `/api/webhooks/opensign` 路由以兼容旧合同（需求 9.4），不在本次任务中删除
