# Full Flow E2E Test Guide / 全流程端到端测试指南

> Bilingual guide for manual testers and automation reference.
> 中英双语指南，供手动测试人员和自动化测试参考。

---

## Overview / 概览

This guide covers the complete onboarding lifecycle:
本指南覆盖完整的 Onboarding 生命周期：

```
Application → BD Approval → Contract Editing → DocuSign Signing
→ Building Creation → AI Extraction → Building Onboarding → Submission
申请 → BD 审批 → 合同编辑 → DocuSign 签约
→ 楼盘创建 → AI 提取 → 楼盘数据填写 → 提交上架
```

### Roles / 角色

| Role / 角色    | Description / 说明                                                     |
| :------------- | :--------------------------------------------------------------------- |
| **Guest**      | Unauthenticated visitor / 未登录访客                                   |
| **Admin BD**   | `ning.ding@uhomes.com`, `abby.zhang@uhomes.com`, `lei.tian@uhomes.com` |
| **Regular BD** | BD staff with `role: supplier` and BD permissions / 普通 BD 员工       |
| **Supplier**   | Approved partner (`PENDING_CONTRACT` or `SIGNED`) / 已审批供应商       |

### Prerequisites / 前置条件

- Node 22 LTS (`fnm use`)
- Main app running: `npm run dev` (port 3000)
- Worker running: `cd worker && npx tsx src/index.ts` (port 3001) — for AI extraction tests
- DocuSign sandbox account configured (see `docs/DOCUSIGN_E2E_TEST_GUIDE.md`)
- Supabase project accessible

---

## Phase 1: Supplier Application / 供应商申请

**Actor:** Guest / 访客
**Page:** `/` (Landing Page)

### TC-1.1: Submit valid application / 提交有效申请

| Step / 步骤 | Action / 操作                                              | Expected / 预期结果                                               |
| :---------- | :--------------------------------------------------------- | :---------------------------------------------------------------- |
| 1           | Open `/`                                                   | Landing page loads with application form / 页面加载，显示申请表单 |
| 2           | Fill all fields: company name, email, phone, city, country | All fields accept input / 所有字段可输入                          |
| 3           | Click "Submit" / 点击提交                                  | Success message shown / 显示成功提示                              |
| 4           | Check DB: `applications` table                             | New row with `status: PENDING` / 新增一行，状态为 PENDING         |

### TC-1.2: Submit with missing fields / 缺失字段提交

| Step / 步骤 | Action / 操作                         | Expected / 预期结果                                              |
| :---------- | :------------------------------------ | :--------------------------------------------------------------- |
| 1           | Leave `company_name` empty, fill rest | —                                                                |
| 2           | Click "Submit"                        | Validation error shown, no DB write / 显示校验错误，不写入数据库 |

### TC-1.3: Duplicate email application / 重复邮箱申请

| Step / 步骤 | Action / 操作               | Expected / 预期结果                                            |
| :---------- | :-------------------------- | :------------------------------------------------------------- |
| 1           | Submit same email as TC-1.1 | Second row created (duplicates allowed) / 允许重复，创建第二行 |

---

## Phase 2: BD Approval / BD 审批

**Actor:** Admin BD
**Page:** `/admin/applications`

### TC-2.1: Approve application / 审批申请

| Step / 步骤 | Action / 操作                         | Expected / 预期结果                                              |
| :---------- | :------------------------------------ | :--------------------------------------------------------------- |
| 1           | Login as Admin BD via OTP             | Redirect to `/admin` / 跳转管理后台                              |
| 2           | Navigate to `/admin/applications`     | PENDING applications listed / 显示待审批申请列表                 |
| 3           | Click "Approve" on TC-1.1 application | Approve dialog opens / 打开审批弹窗                              |
| 4           | Fill contract fields, click confirm   | Dialog closes, status → CONVERTED / 弹窗关闭，状态变为 CONVERTED |
| 5           | Check DB: `suppliers` table           | New supplier with `status: PENDING_CONTRACT` / 新增供应商        |
| 6           | Check DB: `contracts` table           | New contract with `status: DRAFT` / 新增合同，DRAFT 状态         |
| 7           | Check email inbox                     | Supplier receives OTP invitation email / 供应商收到邀请邮件      |

### TC-2.2: Direct invite (bypass application) / 直接邀请

