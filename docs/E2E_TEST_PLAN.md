# E2E 测试计划

## 1. 技术选型

- **框架**: Playwright（Next.js 官方推荐）
- **运行方式**: `npx playwright test`，本地 + CI
- **Auth 策略**: Supabase 测试用户 + `storageState` 持久化，避免每次跑 OTP

---

## 2. 测试用户矩阵

| 角色               | 邮箱                                | 说明                          |
| ------------------ | ----------------------------------- | ----------------------------- |
| Admin              | `test-admin@uhomes.com`             | 加入 permissions.ts allowlist |
| BD                 | `test-bd@uhomes.com`                | 普通 BD，只看自己的 supplier  |
| Supplier（待签约） | `test-supplier-pending@example.com` | status=PENDING_CONTRACT       |
| Supplier（已签约） | `test-supplier-signed@example.com`  | status=SIGNED                 |
| 新用户             | 无账号                              | 未注册访客                    |

---

## 3. 测试用例清单

### 3.1 Landing Page（公开页面）

| #    | 用例         | 操作步骤                                | 预期结果                              |
| ---- | ------------ | --------------------------------------- | ------------------------------------- |
| L-01 | 页面加载     | 访问 `/`                                | 显示 Hero 标题、表单、导航栏          |
| L-02 | 导航到登录   | 点击 "Supplier Sign In"                 | 跳转到 `/login`                       |
| L-03 | 表单必填校验 | 直接点击 "Submit Request"               | 显示各字段错误提示                    |
| L-04 | 邮箱格式校验 | 输入 `abc` 提交                         | contact_email 显示格式错误            |
| L-05 | 成功提交     | 填写全部必填字段，点击提交              | 显示 "Application Received!" 成功卡片 |
| L-06 | 可选字段为空 | 留空 website_url，填其余字段提交        | 成功，不报错                          |
| L-07 | 再次提交     | 成功后点击 "Submit another application" | 表单重置，可再次填写                  |

**表单字段逐一测试：**

| 字段          | 输入值                | 校验规则       |
| ------------- | --------------------- | -------------- |
| company_name  | `Test Property LLC`   | 必填，≥2 字符  |
| contact_email | `test@example.com`    | 必填，合法邮箱 |
| contact_phone | `+1 555 1234`         | 必填，≥6 字符  |
| city          | `London`              | 必填，≥2 字符  |
| country       | `United Kingdom`      | 必填，≥2 字符  |
| website_url   | `https://example.com` | 可选，合法 URL |

---

### 3.2 Login 页面

| #     | 用例          | 操作步骤                             | 预期结果                                            |
| ----- | ------------- | ------------------------------------ | --------------------------------------------------- |
| LG-01 | 页面加载      | 访问 `/login`                        | 显示邮箱输入框和 "Continue with Email" 按钮         |
| LG-02 | 空邮箱提交    | 直接点击 "Continue with Email"       | 显示错误提示                                        |
| LG-03 | 发送 OTP      | 输入有效邮箱，点击按钮               | 切换到 OTP 输入步骤                                 |
| LG-04 | OTP 步骤展示  | 完成 LG-03                           | 显示 8 位 OTP 输入框、"Secure Login" 按钮、返回链接 |
| LG-05 | 返回邮箱步骤  | 点击 "Use a different email address" | 回到邮箱输入步骤                                    |
| LG-06 | OTP 不足 8 位 | 输入 `1234`                          | "Secure Login" 按钮保持 disabled                    |
| LG-07 | 错误 OTP      | 输入 `00000000` 点击 "Secure Login"  | 显示错误提示                                        |
| LG-08 | 正确 OTP 登录 | 输入正确 OTP（测试环境 mock）        | 按钮变为 "Verified"，页面刷新跳转                   |

---

### 3.3 Supplier Dashboard

**前置**: 以 Supplier 身份登录

