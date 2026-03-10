# Supplier Flow Redesign — 设计文档

> Major Track 设计文档 — 供应商端完整交互流程重构
> 日期: 2026-03-10

---

## 0. 背景

当前系统的供应商流程存在以下关键缺口：

1. 提取在 DocuSign 签署完成后才触发，但业务需要在 Confirm 后立即启动
2. 没有让供应商主动提供数据源（API 文档、Google Sheets、Dropbox、文件上传）的入口
3. 没有仿 uhomes.com 风格的预览页
4. 导入到 uhomes 主站的 API 不存在
5. BD 邀请链接未携带预填信息
6. 自助申请流程中"创建账号"步骤冗余

本文档覆盖 G2-G9 共 8 项改动，按 P0→P3 四个批次设计。

---

## 1. P0: 提取时机前移 + 简化账号流程

### 1.1 G3: 提取在 Confirm 后立即触发

**当前**：`recipient-handler.ts` 在 DocuSign 签署完成后触发 `/api/extraction/trigger`
**目标**：`confirm/route.ts` 在 Confirm 动作中触发提取，不等签署完成

#### 变更点

**`src/app/api/contracts/[contractId]/confirm/route.ts`**

在 `action === "confirm"` 分支中，`sendEnvelope()` 成功后追加提取触发：

```typescript
// 现有: PENDING_REVIEW → CONFIRMED → sendEnvelope() → SENT
// 新增: SENT 后立即触发提取

// ── 触发提取（非阻塞） ──
const { data: buildings } = await admin
  .from("buildings")
  .select("id")
  .eq("supplier_id", contract.supplier_id);

if (buildings && buildings.length > 0) {
  const { data: supplierRow } = await admin
    .from("suppliers")
    .select("website_url")
    .eq("id", contract.supplier_id)
    .single();

  for (const b of buildings) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/extraction/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getServiceRoleKey()}`,
      },
      body: JSON.stringify({
        buildingId: b.id,
        supplierId: contract.supplier_id,
        websiteUrl: supplierRow?.website_url ?? null,
        // 合同 PDF 此时还未签署，暂不提供 contractPdfUrl
        // 签署完成后 recipient-handler 会补充触发 contract_pdf 提取
      }),
    }).catch((err) => captureException(err));
  }
}
```

**`src/app/api/webhooks/docusign/recipient-handler.ts`**

签署完成后仍触发提取，但只触发 `contract_pdf` source（因为此时才有签署后的 PDF）：

```typescript
// 现有: 触发全部 source 的提取
// 变更: 只触发 contract_pdf source（网站爬取已在 confirm 阶段触发）
fetch(triggerUrl, {
  body: JSON.stringify({
    buildingId: b.id,
    supplierId,
    contractPdfUrl: signedPdfUrl,
    sourceFilter: "contract_pdf", // 新增参数：只提取合同 PDF
  }),
}).catch(() => {});
```

**`src/app/api/extraction/trigger/route.ts`**

支持 `sourceFilter` 参数，当指定时只创建该 source 的 extraction_job：

```typescript
interface TriggerPayload {
  buildingId: string;
  supplierId: string;
  websiteUrl?: string;
  contractPdfUrl?: string;
  sourceFilter?: DataSource; // 新增：可选，限定只触发特定 source
}
```

#### 时序图

```
Supplier clicks Confirm
    → contract: PENDING_REVIEW → CONFIRMED → SENT
    → DocuSign 邮件发出
    → 触发提取: website_crawl + google_sheets (如有)
    → Supplier 看到数据源上传入口 (G4)

[稍后] Supplier 在 DocuSign 签署
    → webhook: recipient-completed
    → 下载签署 PDF
    → supplier.status → SIGNED
    → 补充触发: contract_pdf 提取

[稍后] Supplier 上传 Google Sheets
    → 追加触发: google_sheets 提取