| Step / 步骤 | Action / 操作               | Expected / 预期结果                                          |
| :---------- | :-------------------------- | :----------------------------------------------------------- |
| 1           | Navigate to `/admin/invite` | Invite form displayed / 显示邀请表单                         |
| 2           | Fill company info + email   | —                                                            |
| 3           | Click "Invite"              | Supplier + contract created atomically / 原子创建供应商+合同 |
| 4           | Check DB                    | supplier `PENDING_CONTRACT`, contract `DRAFT`                |

### TC-2.3: Regular BD cannot access applications / 普通 BD 无权访问申请列表

| Step / 步骤 | Action / 操作                     | Expected / 预期结果                             |
| :---------- | :-------------------------------- | :---------------------------------------------- |
| 1           | Login as Regular BD               | Redirect to `/admin/suppliers` / 跳转供应商列表 |
| 2           | Navigate to `/admin/applications` | 403 or redirect / 拒绝访问或重定向              |

---

## Phase 3: Contract Editing / 合同编辑

**Actor:** Admin BD or Regular BD (assigned)
**Page:** `/admin/suppliers/[id]` → contract link

### TC-3.1: Edit DRAFT contract fields / 编辑合同字段

| Step / 步骤 | Action / 操作                                                                                             | Expected / 预期结果                       |
| :---------- | :-------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| 1           | Open supplier detail → click contract link                                                                | Contract edit page loads / 合同编辑页加载 |
| 2           | Fill 9 fields: partner name, contact, address, city, country, commission rate, start/end date, properties | All fields editable / 所有字段可编辑      |
| 3           | Click "Save"                                                                                              | Fields saved via `PUT` API / 字段保存成功 |
| 4           | Refresh page                                                                                              | Saved values persist / 刷新后值保持       |

### TC-3.2: Push for review / 推送审阅

| Step / 步骤 | Action / 操作                     | Expected / 预期结果                                    |
| :---------- | :-------------------------------- | :----------------------------------------------------- |
| 1           | Fill all required contract fields | —                                                      |
| 2           | Click "Push for Review"           | Contract status: `DRAFT` → `PENDING_REVIEW` / 状态变更 |
| 3           | Try editing fields again          | Fields are read-only / 字段变为只读                    |

### TC-3.3: Push with missing fields / 缺少必填字段时推送

| Step / 步骤 | Action / 操作                 | Expected / 预期结果                                  |
| :---------- | :---------------------------- | :--------------------------------------------------- |
| 1           | Leave `commission_rate` empty | —                                                    |
| 2           | Click "Push for Review"       | Validation error, stays DRAFT / 校验失败，保持 DRAFT |

---

## Phase 4: Contract Signing / 合同签约

**Actor:** Supplier
**Page:** `/dashboard`

### TC-4.1: Supplier reviews and confirms contract / 供应商审阅并确认

| Step / 步骤 | Action / 操作                                | Expected / 预期结果                                      |
| :---------- | :------------------------------------------- | :------------------------------------------------------- |
| 1           | Supplier logs in via OTP email               | Redirect to `/dashboard` / 跳转 Dashboard                |
| 2           | Dashboard shows contract in `PENDING_REVIEW` | Contract preview visible / 显示合同预览                  |
| 3           | Click "Confirm & Sign" / 点击确认签约        | Contract: `PENDING_REVIEW` → `CONFIRMED` → `SENT`        |
| 4           | Check email                                  | DocuSign signing email received / 收到 DocuSign 签约邮件 |

### TC-4.2: Supplier requests changes / 供应商要求修改

| Step / 步骤 | Action / 操作                             | Expected / 预期结果                                 |
| :---------- | :---------------------------------------- | :-------------------------------------------------- |
| 1           | Dashboard shows contract `PENDING_REVIEW` | —                                                   |
| 2           | Click "Request Changes"                   | Contract: `PENDING_REVIEW` → `DRAFT` / 退回 BD 修改 |
| 3           | BD can edit fields again                  | Fields become editable / BD 可重新编辑              |

### TC-4.3: DocuSign signing completion / DocuSign 签署完成

