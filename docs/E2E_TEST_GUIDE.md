# on.uhomes.com Onboarding — E2E 手动测试指南

> 本指南覆盖 BD 视角和供应商视角的完整操作流程，适用于本地开发环境和 Vercel Preview 环境。
> DocuSign 沙箱注册与配置详见 [DOCUSIGN_E2E_TEST_GUIDE.md](./DOCUSIGN_E2E_TEST_GUIDE.md)。

---

## 0. 环境准备

### 0.1 启动环境

| 环境 | 地址 | 说明 |
|:-----|:-----|:-----|
| 本地 | `http://localhost:3000` | `npm run dev` |
| Vercel Preview | PR 自动生成的 Preview URL | DocuSign Webhook 可直接回调，推荐用于完整流程 |

> 以下用 `$BASE` 代表你的测试地址。

### 0.2 必要环境变量

`.env.local` 中需配置（参考 README.md 环境变量表）：

| 变量 | 测试值 |
|:-----|:-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名公钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 管理员 Key |
| `DOCUSIGN_*` 系列 | 参考 DOCUSIGN_E2E_TEST_GUIDE.md |

### 0.3 创建 BD 测试账号

BD 账号需要在 Supabase 中手动初始化（一次性操作）。

在 Supabase Dashboard → SQL Editor 执行：

```sql
-- 1. 先在 Auth 中邀请一个用户（或已有用户则跳过）
-- 通过 Supabase Dashboard → Authentication → Users → Invite User
-- 邮箱示例：bd-test@uhomes.com

-- 2. 查出该用户的 auth user_id
SELECT id FROM auth.users WHERE email = 'bd-test@uhomes.com';

-- 3. 在 suppliers 表插入 BD 记录（将下方 UUID 替换为上一步查出的 id）
INSERT INTO public.suppliers (user_id, company_name, contact_email, role, status)
VALUES (
  '替换为auth_user_id',
  'uhomes BD Team',
  'bd-test@uhomes.com',
  'bd',
  'SIGNED'
);
```

> BD 账号创建后长期有效，无需每次重建。

### 0.4 准备测试供应商邮箱

准备一个**能正常收邮件的真实邮箱**，用于接收 Supabase OTP 验证码和 DocuSign 签署邮件。

---

## 流程一：BD 审批供应商申请（通过 Landing Page）

### Step 1 — 供应商提交申请

1. 访问 `$BASE/`，查看 Landing Page
2. 填写申请表单：

   | 字段 | 示例值 |
   |:-----|:-------|
   | Company Name | Test Housing Inc |
   | Work Email | your-test-email@example.com |
   | Contact Phone | +1 555 0000 |
   | City | Toronto |
   | Country | Canada |
   | Website URL | https://example.com（选填）|

3. 点击 **"Submit Request"**

**✅ 预期结果**：页面显示 "Application Received!" 成功提示

**验证**：Supabase → `applications` 表出现一条 `status = PENDING` 记录

---

### Step 2 — BD 登录管理后台

1. 访问 `$BASE/login`
2. 输入 BD 测试邮箱（`bd-test@uhomes.com`）
3. 点击 **"Continue with Email"**
4. 查收邮件中的 8 位验证码
5. 输入验证码，点击 **"Secure Login"**

**✅ 预期结果**：自动跳转到 `$BASE/admin/applications`（BD 角色进入管理后台）

---

### Step 3 — BD 审批申请

1. 在申请列表中找到 Step 1 提交的申请（状态 `Pending`）
2. 点击 **"Approve"** 按钮
3. 弹出 Approve 对话框：
   - 确认申请方信息正确
   - 选择合同类型（默认 `STANDARD_PROMOTION_2026`）
4. 点击 **"Confirm Approval"**

**✅ 预期结果**：对话框关闭，该申请状态变为 `Converted`

**验证数据库**：

| 表 | 字段 | 预期值 |
|:---|:-----|:-------|
| `applications` | status | `CONVERTED` |
| `suppliers` | status | `PENDING_CONTRACT` |
| `suppliers` | role | `supplier` |
| `contracts` | status | `DRAFT` |
| `contracts` | contract_fields | `{}` |