| #    | 用例         | 操作步骤                 | 预期结果                                   |
| ---- | ------------ | ------------------------ | ------------------------------------------ |
| D-01 | 待签约状态   | 以 pending supplier 登录 | 显示合同预览区域                           |
| D-02 | 已签约状态   | 以 signed supplier 登录  | 显示 building 卡片列表                     |
| D-03 | 登出         | 点击 "Sign Out"          | 按钮变为 "Signing out..."，跳转到 `/login` |
| D-04 | 楼宇卡片点击 | 点击任意 building 卡片   | 跳转到 `/onboarding/[buildingId]`          |
| D-05 | 楼宇卡片信息 | 查看卡片                 | 显示 building_name、address、score、status |

---

### 3.4 合同预览与签署（Supplier 视角）

**前置**: 以 pending supplier 登录，合同处于 PENDING_REVIEW

| #     | 用例            | 操作步骤                              | 预期结果                                   |
| ----- | --------------- | ------------------------------------- | ------------------------------------------ |
| CS-01 | 合同字段展示    | 查看合同预览                          | 9 个字段全部显示（公司名、联系人、地址等） |
| CS-02 | 确认签署        | 点击 "Confirm & Sign"                 | 按钮 loading → 合同状态变为 SENT           |
| CS-03 | 请求修改        | 点击 "Request Changes"                | 合同状态回退到 DRAFT                       |
| CS-04 | SENT 状态展示   | 合同为 SENT                           | 显示 "Resend Signing Email" 按钮           |
| CS-05 | 重发邮件        | 点击 "Resend Signing Email"           | loading → 显示 "Signing email resent"      |
| CS-06 | SIGNED 状态展示 | 合同为 SIGNED                         | 显示绿色 "Signed" 徽章 + 下载链接          |
| CS-07 | 下载签署合同    | 点击 "Download Signed Contract (PDF)" | 新窗口打开 PDF                             |

---

### 3.5 Building Onboarding 表单

**前置**: 以 signed supplier 登录

| #     | 用例            | 操作步骤                          | 预期结果                                 |
| ----- | --------------- | --------------------------------- | ---------------------------------------- |
| ON-01 | 页面加载        | 访问 `/onboarding/[buildingId]`   | 显示返回链接、表单、评分条、Gap Report   |
| ON-02 | 返回 Dashboard  | 点击 "Back to Dashboard"          | 跳转到 `/dashboard`                      |
| ON-03 | 字段编辑        | 修改任意文本字段                  | 600ms 防抖后显示 "保存中..."，自动 PATCH |
| ON-04 | 自动保存成功    | 等待保存完成                      | "保存中..." 消失，score 更新             |
| ON-05 | 评分更新        | 填写更多字段                      | ScoreBar 进度增加                        |
| ON-06 | Gap Report 更新 | 填写缺失字段                      | Gap Report 面板中缺失项减少              |
| ON-07 | 提交审核        | 所有必填字段填完，点击 "提交审核" | 按钮 loading → 状态变为 ready_to_publish |
| ON-08 | 提交失败        | 必填字段未填完，点击 "提交审核"   | 显示缺失字段列表                         |
| ON-09 | 并发编辑保护    | 模拟 409 冲突                     | 显示冲突错误提示                         |

---

### 3.6 Admin — Applications 管理

**前置**: 以 Admin 登录