| Step / 步骤 | Action / 操作                                      | Expected / 预期结果                                |
| :---------- | :------------------------------------------------- | :------------------------------------------------- |
| 1           | Supplier clicks DocuSign link in email             | DocuSign signing page opens / 打开签署页           |
| 2           | Complete signing in DocuSign                       | —                                                  |
| 3           | DocuSign sends webhook to `/api/webhooks/docusign` | Webhook received / 收到回调                        |
| 4           | Check DB: `contracts`                              | `status: SIGNED`, `signed_at` populated / 签约完成 |
| 5           | Check DB: `suppliers`                              | `status: SIGNED` / 供应商状态更新                  |
| 6           | Check Supabase Storage: `signed-contracts`         | Signed PDF uploaded / 已签署 PDF 已上传            |
| 7           | Supplier refreshes `/dashboard`                    | Building list visible / 显示楼盘列表               |

### TC-4.4: Resend signing email / 重发签约邮件

| Step / 步骤 | Action / 操作                     | Expected / 预期结果                        |
| :---------- | :-------------------------------- | :----------------------------------------- |
| 1           | BD views contract in `SENT` state | "Resend" button visible / 显示重发按钮     |
| 2           | Click "Resend"                    | New DocuSign envelope created / 创建新信封 |
| 3           | Check supplier email              | New signing link received / 收到新签约链接 |

---

## Phase 5: AI Data Extraction / AI 数据提取

**Actor:** System (triggered by BD or auto after signing)
**Prerequisite:** Worker running on port 3001

### TC-5.1: Trigger extraction for a building / 触发楼盘数据提取

| Step / 步骤 | Action / 操作                                        | Expected / 预期结果                                        |
| :---------- | :--------------------------------------------------- | :--------------------------------------------------------- |
| 1           | Ensure building has `website_url` in DB              | —                                                          |
| 2           | Call `POST /api/extraction/trigger` with building ID | Returns 200, creates `extraction_jobs` rows / 创建提取任务 |
| 3           | Check DB: `extraction_jobs`                          | 3 jobs: `contract_pdf`, `website_crawl`, `google_sheets`   |
| 4           | Each job has `status: pending`                       | —                                                          |

### TC-5.2: Website crawl extraction / 网页爬取提取

| Step / 步骤 | Action / 操作                                               | Expected / 预期结果                                         |
| :---------- | :---------------------------------------------------------- | :---------------------------------------------------------- |
| 1           | Worker receives POST `/extract` with source `website_crawl` | Returns 202 immediately / 立即返回 202                      |
| 2           | Worker crawls website via Playwright                        | Extracts text, images, JSON-LD / 提取文本、图片、结构化数据 |
| 3           | Worker calls DeepSeek LLM                                   | JSON output with building fields / LLM 返回结构化字段       |
| 4           | Worker POSTs to `/api/extraction/callback`                  | Callback received / 回调成功                                |
| 5           | Check DB: `extraction_jobs`                                 | `status: completed`, `result` populated / 任务完成          |
| 6           | Check DB: `building_onboarding_data`                        | `field_values` merged with extracted data / 字段数据已合并  |

### TC-5.3: Contract PDF extraction / 合同 PDF 提取

| Step / 步骤 | Action / 操作                                      | Expected / 预期结果                                                    |
| :---------- | :------------------------------------------------- | :--------------------------------------------------------------------- |
| 1           | Job has `source: contract_pdf` with signed PDF URL | —                                                                      |
| 2           | Worker downloads PDF → parses text → LLM extracts  | Fields like address, commission extracted / 提取地址、佣金等字段       |
| 3           | Callback merges into `building_onboarding_data`    | New fields added, existing confirmed fields protected / 保护已确认字段 |

### TC-5.4: Extraction timeout / 提取超时

| Step / 步骤 | Action / 操作                              | Expected / 预期结果                                      |
| :---------- | :----------------------------------------- | :------------------------------------------------------- |
| 1           | Set `JOB_TIMEOUT_MS=5000` (5 seconds)      | —                                                        |
| 2           | Trigger extraction on slow/unreachable URL | —                                                        |
| 3           | Wait 5 seconds                             | Worker aborts, callbacks `status: failed` / 超时回调失败 |
| 4           | Check DB: `extraction_jobs`                | `status: failed` with error message / 任务失败           |

### TC-5.5: Empty source URL / 空源地址