**验证邮箱**：供应商邮箱收到 Supabase 发出的邀请邮件（标题含 "invited"）

---

### Step 4 — BD 进入供应商详情

1. 点击左侧导航 **"Suppliers"**
2. 在列表中找到刚审批的供应商（状态 `Pending Contract`）
3. 点击进入供应商详情页 `/admin/suppliers/[id]`

**✅ 预期结果**：
- 基本信息区域显示公司名、邮箱、状态
- 合同区域显示一条 `DRAFT` 状态合同，有 **"Edit Contract"** 链接

---

### Step 5 — BD 编辑合同字段

1. 点击 **"Edit Contract"**，跳转到 `/admin/contracts/[id]/edit`
2. 确认字段 `Partner Company Name` 和 `City` 已自动预填
3. 补全所有必填字段：

   | 字段 | 示例值 |
   |:-----|:-------|
   | Partner Company Name | Test Housing Inc（预填）|
   | Contact Name | John Smith |
   | Address | 123 Main Street |
   | City | Toronto（预填）|
   | Country | Canada |
   | Commission Rate | 15 |
   | Contract Start Date | 2026-03-01 |
   | Contract End Date | 2027-02-28 |
   | Covered Properties | All Toronto properties |

4. 点击 **"Save"**

**✅ 预期结果**：提示保存成功

**验证**：`contracts.contract_fields` JSONB 列包含所有字段值

---

### Step 6 — BD 推送审阅

在合同编辑页，点击 **"Push for Review"**

**✅ 预期结果**：状态标签变为 `Pending Review`，字段变为只读

**验证**：`contracts.status = PENDING_REVIEW`

> **边界测试**：尝试在字段有空值时点击推送，应看到具体的字段验证错误提示。

---

## 流程二：BD 手动邀请供应商（直接邀请）

> 适用场景：BD 已线下谈好合作，直接在系统创建供应商，无需等待供应商提交申请。

### Step 1 — BD 进入邀请页面

BD 登录后，点击左侧导航 **"Invite Supplier"**，进入 `/admin/invite`

### Step 2 — 填写邀请信息

| 字段 | 示例值 |
|:-----|:-------|
| Email | invited-supplier@example.com |
| Company Name | Direct Invite Housing Co |
| Phone | +1 555 1234（选填）|
| City | Vancouver（选填）|
| Website | https://example.com（选填）|

点击 **"Send Invitation"**

**✅ 预期结果**：显示成功提示

**验证数据库**：同流程一 Step 3，`suppliers.status = PENDING_CONTRACT`，`contracts.status = DRAFT`

> 之后流程与流程一 Step 4-6 完全相同（BD 编辑合同 → 推送审阅）。

---

## 流程三：供应商签约流程

> 前置条件：BD 已完成流程一或流程二，合同状态为 `PENDING_REVIEW`。

### Step 1 — 供应商首次登录

**方式 A — 邮件链接（推荐首次）**

1. 打开供应商邮箱中 Supabase 发送的邀请邮件
2. 点击邮件中的链接
3. 浏览器跳转到 `$BASE/auth/confirm`，自动完成账号绑定

**方式 B — OTP 登录**

1. 访问 `$BASE/login`
2. 输入供应商邮箱
3. 收取 8 位验证码并输入

**✅ 预期结果**：自动跳转到 `$BASE/dashboard`

---

### Step 2 — 供应商查看合同信息

Dashboard 应显示：
- 公司名欢迎信息
- 合同预览区域，包含 BD 填写的所有字段值
- 两个操作按钮：**"Confirm & Proceed to Sign"** 和 **"Request Changes"**

**✅ 预期结果**：字段信息与 BD 填写一致，状态为 `Pending Review`

---

### Step 2a（可选）— 供应商请求修改

如信息有误，点击 **"Request Changes"**

**✅ 预期结果**：
- `contracts.status` 回退为 `DRAFT`
- Dashboard 显示"Modification requested, waiting for BD to update"
- BD 可重新进入合同编辑页修改字段并再次推送