| #     | 用例             | 操作步骤                              | 预期结果                                  |
| ----- | ---------------- | ------------------------------------- | ----------------------------------------- |
| AA-01 | 页面加载         | 访问 `/admin/applications`            | 显示筛选标签 + 申请列表                   |
| AA-02 | 筛选 — ALL       | 点击 "All" 标签                       | 显示所有申请                              |
| AA-03 | 筛选 — PENDING   | 点击 "Pending" 标签                   | 只显示 PENDING 申请，标签高亮             |
| AA-04 | 筛选 — CONVERTED | 点击 "Converted" 标签                 | 只显示已转化申请                          |
| AA-05 | 筛选 — REJECTED  | 点击 "Rejected" 标签                  | 只显示已拒绝申请                          |
| AA-06 | 计数正确         | 查看标签上数字                        | 各标签计数与列表数量一致                  |
| AA-07 | 审批对话框打开   | 点击 PENDING 行的 "Approve"           | 弹出 ApproveDialog                        |
| AA-08 | 对话框内容       | 查看对话框                            | 显示公司名、邮箱、电话、城市、国家        |
| AA-09 | 选择合同类型     | 下拉选择 "Premium Promotion 2026"     | 下拉值变更                                |
| AA-10 | 取消审批         | 点击 "Cancel"                         | 对话框关闭                                |
| AA-11 | ESC 关闭         | 按 Escape 键                          | 对话框关闭                                |
| AA-12 | 点击遮罩关闭     | 点击对话框外部遮罩                    | 对话框关闭                                |
| AA-13 | 确认审批         | 选择合同类型，点击 "Confirm Approval" | loading → 申请变为 CONVERTED              |
| AA-14 | 已转化行         | 查看 CONVERTED 行                     | "Approve" 按钮 disabled，显示 "Converted" |
| AA-15 | 空列表           | 某状态无数据                          | 显示空状态提示文案                        |

---

### 3.7 Admin — Suppliers 管理

**前置**: 以 Admin 登录

| #     | 用例                    | 操作步骤                | 预期结果                                                |
| ----- | ----------------------- | ----------------------- | ------------------------------------------------------- |
| AS-01 | 页面加载                | 访问 `/admin/suppliers` | 标题 "Suppliers"，筛选栏 + 表格                         |
| AS-02 | 筛选 — ALL              | 默认 ALL 选中           | 显示全部供应商                                          |
| AS-03 | 筛选 — NEW              | 点击 "New"              | 只显示 NEW 状态供应商                                   |
| AS-04 | 筛选 — PENDING_CONTRACT | 点击 "Pending Contract" | 只显示待签约供应商                                      |
| AS-05 | 筛选 — SIGNED           | 点击 "Signed"           | 只显示已签约供应商                                      |
| AS-06 | 行点击跳转              | 点击供应商行            | 跳转到 `/admin/suppliers/[id]`                          |
| AS-07 | 表格列展示              | 查看表头                | Company, Email, Status, Buildings, Assigned BD, Created |
| AS-08 | BD 列显示               | Admin 视角              | 显示 "Assigned BD" 列                                   |
| AS-09 | 空列表                  | 某状态无数据            | 显示空状态提示                                          |

---

### 3.8 Admin — Supplier 详情

**前置**: 以 Admin 登录

| #     | 用例               | 操作步骤                     | 预期结果                             |
| ----- | ------------------ | ---------------------------- | ------------------------------------ |
| SD-01 | 页面加载           | 访问 `/admin/suppliers/[id]` | 显示基本信息、楼宇、合同             |
| SD-02 | 返回列表           | 点击 "← Back to Suppliers"   | 跳转到 `/admin/suppliers`            |
| SD-03 | 状态徽章           | 查看状态                     | 正确颜色的 status badge              |
| SD-04 | BD 分配下拉        | Admin 视角                   | 显示 BD 分配下拉框                   |
| SD-05 | 更换 BD            | 下拉选择其他 BD              | loading → 刷新页面，BD 变更          |
| SD-06 | 取消分配           | 选择 "Unassigned"            | bd_user_id 清空                      |
| SD-07 | 楼宇表格           | 有关联楼宇                   | 显示 Name, Address, Status, Score    |
| SD-08 | 无楼宇             | 无关联楼宇                   | 显示空状态文案                       |
| SD-09 | 合同表格           | 有合同                       | 显示 Status, Action, Created         |
| SD-10 | DRAFT 合同操作     | 合同为 DRAFT                 | 显示 "Edit Contract" 链接            |
| SD-11 | SENT 合同操作      | 合同为 SENT                  | 显示 ResendButton                    |
| SD-12 | SIGNED 合同操作    | 合同为 SIGNED                | 显示 "Download Signed Contract" 链接 |
| SD-13 | 无合同             | 无合同                       | 显示 "No contracts yet"              |
| SD-14 | Edit Contract 跳转 | 点击 "Edit Contract"         | 跳转到 `/admin/contracts/[id]/edit`  |
| SD-15 | Resend 签署邮件    | 点击 "Resend Email"          | loading → "Signing email resent"     |