| Step / 步骤 | Action / 操作                                 | Expected / 预期结果                   |
| :---------- | :-------------------------------------------- | :------------------------------------ |
| 1           | Trigger extraction with empty `sourceUrl`     | —                                     |
| 2           | Worker immediately callbacks `status: failed` | No crash, graceful failure / 优雅失败 |

---

## Phase 6: Building Onboarding / 楼盘数据填写

**Actor:** Supplier (SIGNED status)
**Page:** `/onboarding/[buildingId]`

### TC-6.1: View and edit building fields / 查看和编辑楼盘字段

| Step / 步骤 | Action / 操作                           | Expected / 预期结果                                                 |
| :---------- | :-------------------------------------- | :------------------------------------------------------------------ |
| 1           | Supplier clicks building from dashboard | Onboarding page loads / 加载编辑页                                  |
| 2           | AI-extracted fields pre-populated       | Fields show extracted values with source indicator / 已提取字段预填 |
| 3           | Edit `building_name` field              | Auto-saves via `PATCH` API / 自动保存                               |
| 4           | Refresh page                            | Updated value persists / 刷新后值保持                               |

### TC-6.2: Quality score updates / 质量评分更新

| Step / 步骤 | Action / 操作                   | Expected / 预期结果                                                |
| :---------- | :------------------------------ | :----------------------------------------------------------------- |
| 1           | Start with mostly empty fields  | Score < 80%, status `incomplete` / 评分低，状态不完整              |
| 2           | Fill required Tier A fields     | Score increases / 评分上升                                         |
| 3           | Fill enough fields to reach 80% | Status auto-upgrades: `incomplete` → `previewable` / 自动升级      |
| 4           | Clear some required fields      | Score drops < 80%, status: `previewable` → `incomplete` / 自动降级 |

### TC-6.3: Gap report / 缺失字段报告

| Step / 步骤 | Action / 操作                  | Expected / 预期结果                                         |
| :---------- | :----------------------------- | :---------------------------------------------------------- |
| 1           | View building with score < 80% | Gap report shows missing required fields / 显示缺失字段列表 |
| 2           | Fill a missing field           | Gap report updates, field removed from list / 列表实时更新  |

### TC-6.4: Field value protection / 字段值保护

| Step / 步骤 | Action / 操作                                         | Expected / 预期结果                                  |
| :---------- | :---------------------------------------------------- | :--------------------------------------------------- |
| 1           | Supplier manually confirms a field (source: `manual`) | Field marked as confirmed / 字段标记为已确认         |
| 2           | Trigger AI extraction again                           | Confirmed field NOT overwritten / 已确认字段不被覆盖 |
| 3           | Non-confirmed AI-extracted fields update normally     | New values merged / 未确认字段正常更新               |

---

## Phase 7: Building Submission / 楼盘提交

**Actor:** Supplier
**Page:** `/onboarding/[buildingId]`

### TC-7.1: Submit building for review / 提交楼盘审核

| Step / 步骤 | Action / 操作                              | Expected / 预期结果                                   |
| :---------- | :----------------------------------------- | :---------------------------------------------------- |
| 1           | Ensure score ≥ 80% (status: `previewable`) | Submit button enabled / 提交按钮可用                  |
| 2           | Click "Submit for Review"                  | `POST /api/buildings/[buildingId]/submit`             |
| 3           | Check result                               | Status: `previewable` → `ready_to_publish` / 状态变更 |
| 4           | Try editing fields                         | Fields locked (read-only) / 字段锁定                  |

### TC-7.2: Submit with insufficient score / 评分不足时提交

| Step / 步骤 | Action / 操作                                   | Expected / 预期结果                        |
| :---------- | :---------------------------------------------- | :----------------------------------------- |
| 1           | Building has score < 80% (status: `incomplete`) | Submit button disabled / 提交按钮禁用      |
| 2           | Try calling API directly                        | Returns 422 with missing fields / 返回 422 |

---

## Phase 8: Auth & Permission Guards / 认证与权限保护

### TC-8.1: Unauthenticated access / 未登录访问

| Step / 步骤 | Action / 操作                          | Expected / 预期结果                 |
| :---------- | :------------------------------------- | :---------------------------------- |
| 1           | Visit `/dashboard` without login       | Redirect to `/login` / 重定向登录页 |
| 2           | Visit `/admin/suppliers` without login | Redirect to `/login` / 重定向登录页 |
| 3           | Visit `/onboarding/xxx` without login  | Redirect to `/login` / 重定向登录页 |