---

### Step 3 — 供应商确认合同

点击 **"Confirm & Proceed to Sign"**

**背后流程**：
1. `contracts.status` → `CONFIRMED`
2. 系统调用 DocuSign API 创建签署信封（附带合同字段数据）
3. `contracts.status` → `SENT`，`signature_request_id` 写入 envelope ID

**✅ 预期结果**：页面提示"Signing email sent, please check your inbox"

**验证数据库**：

| 表 | 字段 | 预期值 |
|:---|:-----|:-------|
| `contracts` | status | `SENT` |
| `contracts` | signature_request_id | DocuSign envelope UUID（非空）|

**验证邮箱**：供应商邮箱收到 DocuSign 发出的签署邮件（发件人 `dse_demo@docusign.net`）

---

### Step 4 — 供应商在 DocuSign 中签署

1. 打开 DocuSign 签署邮件
2. 点击 **"REVIEW DOCUMENT"**
3. 在签署界面完成签名（沙箱环境文档带 DEMO 水印，正常现象）
4. 点击确认提交

---

### Step 5 — Webhook 回调处理

DocuSign 签署完成后自动向 `$BASE/api/webhooks/docusign` 发送回调。

**本地环境**：DocuSign 无法回调 `localhost`，需手动模拟：

```bash
ENVELOPE_ID="从 contracts 表的 signature_request_id 字段获取"
PAYLOAD="{\"event\":\"envelope-completed\",\"data\":{\"envelopeId\":\"$ENVELOPE_ID\"}}"
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$DOCUSIGN_WEBHOOK_SECRET" -binary | base64)

curl -X POST $BASE/api/webhooks/docusign \
  -H "Content-Type: application/json" \
  -H "x-docusign-signature-1: $SIGNATURE" \
  -d "$PAYLOAD"
```

**Vercel Preview 环境**：DocuSign 自动回调，无需手动操作。

**✅ 预期响应**：
```json
{ "success": true, "processed_contract_id": "xxx-xxx" }
```

**验证数据库**：

| 表 | 字段 | 预期值 |
|:---|:-----|:-------|
| `contracts` | status | `SIGNED` |
| `contracts` | signed_at | 非空时间戳 |
| `contracts` | document_url | Storage PDF 路径 |
| `suppliers` | status | `SIGNED` |

**验证 Storage**：Supabase Storage → `signed-contracts` 桶中有 `{supplier_id}/{contract_id}.pdf`

---

### Step 6 — 验证签约后状态

1. 供应商刷新 Dashboard
2. 合同签署区域消失，显示 **"Your Properties"** 区域（当前为空状态）

**✅ 预期结果**：Dashboard 不再显示合同操作按钮

---

## 路由守卫验证

### 已登录供应商（SIGNED 状态）

| 访问地址 | 预期结果 |
|:---------|:---------|
| `$BASE/` | 重定向到 `/dashboard` |
| `$BASE/login` | 重定向到 `/dashboard` |
| `$BASE/dashboard` | 正常显示 |
| `$BASE/admin` | 重定向到 `/dashboard`（非 BD 角色）|

### 已登录供应商（PENDING_CONTRACT 状态）

| 访问地址 | 预期结果 |
|:---------|:---------|
| `$BASE/` | 重定向到 `/dashboard` |
| `$BASE/onboarding/any-id` | 重定向到 `/dashboard`（未签约）|
| `$BASE/dashboard` | 正常显示合同签署界面 |

### 已登录 BD

| 访问地址 | 预期结果 |
|:---------|:---------|
| `$BASE/` | 重定向到 `/admin/applications` |
| `$BASE/login` | 重定向到 `/admin/applications` |
| `$BASE/admin/applications` | 正常显示 |
| `$BASE/admin/suppliers` | 正常显示 |
| `$BASE/admin/invite` | 正常显示 |

### 未登录用户