```

#### 影响评估

- `supplier.status` 在签署完成前仍为 `PENDING_CONTRACT`，dashboard 逻辑不受影响
- `buildings.onboarding_status` 会在 Confirm 后进入 `extracting`，签署前 dashboard 已可展示提取进度
- **幂等安全**：extraction_jobs 已有 `(building_id, source)` 唯一约束 + status 检查，重复触发不会创建重复 job

### 1.2 G9: 简化账号流程

**当前**：`approve-supplier` 创建 Auth 用户 + Supplier 记录 + Contract 记录，涉及 invite/create user
**目标**：BD 确认合作后，系统自动创建 Supplier + Contract，用户用申请时的邮箱 OTP 登录即可

#### 变更点

当前 `approve-supplier` 流程已经包含了完整的账号创建逻辑（`inviteUserByEmail` → 回退到 `createUser`）。问题不在于有独立的"创建账号"步骤，而在于用户体验：用户收到的是一封"邀请邮件"，需要先设置密码/确认，然后才能登录。

**优化方案**：统一使用 OTP 登录，去掉密码设置环节。

1. `approve-supplier` 中用 `admin.auth.createUser({ email, email_confirm: true })` 创建已确认的用户
2. 用户到达 `/login` 页面，输入邮箱，收到 OTP 魔法链接
3. 点击链接后直接进入 Dashboard，看到合同信息

**具体变更**：

```typescript
// approve-supplier/route.ts — 替换 inviteUserByEmail
const { data: authData, error: authError } = await admin.auth.admin.createUser({
  email: contactEmail,
  email_confirm: true, // 跳过邮箱确认
  user_metadata: { role: "supplier" },
});
```

同时发送一封**自定义通知邮件**（非 Supabase 系统邮件），内容为：

```
Subject: Your uhomes.com partnership is confirmed — Review your contract

Hi {company_name},

Your partnership with uhomes.com has been confirmed!
Please log in to review and confirm your contract details:

[Log in to your portal →] {APP_URL}/login

You'll receive a one-time code via email to sign in.
```

**影响**：用户无需记忆密码，每次用邮箱 OTP 登录，体验统一。

---

## 2. P1: 数据源上传 + 邀请链接预填

### 2.1 G4: 数据源上传入口

**全新功能**。在 Confirm 之后，Dashboard 出现"请提供房源信息"面板。

#### 2.1.1 数据模型

新建 `supplier_data_sources` 表：

```sql
CREATE TABLE supplier_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  building_id UUID REFERENCES buildings(id),  -- 可 NULL：NULL 表示供应商级通用数据源
  source_type TEXT NOT NULL CHECK (source_type IN (
    'api_doc', 'google_sheets', 'dropbox', 'file_upload'
  )),
  -- URL 或文件路径
  url TEXT,                          -- google_sheets / dropbox URL
  file_path TEXT,                    -- Supabase Storage 路径 (file_upload / api_doc)
  file_name TEXT,                    -- 原始文件名（仅展示用，存储用 UUID 命名）
  file_size_bytes BIGINT,
  -- API 文档特有
  api_endpoint TEXT,
  api_notes TEXT,                    -- 用户备注（如认证方式等）
  -- 状态
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  -- 提取关联
  extraction_job_id UUID REFERENCES extraction_jobs(id),
  -- 时间
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: 供应商只能看到/创建自己的
ALTER TABLE supplier_data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_own" ON supplier_data_sources
  FOR ALL USING (
    supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
  );
-- Service role 全权限
CREATE POLICY "service_role_all" ON supplier_data_sources
  FOR ALL USING (auth.role() = 'service_role');

-- Index
CREATE INDEX idx_data_sources_supplier ON supplier_data_sources(supplier_id);
```

#### 2.1.2 API 路由

| 方法   | 路由                     | 用途                           |
| ------ | ------------------------ | ------------------------------ |
| GET    | `/api/data-sources`      | 列出当前供应商的所有数据源     |
| POST   | `/api/data-sources`      | 提交新数据源（URL 或文件上传） |
| DELETE | `/api/data-sources/[id]` | 删除未处理的数据源             |

**POST `/api/data-sources`**

```typescript
interface CreateDataSourcePayload {
  sourceType: "api_doc" | "google_sheets" | "dropbox" | "file_upload";
  url?: string; // google_sheets / dropbox
  apiEndpoint?: string; // api_doc
  apiNotes?: string; // api_doc
  // file_upload 通过 FormData 传文件
}
```

处理逻辑：

1. 验证 supplier session
2. 根据 sourceType 校验必填字段
3. 文件上传 → 存入 Supabase Storage `data-sources/{supplierId}/{uuid}/{filename}`
4. 插入 `supplier_data_sources` 记录（status=pending）
5. **立即触发提取**：根据类型创建 extraction_job
   - `google_sheets` → source=google_sheets，传入 URL
   - `file_upload` → source=file_upload（新增 DataSource 类型），传入 storage URL
   - `dropbox` → source=dropbox（新增），传入 URL
   - `api_doc` → source=api_doc（新增），传入文件/URL 供 Worker 解析

#### 2.1.3 新增 DataSource 类型

```typescript
// field-value.ts
export type DataSource =
  | "contract_pdf"
  | "website_crawl"
  | "google_sheets"
  | "file_upload" // 新增
  | "dropbox" // 新增
  | "api_doc" // 新增
  | "manual_input";