---

### 3.9 Admin — 合同编辑

**前置**: 以 Admin/BD 登录，合同为 DRAFT

| #     | 用例           | 操作步骤                             | 预期结果                             |
| ----- | -------------- | ------------------------------------ | ------------------------------------ |
| CE-01 | 页面加载       | 访问编辑页                           | 显示返回链接、表单、Save/Push 按钮   |
| CE-02 | 返回详情       | 点击 "← Back to Supplier"            | 跳转到供应商详情                     |
| CE-03 | 自动预填       | 页面加载                             | company_name、city 自动填充          |
| CE-04 | 编辑全部字段   | 逐一修改 9 个字段                    | 各字段值正确更新                     |
| CE-05 | 保存           | 点击 "Save"                          | "Saving..." → 成功                   |
| CE-06 | 提交审核       | 填满必填字段，点击 "Push for Review" | "Pushing..." → 状态变 PENDING_REVIEW |
| CE-07 | 空字段提交审核 | 必填字段留空，点击 "Push for Review" | 显示字段级错误                       |
| CE-08 | 非 DRAFT 只读  | 合同为 PENDING_REVIEW                | 所有字段 disabled，无按钮            |

**表单字段逐一测试：**

| 字段                 | 类型     | 测试输入                 |
| -------------------- | -------- | ------------------------ |
| partner_company_name | text     | `Test Corp`              |
| partner_contact_name | text     | `John Doe`               |
| partner_address      | text     | `123 Main St`            |
| partner_city         | text     | `London`                 |
| partner_country      | text     | `UK`                     |
| commission_rate      | number   | `15.5`（0-100 范围）     |
| contract_start_date  | date     | `2026-03-01`             |
| contract_end_date    | date     | `2027-03-01`             |
| covered_properties   | textarea | `Building A, Building B` |

---

### 3.10 Admin — 邀请供应商

**前置**: 以 Admin/BD 登录

| #     | 用例         | 操作步骤                        | 预期结果                      |
| ----- | ------------ | ------------------------------- | ----------------------------- |
| IN-01 | 页面加载     | 访问 `/admin/invite`            | 显示邀请表单                  |
| IN-02 | 必填校验     | 直接提交                        | email、company_name 显示错误  |
| IN-03 | 邮箱格式校验 | 输入 `abc` 提交                 | 邮箱字段显示格式错误          |
| IN-04 | 成功邀请     | 填写 email + company_name，提交 | 绿色成功提示，表单清空        |
| IN-05 | 可选字段     | 只填必填字段                    | 成功，phone/city/website 可空 |
| IN-06 | 全字段填写   | 填写所有 5 个字段               | 成功                          |

---

### 3.11 BD 角色权限测试

**前置**: 以普通 BD 登录（非 Admin）

| #     | 用例             | 操作步骤                     | 预期结果                                   |
| ----- | ---------------- | ---------------------------- | ------------------------------------------ |
| BD-01 | 侧边栏           | 查看导航                     | 只显示 "My Suppliers" 和 "Invite Supplier" |
| BD-02 | 无 Applications  | 访问 `/admin/applications`   | 重定向到 `/admin/suppliers`                |
| BD-03 | 供应商列表标题   | 访问 `/admin/suppliers`      | 标题 "My Suppliers"                        |
| BD-04 | 只看自己的       | 查看列表                     | 只显示 bd_user_id 匹配的供应商             |
| BD-05 | 无 BD 分配下拉   | 访问供应商详情               | 不显示下拉框，显示 BD 名称文本             |
| BD-06 | 无权查看他人     | 直接访问其他 BD 的供应商     | 404                                        |
| BD-07 | 无权编辑他人合同 | 直接访问其他 BD 供应商的合同 | 404                                        |
| BD-08 | 邀请自动分配     | BD 邀请供应商                | 新供应商 bd_user_id = 该 BD                |

