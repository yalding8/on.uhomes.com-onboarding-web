# P0 供应商签约全流程 — E2E 测试指南

## 前置条件

| 项目                    | 要求                                                  |
| :---------------------- | :---------------------------------------------------- |
| 线上环境                | https://on-uhomes-com-onboarding-web.vercel.app/      |
| 本地环境                | `npm run dev` → http://localhost:3000                 |
| 测试邮箱                | 准备一个能收邮件的真实邮箱（Supabase OTP 会发验证码） |
| ADMIN_SECRET            | 查看 `.env.local` 中的 `ADMIN_SECRET` 值              |
| OPENSIGN_WEBHOOK_SECRET | 本地测试设为 `TEST_SECRET_MOCK`                       |

> 以下用 `$BASE` 代表你的测试地址（线上或 localhost:3000）。

---

## Step 1：供应商提交申请

打开浏览器访问 `$BASE/`，你会看到 Landing Page。

右侧表单填写：

| 字段          | 示例值              | 必填 |
| :------------ | :------------------ | :--- |
| Company Name  | Test Housing Inc    | ✅   |
| Work Email    | 你的真实邮箱        | ✅   |
| Contact Phone | +1 555 0000         | ✅   |
| City          | Toronto             | ✅   |
| Country       | Canada              | ✅   |
| Website URL   | https://example.com | 可选 |

点击 "Submit Request"。

**预期结果**：页面显示绿色 ✅ "Application Received!"

**验证**：去 Supabase Dashboard → `applications` 表，能看到一条 `status = PENDING` 的记录。记下这条记录的 `id`（UUID 格式）。

---

## Step 2：BD 审批（模拟）

打开终端，执行：

```bash
curl -X POST $BASE/api/admin/approve-supplier \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: 你的ADMIN_SECRET值" \
  -d '{"application_id": "从Step1拿到的UUID"}'
```

**预期结果**：

```json
{
  "success": true,
  "message": "Supplier provisioned and invitation sent",
  "supplier_id": "xxx-xxx"
}
```

**后台变化**：

- `applications` 表：该记录 status 变为 `CONVERTED`
- `suppliers` 表：新增一条 `status = PENDING_CONTRACT` 的记录
- `contracts` 表：新增一条 `status = SENT` 的合同记录
- 你的邮箱会收到一封 Supabase 邀请邮件（标题类似 "You have been invited"）

---

## Step 3：供应商首次登录

**方式 A — 点邮件链接（推荐）**

打开邮箱，找到 Supabase 发的邀请邮件，点击链接。浏览器会跳转到 `$BASE/auth/confirm`，自动完成账号绑定，然后重定向到 `/dashboard`。

**方式 B — 手动 OTP 登录**

1. 访问 `$BASE/login`
2. 输入 Step 1 中填写的邮箱
3. 点击 "Continue with Email"
4. 去邮箱查收 6 位验证码
5. 输入验证码，点击 "Secure Login"

**预期结果**：自动跳转到 `/dashboard`。

---

## Step 4：查看 Dashboard（PENDING_CONTRACT 状态）

登录后你会看到：

- 顶部欢迎区：显示公司名
- 下方合同区域：
  - 标题 "Collaboration Agreement"
  - 状态标签 "Pending Signature"
  - 两个按钮：
    - "View Original Contract" — 打开 mock 签署链接（外部页面，不用管）
    - **"Sign Contract (Mock)"** — 这是关键按钮

---

## Step 5：模拟签署合同

点击 "Sign Contract (Mock)" 按钮。

**背后发生了什么**：

1. 前端提取合同中的 `signature_request_id`
2. 调用 `/api/webhooks/opensign`，带上 `x-opensign-signature: TEST_SECRET_MOCK`
3. Webhook 处理：合同 status → `SIGNED`，supplier status → `SIGNED`
4. 页面自动刷新

**预期结果**：页面刷新后，Dashboard 变为 SIGNED 状态视图：

- 合同签署区域消失
- 出现 "Your Properties" 区域（目前显示 "No properties yet"，因为还没有 building 数据）

---

## Step 6：验证中间件路由守卫

SIGNED 状态下测试以下路由行为：

| 访问地址          | 预期行为              |
| :---------------- | :-------------------- |
| `$BASE/`          | 重定向到 `/dashboard` |
| `$BASE/login`     | 重定向到 `/dashboard` |
| `$BASE/dashboard` | 正常显示              |

退出登录后（清除 cookies 或用隐身窗口）：

| 访问地址          | 预期行为              |
| :---------------- | :-------------------- |
| `$BASE/`          | 正常显示 Landing Page |
| `$BASE/login`     | 正常显示登录页        |
| `$BASE/dashboard` | 重定向到 `/login`     |

---

## 完整流程检查清单

- [ ] Landing Page 表单提交成功
- [ ] applications 表有 PENDING 记录
- [ ] BD 审批 curl 返回 success
- [ ] applications 状态变为 CONVERTED
- [ ] suppliers 表有 PENDING_CONTRACT 记录
- [ ] contracts 表有 SENT 记录
- [ ] 收到 Supabase 邀请邮件
- [ ] 通过邮件链接或 OTP 成功登录
- [ ] Dashboard 显示合同签署界面
- [ ] 点击 Mock Sign 后页面刷新
- [ ] supplier 状态变为 SIGNED
- [ ] contract 状态变为 SIGNED
- [ ] Dashboard 显示 "Your Properties" 空状态
- [ ] 路由守卫重定向行为正确

---

## 常见问题

**Q: curl 审批返回 401 Unauthorized**
A: 检查 `x-admin-secret` header 的值是否和 `.env.local` 中的 `ADMIN_SECRET` 一致。线上环境需要在 Vercel 环境变量中配置。

**Q: Mock Sign 点击后没反应**
A: 检查 `OPENSIGN_WEBHOOK_SECRET` 环境变量是否设为 `TEST_SECRET_MOCK`。线上环境同样需要在 Vercel 配置。

**Q: 邮件收不到验证码**
A: 检查垃圾邮件文件夹。Supabase 免费版有邮件发送频率限制（每小时 4 封），等几分钟再试。

**Q: 登录后跳转到 `/` 而不是 `/dashboard`**
A: 说明 suppliers 表中没有该用户的记录，或 status 不是 PENDING_CONTRACT/SIGNED。检查 Step 2 是否成功执行。