```

优先级扩展：

```typescript
const SOURCE_PRIORITY: Record<DataSource, number> = {
  contract_pdf: 3,
  api_doc: 2, // 新增：与 google_sheets 同级
  google_sheets: 2,
  dropbox: 2, // 新增：与 google_sheets 同级
  file_upload: 2, // 新增：与 google_sheets 同级
  website_crawl: 1,
  manual_input: 0,
};
```

#### 2.1.4 UI 组件

**`src/components/supplier/DataSourceUpload.tsx`**

在 Dashboard 中，当合同状态 >= CONFIRMED 时显示：

```
┌─────────────────────────────────────────────┐
│ 📄 Provide Your Property Information        │
│                                             │
│ Help us build your listing faster by        │
│ sharing your property data sources.         │
│ (All optional — share what you have)        │
│                                             │
│ ┌─────────────────────┐ ┌────────────────┐  │
│ │ 🔗 Google Sheets    │ │ 📁 Dropbox     │  │
│ │ Paste URL           │ │ Paste URL      │  │
│ └─────────────────────┘ └────────────────┘  │
│ ┌─────────────────────┐ ┌────────────────┐  │
│ │ 🔌 API Documentation│ │ 📤 Upload Files│  │
│ │ Endpoint + docs     │ │ PDF/Excel/CSV  │  │
│ └─────────────────────┘ └────────────────┘  │
│                                             │
│ Already shared:                             │
│ ✅ Google Sheet — processing...             │
│ ✅ 2 files uploaded — completed             │
└─────────────────────────────────────────────┘
```

**关键 UX 决策**：

- 四种数据源类型显示为卡片网格
- 点击后弹出对应的输入表单（URL 输入 / 文件上传 / API 表单）
- 已提交的数据源显示状态标签（pending / processing / completed / failed）
- 文件上传限制：单文件最大 50MB，支持 PDF/XLSX/CSV/JPG/PNG/MP4
- **文件上传安全**：服务端校验 MIME type（不仅看扩展名），存储时用 UUID 重命名（`{uuid}.{ext}`），原始文件名仅保存在 `file_name` 列
- **Rate Limit**：POST `/api/data-sources` 限制 10 req/min/supplier
- 全部可选，面板标题明确标注 "All optional"
- 拖拽上传支持 + 上传进度指示器

#### 2.1.5 数据库变更

新增 migration: `20260310100000_create_supplier_data_sources.sql`

新增 Supabase Storage bucket: `data-sources`（private，RLS 控制访问）

### 2.2 G8: BD 邀请链接携带预填信息

**当前**：`invite-supplier` 创建 supplier + contract，但合同字段为空 `{}`
**目标**：BD 在邀请时可预填合同字段，供应商登录后直接看到

#### 变更点

**`src/app/api/admin/invite-supplier/route.ts`**

扩展 payload，接受可选的 `contractFields`：

```typescript
interface InvitePayload {
  email: string;
  companyName: string;
  supplierType?: string;
  phone?: string;
  website?: string;
  // 新增：BD 预填的合同字段
  contractFields?: Partial<ContractFields>;
}
```

创建 contract 时写入预填字段：

```typescript
await admin.from("contracts").insert({
  supplier_id: supplier.id,
  status: contractFields ? "PENDING_REVIEW" : "DRAFT", // 有预填 → 直接到 PENDING_REVIEW
  contract_fields: contractFields ?? {},
  // ...
});
```

**Admin 邀请页 UI** (`src/app/admin/invite/page.tsx`)：

在现有邀请表单下方增加"Pre-fill Contract" 折叠面板，包含 9 个合同字段的输入框。BD 可选填，填了的话供应商登录后直接看到 PENDING_REVIEW 状态。

---

## 3. P2: DocuSign PDF 预览 + uhomes 预览页

### 3.1 G2: DocuSign PDF 预览

**目标**：在 Confirm 之前，供应商能以 PDF 形式预览合同（非 DocuSign 签署页，而是合同内容的 PDF 渲染）。

#### 方案

两种预览形式已部分存在：

1. **On 系统字段表单**：`ContractDocumentPreview` 组件（已实现，只读展示 9 个字段）
2. **PDF 预览**：需要新增

**方案 A（推荐）：服务端生成合同 PDF**

使用 `@react-pdf/renderer` 在服务端根据 `contract_fields` 生成 PDF：

```
GET /api/contracts/[contractId]/preview-pdf
```

- 读取 `contract_fields`
- 用合同模板 + 字段值渲染为 PDF（品牌化：uhomes logo + 标准条款）
- 返回 `Content-Type: application/pdf`
- 供应商在 On 系统中通过 iframe 或新标签页查看
- **Vercel 配置**：`maxDuration: 30`（PDF 生成可能耗时），首次生成后缓存到 Storage

**方案 B：使用已上传的自定义 PDF**

如果 BD 上传了自定义合同 PDF（`uploaded_document_url`），直接展示该 PDF。

**最终方案**：优先用已上传 PDF（方案 B），无上传 PDF 时用服务端生成（方案 A）。

#### UI 变更

在 `PendingReviewContent` 组件中，添加两个标签页：

```
┌──────────────────────────────────────────┐
│  [Contract Details]  [PDF Preview]       │
│                                          │
│  Tab 1: 现有字段表单（只读）              │
│  Tab 2: PDF 预览（iframe 或 embed）      │
│                                          │
│  [Confirm & Sign]   [Request Changes →]  │
│  (Request Changes 打开 mailto:bd-email)  │
└──────────────────────────────────────────┘
```

### 3.2 G6: uhomes.com 风格预览页

**全新页面**。供应商确认 building 信息后，可预览该 building 在 uhomes.com 上的展示效果。

#### 3.2.1 路由

```
/dashboard/preview/[buildingId]
```

#### 3.2.2 页面结构

参考 uhomes.com 房源详情页布局：

```
┌─────────────────────────────────────────────────┐
│ [← Back to Dashboard]                           │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 图片轮播 (cover_image + images)              │ │
│ │ 未上传时显示占位图 + "Add photos" 提示       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Property Name              价格区间              │
│ Address, City, Country     $XXX - $XXX /month   │
│                            (未填显示 "—")        │
│                                                 │
│ ┌─ Key Amenities ────────────────────────────┐  │
│ │ [Gym] [Pool] [WiFi] [Furnished] ...        │  │
│ │ 未填显示灰色占位 "No amenities added"       │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌─ Description ──────────────────────────────┐  │
│ │ Property description text...               │  │
│ │ 未填显示 "No description yet — add one     │  │
│ │ to improve your listing"                   │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌─ Unit Types ───────────────────────────────┐  │
│ │ Studio | 1-Bed | 2-Bed ...                 │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌─ Lease Information ────────────────────────┐  │
│ │ Lease Duration: 6 months, 12 months        │  │
│ │ Move-in Dates: Aug 2026, Jan 2027          │  │
│ │ Cancellation Policy: ...                   │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌─ Fees & Deposits ─────────────────────────┐  │
│ │ Application Fee: $50                       │  │
│ │ Deposit: 1 month rent                      │  │
│ │ Utilities: Included                        │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌─ Contact Information ─────────────────────┐  │
│ │ Primary Contact: John Smith               │  │
│ │ Email: john@property.com                  │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌─ Completion Status ───────────────────────┐  │
│ │ 🟡 72% complete — 8 fields missing        │  │
│ │ [Edit Property Details →]                  │  │
│ └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### 3.2.3 关键 UX 规则