| 访问地址 | 预期结果 |
|:---------|:---------|
| `$BASE/` | 正常显示 Landing Page |
| `$BASE/login` | 正常显示登录页 |
| `$BASE/dashboard` | 重定向到 `/login` |
| `$BASE/admin` | 重定向到 `/login` |

---

## 完整流程检查清单

### 环境准备
- [ ] BD 测试账号已在 Supabase 创建（`role = 'bd'`）
- [ ] 供应商测试邮箱可正常收邮件
- [ ] DocuSign 沙箱配置完成（参考 DOCUSIGN_E2E_TEST_GUIDE.md）

### 流程一：申请 → 审批
- [ ] Landing Page 表单提交成功，显示确认提示
- [ ] `applications` 表有 `PENDING` 记录
- [ ] BD 通过 OTP 登录后跳转到 `/admin/applications`
- [ ] BD 审批后 `applications.status = CONVERTED`
- [ ] `suppliers.status = PENDING_CONTRACT`，`role = supplier`
- [ ] `contracts.status = DRAFT`，`contract_fields = {}`
- [ ] 供应商邮箱收到 Supabase 邀请邮件

### BD 合同操作
- [ ] 进入供应商详情页，合同 `DRAFT` 状态可见
- [ ] 合同编辑页 Company Name 和 City 已自动预填
- [ ] 所有字段保存成功，`contract_fields` 有值
- [ ] 字段不完整时推送审阅显示验证错误
- [ ] 字段完整时推送成功，`contracts.status = PENDING_REVIEW`

### 供应商签约
- [ ] 供应商通过邮件链接或 OTP 登录成功，跳转到 Dashboard
- [ ] Dashboard 显示 BD 填写的合同字段详情
- [ ] （可选）点击 Request Changes → 合同退回 `DRAFT`
- [ ] 点击 Confirm → DocuSign 信封创建，`contracts.status = SENT`
- [ ] 供应商邮箱收到 DocuSign 签署邮件
- [ ] 在 DocuSign 中完成签署
- [ ] Webhook 回调处理成功，`contracts.status = SIGNED`
- [ ] `suppliers.status = SIGNED`
- [ ] PDF 上传到 Supabase Storage

### 路由守卫
- [ ] SIGNED 供应商访问 `/` 重定向到 `/dashboard`
- [ ] 未登录用户访问 `/dashboard` 重定向到 `/login`
- [ ] BD 登录后跳转到 `/admin/applications`
- [ ] 非 BD 用户无法访问 `/admin/*`

---

## 常见问题

**Q: BD 登录后跳转到 `/` 而不是 `/admin`**

A: `suppliers` 表中该用户的 `role` 不是 `bd`，或记录不存在。检查 0.3 步骤的 SQL 是否正确执行。

**Q: 审批时提示 "This email is already registered as a supplier"**

A: 该邮箱已在 `suppliers` 表存在记录，换一个测试邮箱，或在 Supabase 中手动清理。

**Q: 合同字段推送审阅失败，提示字段错误**

A: `commission_rate` 必须是 0–100 的数字，日期必须是 `YYYY-MM-DD` 格式，`contract_end_date` 必须晚于 `contract_start_date`。

**Q: 供应商确认合同时 DocuSign API 报错**

A: 检查 `DOCUSIGN_PRIVATE_KEY` Base64 编码是否正确（不能有换行符），以及 JWT 同意是否已授权（参考 DOCUSIGN_E2E_TEST_GUIDE.md Step 0.5）。

**Q: Webhook 返回 401 Invalid signature**

A: `DOCUSIGN_WEBHOOK_SECRET` 必须与创建信封时 eventNotification 中的 secret 一致。

**Q: 本地 Webhook 模拟时 PDF 下载失败**

A: 这是预期行为。本地没有有效的 DocuSign access token，PDF 下载步骤会跳过并记录到 `contracts.provider_metadata`，但合同和供应商状态会正常更新。完整 PDF 流程请在 Vercel Preview 环境测试。

**Q: OTP 验证码收不到**

A: 检查垃圾邮件文件夹。Supabase 免费版有发送频率限制（每小时约 4 封），等几分钟再试。
