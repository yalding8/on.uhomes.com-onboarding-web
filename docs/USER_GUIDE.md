# 用户操作指南 User Guide

> on.uhomes.com Onboarding Platform — 三角色操作手册
>
> 最后更新：2026-03-04

---

## 角色概览 Role Overview

| 角色                          | 说明                                             | 入口                |
| :---------------------------- | :----------------------------------------------- | :------------------ |
| **Admin**                     | 系统管理员，负责分配 BD、审批供应商、全局管理    | `/admin`            |
| **BD** (Business Development) | 业务拓展人员，负责供应商审批、合同编辑、手动邀请 | `/admin`            |
| **Supplier**                  | 公寓供应商，提交申请、签署合同、填写房源信息     | `/`（Landing Page） |

### 状态机概览

```
供应商全生命周期：
  申请 (Application) → BD 审批 → 合同编辑 (DRAFT)
  → 推送审阅 (PENDING_REVIEW) → 供应商确认 (CONFIRMED)
  → DocuSign 签署 (SENT → SIGNED)
  → 房源编辑 (extracting → incomplete → previewable)
  → 提交发布 (ready_to_publish → published)
```

---

## Admin 操作指南

### 1. 登录系统

- **页面**: `/login`
- **方式**: 输入管理员邮箱 → 接收 OTP 验证码 → 输入验证码完成登录
- **注意**: Admin 账号需预先在 Supabase 中设置 `role = 'admin'`

### 2. 查看供应商申请列表

- **页面**: `/admin/applications`
- **功能**:
  - 查看所有公开渠道提交的供应商申请
  - 按状态筛选：pending / approved / rejected
  - 查看申请详情：公司名称、联系邮箱、电话、城市、国家
- **API**: `GET` 请求由页面组件直接从 Supabase 读取

### 3. 分配申请的负责 BD

- **页面**: `/admin/applications`（申请列表内操作）
- **操作**: 选择一条申请 → 点击「Assign BD」→ 选择目标 BD
- **API**: `POST /api/admin/assign-application-bd`
  ```json
  { "application_id": "uuid", "bd_id": "uuid" }
  ```
- **注意**: 仅 Admin 角色可执行此操作，BD 角色无权分配

### 4. 审批供应商

- **页面**: `/admin/applications`（申请列表内操作）
- **操作**: 点击「Approve」按钮
- **API**: `POST /api/admin/approve-supplier`
- **后台流程**:
  1. 创建 Supabase Auth 用户（如不存在）
  2. 创建 `suppliers` 记录（status = `PENDING_CONTRACT`）
  3. 创建 `contracts` 记录（status = `DRAFT`）
  4. 发送邀请邮件（通过 Resend）
- **注意**: 审批后供应商会收到邮件邀请，点击链接即可登录

### 5. 管理供应商列表

- **页面**: `/admin/suppliers`
- **功能**:
  - 查看所有已审批的供应商
  - 按状态筛选：PENDING_CONTRACT / SIGNED / ACTIVE 等
  - 查看每个供应商关联的楼宇数量
  - 点击进入供应商详情页

### 6. 分配/更换供应商的负责 BD

- **页面**: `/admin/suppliers` 或 `/admin/suppliers/[id]`
- **操作**: 选择供应商 → 点击「Assign BD」→ 选择新 BD
- **API**: `POST /api/admin/assign-bd`
  ```json
  { "supplier_id": "uuid", "bd_id": "uuid" }
  ```
- **注意**: 传 `bd_id: null` 可取消 BD 分配

---

## BD 操作指南

### 1. 登录系统

- **页面**: `/login`
- **方式**: 输入 BD 邮箱 → 接收 OTP 验证码 → 输入验证码完成登录
- **登录后**: 自动跳转到 `/admin`（BD 管理后台入口）
- **注意**: BD 账号需预先在 Supabase 中设置 `role = 'bd'`

### 2. 查看负责的供应商

- **页面**: `/admin/suppliers`
- **功能**:
  - BD 仅能看到自己负责的供应商（通过 `bd_user_id` 字段筛选）
  - Admin 角色可看到全部供应商
  - 点击供应商名称进入详情页 `/admin/suppliers/[id]`

### 3. 编辑合同