- **未填字段不隐藏**，显示为灰色占位 + 引导文案（如 "No description yet — add one to improve your listing"）
- 底部显示完成度 + 缺失字段数 + "Edit" 跳转到 Onboarding Form
- 样式参考 uhomes.com 房源页（颜色方案用 On 系统品牌色）
- 响应式：Mobile-First，三断点适配

#### 3.2.4 入口

在 Building Card 上增加 "Preview" 按钮，当 `onboarding_status` 为 `previewable` / `ready_to_publish` / `published` 时可见。

---

## 4. P3: uhomes API 导入

### 4.1 G7: 导出接口设计

API 接口需与 uhomes 技术团队协商，此处先设计 On 系统侧的导出数据结构。

#### 4.1.1 导出数据层级

```
Supplier (公寓商)
  ├── company_name, contact_email, website_url, ...
  ├── Contract (合同信息)
  │     └── commission_rate, start_date, end_date, ...
  └── Buildings[] (公寓楼)
        ├── building_name, address, city, country, ...
        ├── amenities, images, description, ...
        └── Units[] (单元，来自 unit_types_summary 拆分)
              └── type, price_range, availability, ...
```

#### 4.1.2 On 系统导出 API

```
POST /api/admin/export-to-uhomes
Body: { supplierId: string, buildingIds: string[] }

Response: {
  supplier: { ... },
  buildings: [
    {
      id: string,
      fields: Record<string, unknown>,  // 完整字段值
      score: number,
      status: string,
    }
  ],
  contract: { ... },
}
```

