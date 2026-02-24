# 需求文档：在线合同签署（DocuSign 集成）

## 简介

本功能将 on.uhomes.com Onboarding 系统中现有的 Mock OpenSign 签约流程替换为真实的 DocuSign eSignature 集成。BD 人员可以编辑合同动态字段、推送给供应商审阅，供应商确认后系统自动通过 DocuSign API 创建签署信封，完成电子签名。签署完成后系统自动下载已签署 PDF 并存储至 Supabase Storage，双方均可下载。

## 术语表

- **BD**：Business Development，异乡好居的商务拓展人员，负责管理供应商合同
- **Supplier（供应商）**：在平台上注册并管理房源的合作方
- **Contract（合同）**：BD 与供应商之间的合作协议记录，存储于 `contracts` 表
- **DocuSign_Client**：服务端 DocuSign eSignature SDK 客户端，使用 JWT Grant 认证
- **Envelope（信封）**：DocuSign 中的签署请求单元，包含文档和签署人信息
- **Template（模板）**：DocuSign 中预上传的合同 PDF 模板，包含动态字段占位符
- **Contract_Editor**：BD 编辑合同动态字段的页面组件，路由为 `/admin/contracts/[contractId]/edit`
- **Contract_Preview**：供应商查看合同详情的界面组件，展示在 Dashboard 中
- **Webhook_Handler**：处理 DocuSign 签署完成回调的 API 路由
- **Supabase_Storage**：Supabase 提供的对象存储服务，用于存放已签署的 PDF 文件
- **Dynamic_Fields（动态字段）**：合同模板中可由 BD 编辑的变量字段，如公司名称、佣金比例等
- **HMAC**：Hash-based Message Authentication Code，用于验证 DocuSign Webhook 回调的签名

## 需求

### 需求 1：合同状态流转

**用户故事：** 作为系统架构师，我希望合同具有清晰的状态流转机制，以便准确追踪每份合同在签署流程中的位置。

#### 验收标准

1. THE Contract SHALL 支持以下状态流转路径：DRAFT → PENDING_REVIEW → CONFIRMED → SENT → SIGNED
2. WHEN BD 审批或邀请供应商时，THE 系统 SHALL 创建一条状态为 DRAFT 的合同记录（替代原有的直接创建 SENT 状态）
3. WHEN 合同处于 DRAFT、PENDING_REVIEW 或 CONFIRMED 状态时，THE 系统 SHALL 允许将合同状态更新为 CANCELED
4. WHEN 合同处于 SENT 或 SIGNED 状态时，THE 系统 SHALL 拒绝将合同状态更新为 CANCELED
5. WHEN 合同状态发生变更时，THE 系统 SHALL 验证新状态是否为当前状态的合法后继状态，拒绝非法状态转换

### 需求 2：DocuSign JWT 认证

**用户故事：** 作为开发者，我希望系统通过 JWT Grant 方式与 DocuSign API 认证，以便在服务端安全地调用签署相关接口。

#### 验收标准

1. THE DocuSign_Client SHALL 使用 JWT Grant 流程获取 access_token，所需凭证包括：DOCUSIGN_CLIENT_ID、DOCUSIGN_USER_ID、DOCUSIGN_PRIVATE_KEY、DOCUSIGN_AUTH_SERVER
2. WHEN access_token 过期或不存在时，THE DocuSign_Client SHALL 自动重新申请新的 access_token
3. THE DocuSign_Client SHALL 将 DOCUSIGN_PRIVATE_KEY 环境变量作为 Base64 编码的 RSA 私钥进行解码后使用
4. IF DocuSign JWT 认证失败，THEN THE DocuSign_Client SHALL 返回包含具体错误原因的错误信息

### 需求 3：合同动态字段管理

**用户故事：** 作为 BD 人员，我希望能编辑合同中的动态字段，以便为每个供应商定制合同内容。

#### 验收标准