---

### 3.12 导航与响应式

| #      | 用例           | 操作步骤         | 预期结果                                 |
| ------ | -------------- | ---------------- | ---------------------------------------- |
| NAV-01 | Admin 侧边栏   | 查看 Admin 导航  | Applications, Suppliers, Invite Supplier |
| NAV-02 | 活跃链接高亮   | 在各页面切换     | 当前页对应链接高亮                       |
| NAV-03 | 移动端菜单     | viewport < 768px | 显示汉堡菜单按钮                         |
| NAV-04 | 打开移动菜单   | 点击汉堡按钮     | 侧边栏滑出，遮罩层出现                   |
| NAV-05 | 关闭移动菜单   | 点击 X 或遮罩    | 侧边栏收起                               |
| NAV-06 | 移动端导航跳转 | 点击菜单中链接   | 跳转到对应页面，菜单自动关闭             |
| NAV-07 | 角色标签       | Admin 登录       | Header 显示 "Admin"                      |
| NAV-08 | 角色标签       | BD 登录          | Header 显示 "BD"                         |

---

### 3.13 未登录保护

| #       | 用例              | 操作步骤                    | 预期结果          |
| ------- | ----------------- | --------------------------- | ----------------- |
| AUTH-01 | Dashboard 未登录  | 访问 `/dashboard`           | 重定向到 `/login` |
| AUTH-02 | Onboarding 未登录 | 访问 `/onboarding/xxx`      | 重定向到 `/login` |
| AUTH-03 | Admin 未登录      | 访问 `/admin/suppliers`     | 重定向到 `/login` |
| AUTH-04 | API 未登录        | POST `/api/admin/assign-bd` | 401               |

---

## 4. 实施优先级

### P0 — 核心流程（第一轮）

1. Landing Page 表单提交（L-03 ~ L-07）
2. 登录流程（LG-01 ~ LG-08）
3. 合同编辑全字段 + 提交审核（CE-01 ~ CE-08）
4. Applications 审批全流程（AA-07 ~ AA-13）
5. 未登录保护（AUTH-01 ~ AUTH-04）

### P1 — 角色与权限（第二轮）

6. BD 权限隔离（BD-01 ~ BD-08）
7. Supplier Dashboard 各状态（D-01 ~ D-05）
8. 合同状态流转（CS-01 ~ CS-07）
9. BD 分配功能（SD-04 ~ SD-06）

### P2 — 完整覆盖（第三轮）

10. Onboarding 表单编辑保存（ON-01 ~ ON-09）
11. Supplier 列表筛选（AS-01 ~ AS-09）
12. 邀请供应商（IN-01 ~ IN-06）
13. 导航与响应式（NAV-01 ~ NAV-08）
14. Supplier 详情全部板块（SD-07 ~ SD-15）

---

## 5. 测试用例统计

| 模块              | 用例数  |
| ----------------- | ------- |
| Landing Page      | 7       |
| Login             | 8       |
| Dashboard         | 5       |
| 合同状态/签署     | 7       |
| Onboarding 表单   | 9       |
| Applications 管理 | 15      |
| Suppliers 管理    | 9       |
| Supplier 详情     | 15      |
| 合同编辑          | 8       |
| 邀请供应商        | 6       |
| BD 权限           | 8       |
| 导航/响应式       | 8       |
| Auth 保护         | 4       |
| **合计**          | **109** |