### TC-8.2: Supplier cannot access admin / 供应商无法访问管理后台

| Step / 步骤 | Action / 操作                  | Expected / 预期结果        |
| :---------- | :----------------------------- | :------------------------- |
| 1           | Login as Supplier              | —                          |
| 2           | Navigate to `/admin/suppliers` | Redirect or 403 / 拒绝访问 |

### TC-8.3: BD cannot access supplier pages / BD 无法访问供应商页面

| Step / 步骤 | Action / 操作                          | Expected / 预期结果        |
| :---------- | :------------------------------------- | :------------------------- |
| 1           | Login as BD                            | —                          |
| 2           | Navigate to `/onboarding/[buildingId]` | Redirect or 403 / 拒绝访问 |

### TC-8.4: Regular BD scoped to assigned suppliers / 普通 BD 只能看分配的供应商

| Step / 步骤 | Action / 操作                            | Expected / 预期结果                                |
| :---------- | :--------------------------------------- | :------------------------------------------------- |
| 1           | Login as Regular BD                      | —                                                  |
| 2           | View `/admin/suppliers`                  | Only assigned suppliers shown / 仅显示分配的供应商 |
| 3           | Try accessing unassigned supplier detail | 403 or empty / 拒绝访问                            |

---

## State Machine Reference / 状态机参考

### Contract States / 合同状态

```
DRAFT ──→ PENDING_REVIEW ──→ CONFIRMED ──→ SENT ──→ SIGNED
  ↑              │
  └── request_changes (supplier requests edits)
                                                     CANCELED (terminal)
```

### Supplier States / 供应商状态

```
PENDING_CONTRACT ──→ SIGNED (via DocuSign webhook)
```

### Building States / 楼盘状态

```
extracting ──→ incomplete ⇄ previewable ──→ ready_to_publish ──→ published
                 (score<80)   (score≥80)      (supplier submit)   (admin publish)
```

---

## Automation Notes / 自动化测试注意事项

### Recommended Framework / 推荐框架

- **E2E:** Playwright (already in devDependencies)
- **API:** Vitest + fetch (for API-level tests)
- **Worker:** Vitest (existing 18 unit tests in `worker/`)

### Key Automation Considerations / 关键考虑

| Area / 领域       | Approach / 方案                                                                 |
| :---------------- | :------------------------------------------------------------------------------ |
| DocuSign signing  | Mock webhook via `POST /api/webhooks/docusign` with valid HMAC / 模拟 webhook   |
| AI extraction     | Mock Worker responses or use test fixtures / 模拟 Worker 响应                   |
| OTP login         | Use Supabase Admin API to create session directly / 用管理 API 直接创建会话     |
| DB setup/teardown | Use `SUPABASE_SERVICE_ROLE_KEY` for direct DB operations / 直接操作数据库       |
| Parallel tests    | Each test creates unique supplier email to avoid conflicts / 用唯一邮箱避免冲突 |

### Test Data Cleanup / 测试数据清理

```sql
-- Clean up test data (run after test suite)
-- 清理测试数据（测试完成后执行）
DELETE FROM extraction_jobs WHERE building_id IN (SELECT id FROM buildings WHERE name LIKE 'TEST_%');
DELETE FROM field_audit_logs WHERE building_id IN (SELECT id FROM buildings WHERE name LIKE 'TEST_%');
DELETE FROM building_onboarding_data WHERE building_id IN (SELECT id FROM buildings WHERE name LIKE 'TEST_%');
DELETE FROM buildings WHERE name LIKE 'TEST_%';
DELETE FROM contracts WHERE supplier_id IN (SELECT id FROM suppliers WHERE company_name LIKE 'TEST_%');
DELETE FROM suppliers WHERE company_name LIKE 'TEST_%';
DELETE FROM applications WHERE company_name LIKE 'TEST_%';
```

### CI Integration / CI 集成

```yaml
# Suggested GitHub Actions workflow
# 建议的 GitHub Actions 工作流
- name: Unit Tests
  run: npx vitest run

- name: Worker Unit Tests
  run: cd worker && npx vitest run

- name: E2E Tests (Playwright)
  run: npx playwright test
  env:
    EXTRACTION_WORKER_URL: http://localhost:3001
```