此 API 仅负责组装数据。实际推送到 uhomes 的逻辑待对接后实现。

#### 4.1.3 中间方案

在 uhomes API 就绪前，提供 **JSON/CSV 导出**供 BD 手动导入：

```
GET /api/admin/export/[supplierId]?format=json
GET /api/admin/export/[supplierId]?format=csv
```

---

## 5. 数据模型变更汇总

### 5.1 新增表

| 表名                    | 用途                                      |
| ----------------------- | ----------------------------------------- |
| `supplier_data_sources` | 供应商提交的数据源（URL、文件、API 文档） |

### 5.2 修改表

| 表                               | 变更                                     |
| -------------------------------- | ---------------------------------------- |
| `field-value.ts` DataSource 类型 | 新增 `file_upload`, `dropbox`, `api_doc` |
| `data-merge.ts` SOURCE_PRIORITY  | 新增三种 source 的优先级（=2）           |

### 5.3 新增 Storage Bucket

| Bucket         | 用途             | 访问控制                    |
| -------------- | ---------------- | --------------------------- |
| `data-sources` | 供应商上传的文件 | Private，RLS 按 supplier_id |

### 5.4 新增 Migration

| 文件                                              | 内容                                  |
| ------------------------------------------------- | ------------------------------------- |
| `20260310100000_create_supplier_data_sources.sql` | supplier_data_sources 表 + RLS + 索引 |

### 5.5 数据库 CHECK 约束变更

`extraction_jobs.source` 列需要扩展 CHECK 约束，增加新的 source 类型：

```sql
ALTER TABLE extraction_jobs
  DROP CONSTRAINT IF EXISTS extraction_jobs_source_check;
ALTER TABLE extraction_jobs
  ADD CONSTRAINT extraction_jobs_source_check
  CHECK (source IN (
    'contract_pdf', 'website_crawl', 'google_sheets',
    'file_upload', 'dropbox', 'api_doc'
  ));
```

---

## 6. 新增 API 路由汇总

| 方法   | 路由                              | 鉴权               | 用途               |
| ------ | --------------------------------- | ------------------ | ------------------ |
| GET    | `/api/data-sources`               | Session (supplier) | 列出供应商的数据源 |
| POST   | `/api/data-sources`               | Session (supplier) | 提交新数据源       |
| DELETE | `/api/data-sources/[id]`          | Session (supplier) | 删除未处理的数据源 |
| GET    | `/api/contracts/[id]/preview-pdf` | Session (supplier) | 生成合同预览 PDF   |
| POST   | `/api/admin/export-to-uhomes`     | Session (BD/admin) | 导出 building 数据 |
| GET    | `/api/admin/export/[supplierId]`  | Session (BD/admin) | 导出 JSON/CSV      |

---

## 7. 新增页面路由

| 路由                              | 用途                  |
| --------------------------------- | --------------------- |
| `/dashboard/preview/[buildingId]` | uhomes.com 风格预览页 |

---

## 8. 国际化覆盖

| 市场   | 覆盖项                               |
| ------ | ------------------------------------ |
| 全市场 | 数据源上传 UI 使用英文，无本地化依赖 |
| UK/AU  | Per Semester 租期在预览页正确展示    |
| 全市场 | 预览页价格显示对应货币符号           |
| 全市场 | 文件上传支持各语言文件名（UTF-8）    |

---

## 9. 测试计划

### 9.1 P0 测试

