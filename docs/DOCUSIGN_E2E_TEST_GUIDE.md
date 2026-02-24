# DocuSign 合同签署全流程 — E2E 手动测试指南

## 第一部分：DocuSign 开发者沙箱注册与配置

### Step 0.1：注册 DocuSign 开发者账号

1. 访问 [https://developers.docusign.com/](https://developers.docusign.com/)
2. 点击右上角 "Get Started" 或 "My Account"，选择 "Create Account"
3. 用你的工作邮箱注册（免费，不过期，沙箱环境有企业级功能）
4. 注册完成后会自动进入 demo 环境：`https://demo.docusign.net`

> 沙箱发出的文档带有 "DEMO" 水印，不具法律效力，放心测试。

### Step 0.2：创建 Integration Key（App）

1. 登录 `https://admindemo.docusign.net`
2. 左侧菜单 → "Apps and Keys"
3. 点击 "ADD APP AND INTEGRATION KEY"
4. 输入 App 名称（如 `uhomes-onboarding-dev`）
5. 记下生成的 **Integration Key**（即 `DOCUSIGN_CLIENT_ID`）
4f42fdd9-5017-4d25-8a22-38d53ae98b0c

### Step 0.3：生成 RSA 密钥对

在刚创建的 App 编辑页面：

1. 找到 "Service Integration" 区域
2. 点击 "GENERATE RSA" 按钮
3. 弹窗会显示 Public Key 
和 **Private Key**
4. **立即复制 Private Key 并保存**（离开页面后无法再查看）


5. 将 Private Key 转为 Base64 编码：

```bash
# 假设你把私钥保存到了 docusign_private.pem
cat docusign_private.pem | base64 | tr -d '\n'
```

输出的 Base64 字符串就是 `DOCUSIGN_PRIVATE_KEY` 的值。

nVCK0hHbDRNUDdMZWxHMzMrdzBhZTBzCnNJZ1FRV0JXYlorRy8yRUlSazhOQkVWcDRXYXB2VDhoN2tsN05FbVNnRk9wK0FscXZvVlM0cWpZYWIyeGFiWWgKVmM0a1hwQU5UZU5jS2xGRHdzaG82QStaNVlUekI4WUE1N0Y4cWx1eGtwSUI1NFQyb3dxVWJ5VTE3Q2p4dVprYwpBVHJ4MExBZ0pISUlyamMwZE9Ob1pHMzNBSFpJSU0vSklYU25PSkFRdEtpSHFSci9ST1VSRC9zYW1NNkM2ODhuCndyM0ZzMm1NbjYwSCsxYlI1S2dLbkYvZkF4WTgyRVpudmxWNzcweGNVdHpDd2ZadG5aeWtnRC9YeDRjV0tTdS8Ka3lTdUhJT3BPazdMVmlqeDI2T3RldEs2VUhrNFQzd2N2WHdVR3dJREFRQUJBb0lCQUJvSlNpYnZYRURzK2R4bAo1TitUT0EzdDBoMG12U0VyMUNBb1IzZDh3R2FSS0ZTSiszaVg2ZWxnZG1IT2xPZTdlT1VsSldzTUg2ajU4bEdGCkI4M3RvVDZMUHdSc1p1b2RrSW15d2NvWExoYy9VTGxrRlBneW1rYW81RTZDZGdydnRBLzJiNC9saVFpQjdJbWkKYXNwSW5pMzNWVjVRMzNjSjk0ZmloNUdkRTNsTWdrSzRQU2VUcHIxUElJdzY5Vll1dTB5QnVXYnpRVXZLazhtcApGaVZsN2V3QnN4czRzR2pFc2R1YTRWMnZ6MHUvclJCSGhQajhtN3FrSEczMmxKa3JxYkxrZzcwRjgrTlNmd0YzClc5aVdtcFpwd0N2L2JXNnBpVy9JL2ZpMnBiN0lzcExvRTY1Rms3Um9KZ050RWtRUEFnT0VPa0pXV2JydTF5ZjgKVmZaU2JFRUNnWUVBK3JvYVBzY1psR0hEUXQxUWZ5SHJ0RW5hR0JERTgvUFBEOVRBK3dvT0NsQjRaQTYvOHlmMwpHU3JJdlF1NHhFcnpKUE85SHZXa3hTemMwT3YwblZPaE0rTnZGeW1BUmtzcytnQUZGYUZVZThxRThtSFh6aW81CmtWTkFlWEpBZUF1bWxBeUJKZklCajJNOXlUeStmT2UweTBSRTJ4V0p3UUdiL1VhU25jSWNPRnNDZ1lFQXRzUlkKcW1VQ3BiQm5EQnF2Vy85UXJ5d1l0OFQ4ZFhCc3ZXMUVuWDh1anBGSFlWSU94MDJCKzlIdUhGUjR4Zy9MYTRGaApYMGFUaWJKZVo5U1FleGpzMlZxYThYSnMyR3o1V2lnRkJaT1pYN2pQait3Q0ZYS3hBRXVIdUl6K2RrUjZuMUNGCk01VW5HR0xoL1BPKzZLK1pDT3BTRHQ5YWova2p1VkJqWVk2NFgwRUNnWUVBNHVDYU5TcG16QzAyeW4rSGdyTUkKSFdraWo5cEV6bGRWakFiQjVhZndrb2JFbWczNnhhWHBZLzJpRGViWWQ4ODJlNzZPNkwveExIYnZEYUltQkdNVApvT2R4cyt6YTVVRExYeUc3ZUJvM1g1a2ZlbER0UGVKWm0xWlJKbFFyWURWeXM4OG80bFE5OHlralZNREJ3amJOCkU0NGdISHM5M3NkOUJzL2doaDZLK0xjQ2dZQVdObVRFU01SNm1LYmRmTHpGUkpGc3lNSTBTM2VYV2xPTTdpUEIKdEh4WERXY01kK21kNVZpZjMxSytGTEljK0R4ejAyU2ZMTGV2cTRMM3dZalJ2U1RFQWRRRTlqQXVXWWd3b2Q2QwpYLzdxK0U0Wm9zaGFEUGRnSHMzZTZ4dmVDZEtSWERya0d3T0dYall6QlBpMTFPbVhnTXI2VGNEMjhJT2IrUjRxCjlDcUtRUUtCZ0F6d2dJdjQ0cVgzWUlxZ2Q4bkdMQVdBVjRTZm45S1FMaXBaWXliOEVEYzRmMkVsUlBzeFhVNVMKRCtNM3RxRlJBcHJrdXhQenNmYmpxRk1DT2creUtNTTl0QzZLc2p0eENuWk5Na1dVWngwQkJLem5XVVVrazdmZApacUtrYVJVaW9qelJWUTliRmpmS3JxMmlHdE9qcVhzT0x1NjdGL2FRdi9JaFZka1Y2aDczCi0tLS0tRU5EIFJTQSBQUklWQVRFIEtFWS0tLS0t% 

### Step 0.4：获取 User ID 
be99cebc-cfc0-444a-8b62-eba1b6d9b2b8

 和 Account ID

 64077115-dd56-4271-a4a5-8b4eb24adc89

在 "Apps and Keys" 页面顶部可以看到：

- **API Account ID** → 这就是 `DOCUSIGN_ACCOUNT_ID`
- **User ID**（在 "My Account Information" 区域）→ 这就是 `DOCUSIGN_USER_ID`

### Step 0.5：授予 JWT 同意（一次性操作）

在浏览器中访问以下 URL（替换 `{CLIENT_ID}` 为你的 Integration Key）：
4f42fdd9-5017-4d25-8a22-38d53ae98b0c

ur\
```
https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={CLIENT_ID}&redirect_uri=https://httpbin.org/get
```
https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=4f42fdd9-5017-4d25-8a22-38d53ae98b0c&redirect_uri=https://httpbin.org/get

1. 登录你的 DocuSign 沙箱账号
2. 点击 "Accept" 授予同意
3. 页面会跳转到 httpbin.org，看到 JSON 响应即表示成功
4. 这个操作只需做一次，除非有人手动撤销了同意

### Step 0.6：创建合同模板

1. 登录 `https://demo.docusign.net`
2. 点击 "Templates" → "CREATE TEMPLATE"
3. 上传你的合同 PDF 模板文件
4. 添加一个 Signer 角色（Role Name 设为 `signer`）
5. 在模板中添加以下 Text Tab 字段（tabLabel 必须精确匹配）：

| tabLabel               | 说明         |
| :--------------------- | :----------- |
| `partner_company_name` | 合作方公司名 |
| `partner_contact_name` | 联系人姓名   |
| `partner_address`      | 地址         |
| `partner_city`         | 城市         |
| `partner_country`      | 国家         |
| `commission_rate`      | 佣金比例     |
| `contract_start_date`  | 合同开始日期 |
| `contract_end_date`    | 合同结束日期 |
| `covered_properties`   | 覆盖房源     |

6. 保存模板，记下 **Template ID**（在模板详情页 URL 中可以看到）→ 这就是 `DOCUSIGN_TEMPLATE_ID`

> 如果暂时没有正式合同 PDF，可以随便上传一个测试 PDF，把 Text Tab 拖到页面上即可。

### Step 0.7：配置 Webhook HMAC Secret

我们的代码使用 envelope-level eventNotification（在创建信封时附带），不需要在 DocuSign Connect 中全局配置 Webhook。

但你需要自己生成一个 HMAC Secret 用于签名验证：

```bash
# 生成一个随机 secret
openssl rand -hex 32
```

输出的字符串就是 `DOCUSIGN_WEBHOOK_SECRET` 的值。

> 注意：这个 secret 需要和代码中 `createEnvelope` 时传入 eventNotification 的 HMAC secret 一致。如果代码中使用的是环境变量 `DOCUSIGN_WEBHOOK_SECRET`，那就保持一致即可。

---

## 第二部分：配置环境变量

### Step 1：更新 `.env.local`

在 `on.uhomes.com-onboarding-web/.env.local` 中添加以下变量：

```env
# DocuSign 配置
DOCUSIGN_CLIENT_ID=你的Integration_Key
DOCUSIGN_USER_ID=你的User_ID
DOCUSIGN_ACCOUNT_ID=你的API_Account_ID
DOCUSIGN_PRIVATE_KEY=Base64编码的RSA私钥
DOCUSIGN_AUTH_SERVER=account-d.docusign.com
DOCUSIGN_TEMPLATE_ID=你的模板ID
DOCUSIGN_WEBHOOK_SECRET=你生成的HMAC_Secret
```

> `DOCUSIGN_AUTH_SERVER` 沙箱固定为 `account-d.docusign.com`，生产环境为 `account.docusign.com`。

### Step 2：创建 Supabase Storage 存储桶

参考 README.md 中的 "Supabase Storage 配置" 章节，在 Supabase Dashboard 创建 `signed-contracts` 存储桶。

### Step 3：执行数据库 Migration

确保已执行 DocuSign 相关的 migration：

```bash
# 如果使用 Supabase CLI
supabase db push

# 或者手动在 Supabase SQL Editor 中执行
# supabase/migrations/20260224100000_docusign_contract_signing.sql
```

---

## 第三部分：全流程 E2E 测试

> 以下用 `$BASE` 代表你的测试地址（`http://localhost:3000` 或 Vercel Preview URL）。

### Step 4：供应商提交申请

同 [P0 E2E 测试指南](./E2E_TEST_GUIDE.md) Step 1，在 Landing Page 提交申请表单。

记下 `applications` 表中新记录的 `id`。

### Step 5：BD 审批供应商

```bash
curl -X POST $BASE/api/admin/approve-supplier \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: 你的ADMIN_SECRET值" \
  -d '{"application_id": "Step4拿到的UUID"}'
```

**验证数据库变化**：

| 表             | 字段                 | 预期值                         |
| :------------- | :------------------- | :----------------------------- |
| `applications` | status               | `CONVERTED`                    |
| `suppliers`    | status               | `PENDING_CONTRACT`             |
| `contracts`    | status               | **`DRAFT`**（不再是旧的 SENT） |
| `contracts`    | signature_provider   | `DOCUSIGN`                     |
| `contracts`    | embedded_signing_url | `null`                         |
| `contracts`    | signature_request_id | `null`                         |

> 关键区别：旧流程合同直接是 SENT 状态，新流程是 DRAFT，需要 BD 先填写合同字段。

### Step 6：BD 编辑合同字段

1. BD 登录后访问 `$BASE/admin/suppliers/{supplier_id}`
2. 找到合同区域，点击"编辑合同"链接
3. 跳转到 `$BASE/admin/contracts/{contract_id}/edit`

**验证页面**：

- 表单应自动预填 `partner_company_name`（来自供应商公司名）和 `partner_city`（来自供应商城市）
- 所有字段可编辑（DRAFT 状态）

填写所有字段：

| 字段                 | 示例值                     |
| :------------------- | :------------------------- |
| partner_company_name | Test Housing Inc（已预填） |
| partner_contact_name | John Smith                 |
| partner_address      | 123 Main Street            |
| partner_city         | Toronto（已预填）          |
| partner_country      | Canada                     |
| commission_rate      | 15                         |
| contract_start_date  | 2026-03-01                 |
| contract_end_date    | 2027-02-28                 |
| covered_properties   | All Toronto properties     |

点击"保存"按钮。

**验证**：`contracts` 表的 `contract_fields` JSONB 列应包含上述所有字段值。

### Step 7：BD 推送审阅

在合同编辑页面，点击"推送审阅"按钮。

**验证**：

| 表          | 字段   | 预期值           |
| :---------- | :----- | :--------------- |
| `contracts` | status | `PENDING_REVIEW` |

> 如果有必填字段未填写，推送会失败并提示具体缺失字段。

### Step 8：供应商查看合同

1. 供应商登录（OTP 或邮件链接）
2. 访问 `$BASE/dashboard`

**验证页面**：

- 合同预览组件显示所有 9 个字段的值
- 显示两个按钮："确认并进入签署" 和 "请求修改"

### Step 8a（可选）：供应商请求修改

点击"请求修改"按钮。

**验证**：

- `contracts` 表 status 回退为 `DRAFT`
- BD 可以重新编辑字段并再次推送审阅
- 回到 Step 6 重新走一遍

### Step 9：供应商确认合同

点击"确认并进入签署"按钮。

**背后发生了什么**：

1. 合同状态 → `CONFIRMED`
2. 系统调用 DocuSign API 创建信封（使用模板 + 动态字段）
3. 成功后合同状态 → `SENT`，`signature_request_id` 存储 DocuSign envelope_id

**验证数据库**：

| 表          | 字段                 | 预期值                 |
| :---------- | :------------------- | :--------------------- |
| `contracts` | status               | `SENT`                 |
| `contracts` | signature_request_id | DocuSign envelope UUID |
| `contracts` | signature_provider   | `DOCUSIGN`             |

**验证邮箱**：供应商邮箱应收到一封来自 DocuSign 的签署邮件（沙箱环境发件人为 `dse_demo@docusign.net`）。

**验证 Dashboard**：页面应显示"签署邮件已发送，请查收邮箱"提示。

### Step 10：供应商在 DocuSign 中签署

1. 打开供应商邮箱中的 DocuSign 签署邮件
2. 点击 "REVIEW DOCUMENT"
3. 在 DocuSign 签署界面中完成签署（点击签名区域 → 确认）
4. 签署完成

> 沙箱环境的文档会带有 "DEMO" 水印，这是正常的。

### Step 11：验证 Webhook 回调

签署完成后，DocuSign 会向 `$BASE/api/webhooks/docusign` 发送 `envelope-completed` 事件。

**本地开发环境注意**：DocuSign 无法直接回调 `localhost`。你有两个选择：

**方案 A：使用 ngrok 暴露本地服务**

```bash
ngrok http 3000
```

拿到 ngrok 的公网 URL（如 `https://abc123.ngrok.io`），然后需要确保 `createEnvelope` 中的 eventNotification URL 指向这个地址。可以临时设置一个环境变量：

```env
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
```

**方案 B：手动模拟 Webhook 回调**

如果不想用 ngrok，可以在签署完成后手动 curl 模拟 webhook：

```bash
# 1. 先从 contracts 表拿到 signature_request_id（即 envelope_id）
ENVELOPE_ID="从数据库拿到的envelope_id"

# 2. 构造 payload
PAYLOAD='{"event":"envelope-completed","data":{"envelopeId":"'$ENVELOPE_ID'"}}'

# 3. 计算 HMAC 签名
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "你的DOCUSIGN_WEBHOOK_SECRET" -binary | base64)

# 4. 发送请求
curl -X POST $BASE/api/webhooks/docusign \
  -H "Content-Type: application/json" \
  -H "x-docusign-signature-1: $SIGNATURE" \
  -d "$PAYLOAD"
```

**预期响应**：

```json
{
  "success": true,
  "processed_contract_id": "xxx-xxx"
}
```

**验证数据库**：

| 表          | 字段         | 预期值               |
| :---------- | :----------- | :------------------- |
| `contracts` | status       | `SIGNED`             |
| `contracts` | signed_at    | 非空时间戳           |
| `contracts` | document_url | Storage 中的 PDF URL |
| `suppliers` | status       | `SIGNED`             |

**验证 Storage**：Supabase Storage → `signed-contracts` 桶中应有 `{supplier_id}/{contract_id}.pdf` 文件。

> 方案 B 模拟 webhook 时，PDF 下载步骤会失败（因为本地没有真正的 DocuSign access token 去下载），但合同和供应商状态更新是正常的。错误会记录在 `contracts.provider_metadata` 中。

### Step 12：验证签署后状态

1. 供应商刷新 Dashboard
2. 合同区域应显示"签署完成"状态 + PDF 下载链接
3. BD 查看供应商详情页，应显示合同状态为 SIGNED + 下载链接

---

## 第四部分：Vercel Preview 环境测试

如果要在 Vercel Preview 上测试完整流程（推荐，因为 DocuSign webhook 可以直接回调）：

1. 在 Vercel 项目设置中添加所有 `DOCUSIGN_*` 环境变量
2. 设置 `NEXT_PUBLIC_APP_URL` 为 Preview 部署的 URL
3. 提交 PR，等待 Preview 部署完成
4. 从 Step 4 开始走完整流程
5. Step 10 签署完成后，DocuSign 会自动回调 Preview URL 的 webhook 端点

---

## 完整流程检查清单

- [ ] DocuSign 沙箱账号注册完成
- [ ] Integration Key 创建 + RSA 密钥对生成
- [ ] JWT 同意授权完成
- [ ] 合同模板创建 + 9 个 Text Tab 配置
- [ ] `.env.local` 7 个 DocuSign 变量配置完成
- [ ] `signed-contracts` Storage 存储桶创建
- [ ] DB Migration 执行完成
- [ ] BD 审批后合同状态为 DRAFT（非 SENT）
- [ ] BD 编辑合同字段 → 保存成功
- [ ] BD 推送审阅 → 状态变为 PENDING_REVIEW
- [ ] 供应商 Dashboard 显示合同字段详情 + 操作按钮
- [ ] （可选）供应商请求修改 → 状态回退 DRAFT
- [ ] 供应商确认 → DocuSign 信封创建成功 → 状态 SENT
- [ ] 供应商邮箱收到 DocuSign 签署邮件
- [ ] 在 DocuSign 中完成签署
- [ ] Webhook 回调处理成功 → 合同 SIGNED + 供应商 SIGNED
- [ ] PDF 上传到 Supabase Storage
- [ ] Dashboard 显示签署完成 + 下载链接

---

## 常见问题

**Q: 供应商确认合同时返回 502 DocuSign API error**
A: 检查以下几点：

1. `DOCUSIGN_PRIVATE_KEY` 是否正确 Base64 编码（不能有换行符）
2. JWT 同意是否已授权（Step 0.5）
3. `DOCUSIGN_USER_ID` 和 `DOCUSIGN_ACCOUNT_ID` 是否正确
4. 沙箱 Auth Server 应为 `account-d.docusign.com`

**Q: Webhook 返回 401 Invalid signature**
A: `DOCUSIGN_WEBHOOK_SECRET` 的值必须和创建信封时 eventNotification 中使用的 secret 一致。检查环境变量是否正确设置。

**Q: 签署完成但 Webhook 没有回调**
A: 本地开发环境 DocuSign 无法回调 localhost。使用 ngrok 或手动模拟 webhook（Step 11 方案 B）。Vercel Preview 环境不存在此问题。

**Q: PDF 下载失败但合同状态已更新为 SIGNED**
A: 这是设计行为。PDF 下载/上传是非核心操作，失败不影响状态更新。错误详情记录在 `contracts.provider_metadata` 中。可以后续手动重试。

**Q: DocuSign 签署邮件收不到**
A: 检查垃圾邮件文件夹。沙箱环境发件人是 `dse_demo@docusign.net`。确保供应商邮箱地址正确（来自 `suppliers.contact_email`）。

**Q: 合同编辑页面字段不可编辑**
A: 只有 DRAFT 状态的合同可以编辑。检查 `contracts.status` 是否为 DRAFT。如果是 PENDING_REVIEW，需要供应商先"请求修改"退回。