1. THE Contract_Editor SHALL 支持以下动态字段的编辑：partner_company_name、partner_contact_name、partner_address、partner_city、partner_country、commission_rate、contract_start_date、contract_end_date、covered_properties
2. WHEN BD 打开合同编辑页面时，THE Contract_Editor SHALL 自动填充 partner_company_name 和 partner_city 字段（从关联供应商记录读取），BD 可修改这些预填值
3. WHEN BD 提交合同字段时，THE Contract_Editor SHALL 验证所有必填字段非空，commission_rate 为有效数值，contract_start_date 早于 contract_end_date
4. WHEN BD 保存合同字段后，THE 系统 SHALL 将字段数据持久化到 contracts 表的 provider_metadata 字段中
5. IF BD 编辑一份非 DRAFT 状态的合同，THEN THE Contract_Editor SHALL 禁止编辑并显示当前合同状态

### 需求 4：BD 推送合同给供应商审阅

**用户故事：** 作为 BD 人员，我希望在编辑完合同后将其推送给供应商审阅，以便供应商确认合同内容。

#### 验收标准

1. WHEN BD 在合同编辑页面点击"推送审阅"按钮时，THE 系统 SHALL 验证所有必填动态字段已填写完整
2. WHEN 验证通过后，THE 系统 SHALL 将合同状态从 DRAFT 更新为 PENDING_REVIEW
3. IF 必填字段未填写完整，THEN THE 系统 SHALL 显示缺失字段的具体提示，阻止推送操作
4. WHEN 合同状态变为 PENDING_REVIEW 后，THE Contract_Editor SHALL 将页面切换为只读预览模式

### 需求 5：供应商审阅合同

**用户故事：** 作为供应商，我希望在 Dashboard 上查看 BD 推送的合同详情，以便确认合同内容或提出修改意见。

#### 验收标准

1. WHEN 供应商登录 Dashboard 且合同状态为 PENDING_REVIEW 时，THE Contract_Preview SHALL 展示合同所有动态字段的值
2. WHEN 供应商点击"确认并进入签署"按钮时，THE 系统 SHALL 将合同状态从 PENDING_REVIEW 更新为 CONFIRMED
3. WHEN 供应商点击"请求修改"按钮时，THE 系统 SHALL 将合同状态从 PENDING_REVIEW 回退为 DRAFT
4. WHEN 合同状态为 DRAFT 时，THE Contract_Preview SHALL 显示"合同正在准备中"的提示信息
5. WHEN 合同状态为 CONFIRMED 或 SENT 时，THE Contract_Preview SHALL 显示对应的进度状态信息，禁用操作按钮

### 需求 6：DocuSign 信封创建与发送

**用户故事：** 作为系统，我希望在供应商确认合同后自动创建 DocuSign 签署信封，以便供应商通过邮件完成电子签名。

#### 验收标准

1. WHEN 合同状态变为 CONFIRMED 时，THE 系统 SHALL 调用 DocuSign API 使用 DOCUSIGN_TEMPLATE_ID 创建信封
2. WHEN 创建信封时，THE 系统 SHALL 将合同动态字段值通过 Text Tabs（tabLabel 匹配）填充到 DocuSign 模板中
3. WHEN 创建信封时，THE 系统 SHALL 配置 eventNotification 以接收信封级别的 Webhook 回调
4. WHEN 信封创建成功后，THE 系统 SHALL 将 envelope_id 存储到 contracts 表的 signature_request_id 字段，并将合同状态更新为 SENT
5. WHEN 信封创建成功后，THE 系统 SHALL 将 signature_provider 字段更新为 "DOCUSIGN"
6. IF DocuSign API 调用失败，THEN THE 系统 SHALL 保持合同状态为 CONFIRMED，记录错误信息到 provider_metadata 字段，并返回错误提示

### 需求 7：DocuSign Webhook 回调处理

**用户故事：** 作为系统，我希望正确处理 DocuSign 的签署完成回调，以便自动更新合同和供应商状态。

#### 验收标准