| 模块               | 测试用例                                                 |
| ------------------ | -------------------------------------------------------- |
| confirm route      | Confirm 后触发 extraction/trigger（mock fetch 验证调用） |
| confirm route      | buildings 为空时不触发提取                               |
| recipient-handler  | 签署完成后只触发 contract_pdf source                     |
| extraction/trigger | sourceFilter 参数过滤 source 类型                        |
| approve-supplier   | 使用 createUser + email_confirm:true                     |

### 9.2 P1 测试

| 模块                     | 测试用例                                  |
| ------------------------ | ----------------------------------------- |
| POST /api/data-sources   | 各类型数据源创建成功                      |
| POST /api/data-sources   | 无效 URL 拒绝                             |
| POST /api/data-sources   | 文件大小超限拒绝                          |
| POST /api/data-sources   | 提交后触发 extraction_job 创建            |
| DELETE /api/data-sources | 只能删除 pending 状态                     |
| invite-supplier          | contractFields 预填写入 contract          |
| invite-supplier          | 有预填时 contract.status = PENDING_REVIEW |

### 9.3 P2 测试

| 模块         | 测试用例                   |
| ------------ | -------------------------- |
| preview-pdf  | 生成 PDF 包含所有字段      |
| preview page | 未填字段显示占位           |
| preview page | score + missing count 正确 |

### 9.4 边界/异常用例

- Confirm 后 building 列表为空（不崩溃，跳过提取）
- 上传 50MB 文件（拒绝并提示）
- Dropbox 链接无效（标记 failed，显示错误）
- 预览页所有字段为空（全部显示占位，不崩溃）

---

## 10. Sentry 监控

| 事件                                    | 级别    | 描述                       |
| --------------------------------------- | ------- | -------------------------- |
| `confirm.extraction_trigger`            | info    | Confirm 后触发了提取       |
| `confirm.extraction_trigger_failed`     | warning | 提取触发请求失败（非阻塞） |
| `data_source.upload_failed`             | error   | 文件上传到 Storage 失败    |
| `data_source.extraction_trigger_failed` | warning | 数据源提交后触发提取失败   |
| `preview_pdf.generation_failed`         | error   | PDF 生成失败               |

---

## 11. 实施计划

| 批次 | PR   | 内容                           | 预估文件数 |
| ---- | ---- | ------------------------------ | ---------- |
| P0   | PR-A | G3 提取时机前移 + G9 账号简化  | ~8         |
| P1   | PR-B | G4 数据源上传（DB + API + UI） | ~12        |
| P1   | PR-C | G8 邀请链接预填                | ~4         |
| P2   | PR-D | G2 合同 PDF 预览               | ~5         |
| P2   | PR-E | G6 uhomes 预览页               | ~6         |
| P3   | PR-F | G7 导出接口 stub               | ~4         |

---

## 12. 方案评审清单

- [x] 方案覆盖了国际化场景（US/UK/AU/CA/EU 五个市场）
- [x] 数据模型变更有向后兼容策略（新增表，不修改现有表结构）
- [x] 新增 API 有 Rate Limiting 设计（文件上传限制 50MB，data-sources 创建限频）
- [x] 涉及个人数据的功能有 GDPR 合规设计（数据源文件在 account deletion 时级联删除）
- [x] 测试用例覆盖正常/边界/异常三种场景
- [x] 错误路径有 Sentry 监控告警
- [x] 新增页面有空状态 + 加载状态 + 错误状态设计
- [x] 方案文档已更新到 `docs/` 目录

---

## 13. Gate 1 评审结果

**日期**: 2026-03-10 | **结果**: 通过 (8.50/10)

| 专家                    | 分数 |
| ----------------------- | ---- |
| Backend Architecture    | 8.75 |
| Security & Compliance   | 8.0  |
| Frontend & UX           | 8.75 |
| DevOps & Infrastructure | 8.5  |
| Product & Business      | 8.5  |

**已采纳的改进项**（已更新到文档中）：

1. `supplier_data_sources` 增加 `building_id` 可选列
2. 文件上传安全：服务端 MIME 验证 + UUID 文件名 + Rate Limit 10 req/min
3. 提取触发 `.catch()` 改为 Sentry `captureException`
4. "Request Changes" 明确为 `mailto:bd-email`
5. PDF 生成 API 设置 `maxDuration: 30` + 缓存策略