- **页面**: `/admin/contracts/[contractId]/edit`
- **操作**:
  - 填写/修改合同动态字段（佣金比例、付款方式、有效期等）
  - 上传非标准合同 PDF（可选）
  - 从上传的 PDF 中 AI 提取字段（可选）
- **API**:
  - 保存字段: `PUT /api/admin/contracts/[contractId]`
  - 上传 PDF: `POST /api/admin/contracts/[contractId]/upload`（FormData, max 10MB）
  - AI 提取: `POST /api/admin/contracts/[contractId]/extract`
- **注意**:
  - 仅 `DRAFT` 状态的合同可编辑
  - BD 只能编辑自己负责的供应商的合同

### 4. 发送合同给供应商审阅

- **操作**: 合同编辑完成后，点击「Send for Review」
- **API**: `POST /api/admin/contracts/[contractId]`（状态从 DRAFT → PENDING_REVIEW）
- **后台流程**: 供应商 Dashboard 将显示合同预览，等待确认
- **注意**: 推送后 BD 不可再修改合同字段，需供应商响应后方可进入下一步

### 5. 手动邀请供应商

- **页面**: `/admin/invite`
- **操作**: 填写供应商信息（公司名、邮箱、电话、城市、国家）→ 点击「Send Invitation」
- **API**: `POST /api/admin/invite-supplier`
- **后台流程**:
  1. 创建 Auth 用户 + supplier 记录 + contract 记录
  2. 发送邀请邮件
- **使用场景**: 线下沟通已确认合作意向的供应商，跳过公开申请流程

### 6. 生成推荐链接

- **操作**: 在管理后台点击「Generate Referral Link」
- **API**: `POST /api/admin/generate-referral`
- **功能**: 生成唯一推荐码，供应商通过此链接申请时自动关联到该 BD
- **使用场景**: BD 在社交媒体或邮件中分享链接，追踪推荐来源

---

## Supplier 供应商操作指南

### 1. 提交入驻申请

- **页面**: `/`（Landing Page）
- **操作**: 填写申请表单 → 点击「Apply Now」
- **必填字段**:
  - Company Name（公司名称）
  - Contact Email（联系邮箱）
  - Contact Phone（联系电话）
  - City（城市）
  - Country（国家）
- **API**: `POST /api/apply`
- **注意**:
  - 同一邮箱不可重复提交（返回 409 Conflict）
  - 提交后等待 BD 审批，审批通过后会收到邮件

### 2. 登录系统

- **页面**: `/login`
- **前提**: 收到审批通过的邀请邮件
- **操作**: 输入邮箱 → 接收 OTP 验证码邮件 → 输入 6 位验证码
- **登录后**: 自动跳转到 `/dashboard`
- **常见问题**:
  - 未收到验证码？检查垃圾邮件文件夹，或等待 60 秒后点击「Resend」
  - 验证码过期？默认 10 分钟有效，过期后重新请求

### 3. 查看合同（Dashboard — PENDING_CONTRACT 状态）

- **页面**: `/dashboard`
- **显示内容**:
  - 合同状态指示器（PENDING_REVIEW / CONFIRMED / SENT / SIGNED）
  - 合同预览：查看 BD 配置的合同条款
  - 操作按钮：确认签署或请求修改
- **注意**: 当合同处于 `PENDING_REVIEW` 状态时，供应商需要操作

### 4. 确认/签署合同

- **页面**: `/dashboard`
- **流程**:
  1. 查看合同预览 → 点击「Confirm & Sign」确认合同条款
  2. **API**: `POST /api/contracts/[contractId]/confirm`（body: `{ "action": "CONFIRM" }`）
  3. 系统自动通过 DocuSign 创建签约请求
  4. 供应商收到 DocuSign 签署链接 → 在 DocuSign 页面完成电子签名
  5. 签署完成后 DocuSign Webhook 自动回调 → 更新状态为 `SIGNED`
- **请求修改**: 如需修改条款，点击「Request Changes」
  - API: `POST /api/contracts/[contractId]/confirm`（body: `{ "action": "REQUEST_CHANGES", "note": "..." }`）
  - BD 收到通知后重新编辑合同

### 5. 填写房源信息（Building Onboarding）

- **页面**: `/onboarding/[buildingId]`
- **前提**: 合同已签署（supplier status = `SIGNED`）
- **操作**:
  - 逐步填写楼宇信息：基本信息、地址、设施、价格、图片等
  - 实时查看 Completeness Score（完整度评分）
  - 查看 Gap Report（缺失字段清单）
  - 上传楼宇图片