1. THE Webhook_Handler SHALL 在 `/api/webhooks/docusign` 路由上接收 DocuSign 的 POST 回调请求
2. WHEN 收到回调请求时，THE Webhook_Handler SHALL 使用 DOCUSIGN_WEBHOOK_SECRET 验证请求的 HMAC 签名
3. IF HMAC 签名验证失败，THEN THE Webhook_Handler SHALL 返回 401 状态码并拒绝处理
4. WHEN 收到 envelope-completed 事件且签名验证通过时，THE Webhook_Handler SHALL 通过 envelope_id 查找对应的合同记录
5. WHEN 找到对应合同后，THE Webhook_Handler SHALL 将合同状态更新为 SIGNED，记录 signed_at 时间戳
6. WHEN 合同状态更新为 SIGNED 后，THE Webhook_Handler SHALL 将关联供应商的状态更新为 SIGNED
7. IF 收到的 envelope_id 在 contracts 表中不存在，THEN THE Webhook_Handler SHALL 返回 404 状态码
8. WHEN 收到已处理过的合同的重复回调时，THE Webhook_Handler SHALL 返回 200 状态码且不重复处理

### 需求 8：已签署文档自动下载与存储

**用户故事：** 作为系统管理员，我希望签署完成后自动下载已签署的 PDF 并存储到系统中，以便 BD 和供应商随时下载查看。

#### 验收标准

1. WHEN 合同状态更新为 SIGNED 后，THE 系统 SHALL 调用 DocuSign API 下载已签署的 PDF 文档
2. WHEN PDF 下载成功后，THE 系统 SHALL 将文件上传到 Supabase_Storage 的 `signed-contracts` 存储桶中
3. WHEN 文件上传成功后，THE 系统 SHALL 将下载 URL 保存到 contracts 表的 document_url 字段
4. WHEN BD 在管理后台查看合同详情时，THE Admin_Dashboard SHALL 提供已签署合同的下载链接
5. WHEN 供应商在 Dashboard 查看已签署合同时，THE Contract_Preview SHALL 提供已签署合同的下载链接
6. IF PDF 下载或上传失败，THEN THE 系统 SHALL 记录错误信息，合同状态保持为 SIGNED，支持后续手动重试

### 需求 9：现有代码适配

**用户故事：** 作为开发者，我希望现有的审批和邀请流程适配新的合同状态，以便与 DocuSign 签署流程无缝衔接。

#### 验收标准

1. WHEN BD 通过 approve-supplier API 审批供应商时，THE 系统 SHALL 创建合同记录的初始状态为 DRAFT（替代原有的 SENT），signature_provider 设为 "DOCUSIGN"
2. WHEN BD 通过 invite-supplier API 邀请供应商时，THE 系统 SHALL 创建合同记录的初始状态为 DRAFT（替代原有的 SENT），signature_provider 设为 "DOCUSIGN"
3. WHEN 系统创建 DRAFT 状态的合同时，THE 系统 SHALL 不再生成 mock 的 embedded_signing_url 和 signature_request_id
4. THE 系统 SHALL 保留 `/api/webhooks/opensign` 路由以兼容已有的 SENT 状态合同，直到所有旧合同完成签署

### 需求 10：环境变量与配置

**用户故事：** 作为开发者，我希望所有 DocuSign 相关配置通过环境变量管理，以便在不同环境间安全切换。

#### 验收标准

1. THE 系统 SHALL 要求以下环境变量：DOCUSIGN_CLIENT_ID、DOCUSIGN_USER_ID、DOCUSIGN_ACCOUNT_ID、DOCUSIGN_PRIVATE_KEY（Base64 编码）、DOCUSIGN_AUTH_SERVER、DOCUSIGN_TEMPLATE_ID、DOCUSIGN_WEBHOOK_SECRET
2. WHEN 系统启动时缺少任何必需的 DocuSign 环境变量，THE DocuSign_Client SHALL 在首次调用时返回明确的配置缺失错误信息
3. WHEN 新增环境变量或 API 路由时，THE 开发者 SHALL 在同一 PR 内更新 README.md 中的对应表格

### 需求 11：数据库 Schema 变更

**用户故事：** 作为开发者，我希望数据库 Schema 支持新的合同状态和字段，以便存储 DocuSign 集成所需的数据。

#### 验收标准

1. THE contracts 表的 status CHECK 约束 SHALL 更新为支持以下值：DRAFT、PENDING_REVIEW、CONFIRMED、SENT、SIGNED、CANCELED
2. THE contracts 表 SHALL 新增 `contract_fields` 列（JSONB 类型），用于存储合同动态字段值
3. THE 系统 SHALL 通过 Supabase Migration 文件执行 Schema 变更，确保变更可追溯和可回滚