- **API**:
  - 获取字段: `GET /api/buildings/[buildingId]/fields`
  - 更新字段: `PATCH /api/buildings/[buildingId]/fields`
  - 上传图片: `POST /api/buildings/[buildingId]/images`
- **注意**:
  - 系统支持乐观锁（optimistic locking），防止并发编辑冲突
  - 每次保存会生成审计日志（field_audit_logs）
  - AI 提取管线可能已预填部分字段（来源标记为 `ai_extracted`）

### 6. 提交发布

- **页面**: `/onboarding/[buildingId]`
- **前提**: 楼宇状态为 `previewable`（评分达到发布阈值）
- **操作**: 点击「Submit for Review」
- **API**: `POST /api/buildings/[buildingId]/submit`
- **状态变化**: `previewable` → `ready_to_publish`
- **后续**: BD/Data Team 审核后标记为 `published`，推送至主站

### 7. 账户管理

#### 数据导出（GDPR Data Portability）

- **操作**: Dashboard 设置区 → 点击「Export My Data」
- **API**: `GET /api/account/export`
- **返回**: JSON 格式文件下载，包含所有个人数据（supplier 信息、合同、楼宇数据等）

#### 账户删除

- **操作**: Dashboard 设置区 → 点击「Delete Account」→ 确认操作
- **API**: `POST /api/account/delete`
- **流程**:
  1. 系统检查是否有活跃订单或未结算佣金
  2. 如无阻碍，标记为 `DELETION_PENDING`，启动 30 天冷却期
  3. 冷却期内可联系客服取消删除
  4. 30 天后自动永久删除所有数据
- **注意**: 已有活跃订单的供应商无法立即删除，需先处理完毕

---

## 附录：关键状态说明

### 合同状态（Contract Status）

| 状态   | 英文             | 说明                         |
| :----- | :--------------- | :--------------------------- |
| 草稿   | `DRAFT`          | BD 正在编辑合同字段          |
| 待审阅 | `PENDING_REVIEW` | 已推送给供应商，等待确认     |
| 已确认 | `CONFIRMED`      | 供应商已确认条款，待发起签署 |
| 已发送 | `SENT`           | DocuSign 签署请求已发送      |
| 已签署 | `SIGNED`         | 双方签署完成                 |

### 供应商状态（Supplier Status）

| 状态   | 英文               | 说明                       |
| :----- | :----------------- | :------------------------- |
| 待签约 | `PENDING_CONTRACT` | 已创建账号，等待签署合同   |
| 已签约 | `SIGNED`           | 合同已签署，可开始填写房源 |
| 活跃   | `ACTIVE`           | 至少一个房源已发布         |
| 待删除 | `DELETION_PENDING` | 账户删除冷却期中（30 天）  |

### 楼宇状态（Building Status）

| 状态   | 英文               | 说明                   |
| :----- | :----------------- | :--------------------- |
| 提取中 | `extracting`       | AI 正在提取数据        |
| 不完整 | `incomplete`       | 字段填写未达到发布阈值 |
| 可预览 | `previewable`      | 数据足够，可预览效果   |
| 待发布 | `ready_to_publish` | 供应商已提交，等待审核 |
| 已发布 | `published`        | 审核通过，已同步至主站 |

---

## 附录：常见问题 FAQ

### Q: 供应商忘记密码怎么办？

A: 本系统使用 OTP（一次性验证码）登录，无需密码。每次登录只需输入邮箱接收验证码。

### Q: BD 如何查看自己的业绩？

A: 进入 `/admin/suppliers` 查看负责的供应商列表，通过供应商数量和楼宇发布数量衡量。

### Q: 合同推送后发现字段有误怎么办？

A: 供应商可点击「Request Changes」退回合同。BD 收到通知后在 `/admin/contracts/[id]/edit` 页面修改后重新推送。

### Q: AI 提取的字段不准确怎么办？

A: 供应商可在 `/onboarding/[buildingId]` 页面直接修改 AI 预填的字段，修改会覆盖 AI 值并记录在审计日志中。

### Q: 如何联系技术支持？

A: 请通过 Uhomes 内部工单系统提交问题，或联系开发团队。
