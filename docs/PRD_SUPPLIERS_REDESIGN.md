# PRD: Suppliers 模块重设计

> Major Track Phase 0 — 设计文档
> 日期: 2026-03-08
> 状态: **评审通过（Round 2）**

---

## 1. 背景与目标

### 1.1 现状问题

- 列表页只有基础字段（公司名、邮箱、状态、建筑数），无法判断"下一步该做什么"
- 详情页是信息罗列，无行动导向
- 签约后流程不透明——extraction 状态、onboarding 进度在列表页完全看不到
- 缺少搜索、KPI、跟进记录等 BD 日常工作必需的功能
- DocuSign 双签场景下，uhomes 签署人（Abby）未签会阻塞整个后续流程

### 1.2 目标

1. **Pipeline 视图**：按业务阶段展示供应商，BD 一眼看到谁需要跟进
2. **行动导向的详情页**：Timeline + Next Action + 进度可视化
3. **签约后流程透明化**：合同状态、extraction 进度、onboarding 评分可见
4. **DocuSign 改造（P0）**：供应商签署即触发后续流程，uhomes 签署为非阻塞步骤
5. **独立备注表**：新建 `supplier_notes` 表，保留 `application_notes` 不变，避免耦合

### 1.3 Out of Scope

- 供应商端 Dashboard 改版（本次只改 admin/BD 端）
- 建筑详情页改版
- 合同编辑器改版
- 批量操作（后续迭代）

---

## 2. 用户角色与权限

| 能力                | Admin | BD             |
| :------------------ | :---- | :------------- |
| 查看所有供应商      | Yes   | 仅自己负责的   |
| Pipeline 全阶段筛选 | Yes   | Yes            |
| BD 筛选下拉         | Yes   | No             |
| 分配/更换 BD        | Yes   | No             |
| 查看详情            | Yes   | 仅自己负责的   |
| 添加备注            | Yes   | 仅自己负责的   |
| 审核上线            | Yes   | No（后续迭代） |

---

## 3. Pipeline 阶段定义

基于**供应商自身状态**计算 Pipeline 阶段。"合同处理中"拆分为两个子阶段以区分 BD 的不同行动。

### 3.1 五阶段 Pipeline

| Pipeline 阶段  | Tab 标签           | 计算规则                                                                                    | BD 关注点                    |
| :------------- | :----------------- | :------------------------------------------------------------------------------------------ | :--------------------------- |
| **待创建合同** | New                | supplier.status IN (NEW, PENDING_CONTRACT) 且无合同                                         | 为供应商创建合同             |
| **合同进行中** | In Progress        | supplier.status = PENDING_CONTRACT 且 contract.status IN (DRAFT, PENDING_REVIEW, CONFIRMED) | 编辑/审核/发送合同           |
| **待签署**     | Awaiting Signature | supplier.status = PENDING_CONTRACT 且 contract.status = SENT                                | 催促供应商签署               |
| **已签约**     | Signed             | supplier.status = SIGNED 且未达到"已上线"条件                                               | 跟进 onboarding 进度         |
| **已上线**     | Live               | supplier.status = SIGNED 且 ≥1 个 building.onboarding_status = published                    | 运营维护，显示 X/Y published |

> 默认 Tab：**待创建合同**（最需要 BD 立即行动）。末尾追加 **All** Tab。

### 3.2 Pipeline 计算函数

```typescript
type PipelineStage =
  | "NEW_CONTRACT"
  | "CONTRACT_IN_PROGRESS"
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "LIVE";

function computePipelineStage(
  supplier: { status: string },
  contract: { status: string } | null,
  buildings: { onboarding_status: string }[],
): PipelineStage {
  if (supplier.status === "SIGNED") {
    const hasPublished = buildings.some(
      (b) => b.onboarding_status === "published",
    );
    return hasPublished ? "LIVE" : "SIGNED";
  }
  if (!contract) return "NEW_CONTRACT";
  if (contract.status === "SENT") return "AWAITING_SIGNATURE";
  return "CONTRACT_IN_PROGRESS";
}
```

### 3.3 阶段停留天数计算

从已有时间戳推算（不新增字段）：

| 阶段                 | 起算时间                                              |
| :------------------- | :---------------------------------------------------- |
| NEW_CONTRACT         | supplier.created_at                                   |
| CONTRACT_IN_PROGRESS | contract.created_at                                   |
| AWAITING_SIGNATURE   | contract.updated_at（最近一次状态变更到 SENT 的时间） |
| SIGNED               | contract.signed_at 或 supplier.updated_at             |
| LIVE                 | 首个 building published 的时间（不显示停留天数）      |

超 7 天：橙色预警。超 14 天：红色预警。

---

## 4. 列表页设计

### 4.1 KPI 统计卡片（顶部 5 格）

| 卡片       | Admin 视角                    | BD 视角  |
| :--------- | :---------------------------- | :------- |
| 待创建合同 | 全局计数                      | 我负责的 |
| 合同进行中 | 全局计数                      | 我负责的 |
| 待签署     | 全局计数 + 超 7 天数量        | 我负责的 |
| 已签约     | 全局计数 + 平均 onboarding 分 | 我负责的 |
| 已上线     | 全局计数                      | 我负责的 |

### 4.2 Pipeline Tab 筛选

```
[New (2)] [In Progress (3)] [Awaiting Signature (5)] [Signed (12)] [Live (8)] [All (30)]
```

### 4.3 搜索 + 筛选

- 搜索框：公司名 / 邮箱 / 城市 / 国家（300ms debounce）
- BD 筛选下拉（仅 Admin）
- 清除所有筛选按钮

### 4.4 列表行信息

**桌面端表格列：**

| 列        | 内容                                                 |
| :-------- | :--------------------------------------------------- |
| Company   | 公司名 + BD 名（副行）                               |
| Stage     | Pipeline 阶段标签（颜色编码）                        |
| Contract  | 合同状态 badge（仅非 NEW 阶段显示）                  |
| Buildings | 建筑数 + 平均分（如有）；Live 阶段显示 X/Y published |
| Days      | 当前阶段停留天数（>7 橙色，>14 红色）                |
| Updated   | 最后活跃时间（相对时间）                             |

**颜色编码（全站统一）：**

| 颜色 | 含义          | 使用场景           |
| :--- | :------------ | :----------------- |
| 橙色 | 需要关注/行动 | 超 7 天、未分配    |
| 蓝色 | 进行中        | 合同进行中、待签署 |
| 绿色 | 完成/正常     | 已签约、已上线     |
| 红色 | 异常/紧急     | 超 14 天           |

**移动端卡片**：垂直布局，同 Applications 页面模式。

### 4.5 Drawer 预览（精简版）

点击列表行 → 右侧 Drawer（桌面 420px / 移动全屏），只显示：

1. **Header**：公司名 + Pipeline 阶段标签
2. **Next Action 提示**：明确下一步（可 actionable——如"Copy email" 按钮）
3. **联系信息**：邮箱、电话、城市、国家
4. **合同状态**：一行摘要
5. **Footer**：`查看详情` 按钮 → 跳转全页 `/admin/suppliers/[id]`

> 建筑列表和备注不放 Drawer，留给全页详情页（Expert 3 建议：Drawer 保持简洁）。

### 4.6 Next Action 逻辑

```typescript
function getNextAction(
  stage: PipelineStage,
  contract: { status: string } | null,
  buildings: { onboarding_status: string; score: number }[],
): { text: string; actionType?: "copy_email" | "link" } {
  switch (stage) {
    case "NEW_CONTRACT":
      return { text: "Create contract for this supplier" };
    case "CONTRACT_IN_PROGRESS":
      if (contract?.status === "DRAFT")
        return { text: "Complete contract editing" };
      if (contract?.status === "PENDING_REVIEW")
        return { text: "Review and confirm contract" };
      if (contract?.status === "CONFIRMED")
        return { text: "Send contract to supplier" };
      return { text: "Process contract" };
    case "AWAITING_SIGNATURE":
      return {
        text: "Follow up with supplier to sign contract",
        actionType: "copy_email",
      };
    case "SIGNED": {
      const incomplete = buildings.filter(
        (b) => b.onboarding_status === "incomplete",
      );
      if (incomplete.length > 0)
        return {
          text: `${incomplete.length} building(s) need more data`,
        };
      const reviewable = buildings.filter(
        (b) =>
          b.onboarding_status === "previewable" ||
          b.onboarding_status === "ready_to_publish",
      );
      if (reviewable.length > 0)
        return {
          text: `${reviewable.length} building(s) ready for review`,
        };
      return { text: "Monitor onboarding progress" };
    }
    case "LIVE":
      return { text: "All buildings published — operational maintenance" };
  }
}
```

---

## 5. 详情页设计（全页）

路由：`/admin/suppliers/[id]`

### 5.1 桌面端两栏布局

```
┌───────────────────────────────────────────────────────────┐
│ ← Back to Suppliers                                       │
│                                                           │
│ [Company Name]                     [Pipeline Stage Tag]   │
│ contact@email.com | +1 xxx | London, UK | uhomes.com      │
│                                                           │
│ ┌─ Next Action ─────────────────────────────────────────┐ │
│ │ 2 buildings need more data              [Copy Email]  │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─── Left Column ──────┐  ┌─── Right Column ───────────┐ │
│ │                       │  │                             │ │
│ │ ┌─ Timeline ────────┐ │  │ ┌─ Buildings (3) ────────┐ │ │
│ │ │ ✓ Approved  Mar 1 │ │  │ │ ┌ Sunrise Apts ──────┐ │ │ │
│ │ │ ✓ Sent      Mar 3 │ │  │ │ │ ██████░░ 72/100    │ │ │ │
│ │ │ ✓ Supplier  Mar 5 │ │  │ │ │ incomplete | 8 miss │ │ │ │
│ │ │ ○ uhomes   pending │ │  │ │ └────────────────────┘ │ │ │
│ │ │ ● Extract  running │ │  │ │ ┌ Ocean Towers ──────┐ │ │ │
│ │ │ ○ Onboard  waiting │ │  │ │ │ █████████░ 91/100  │ │ │ │
│ │ │ ○ Live     waiting │ │  │ │ │ previewable | 3 mis │ │ │ │
│ │ └───────────────────┘ │  │ │ └────────────────────┘ │ │ │
│ │                       │  │ └────────────────────────┘ │ │
│ │ ┌─ Contract ────────┐ │  │                             │ │
│ │ │ Standard 2026     │ │  │ ┌─ Notes ────────────────┐ │ │
│ │ │ SIGNED ✓  Mar 5   │ │  │ │ [Add note]     [Send]  │ │ │
│ │ │ [Download] [View] │ │  │ │ Mar 7: Contacted...    │ │ │
│ │ └───────────────────┘ │  │ │ Mar 5: Contract sent   │ │ │
│ │                       │  │ └────────────────────────┘ │ │
│ │ ┌─ BD Assignment ──┐ │  │                             │ │
│ │ │ [BD Select ▼]    │ │  │                             │ │
│ │ └───────────────────┘ │  │                             │ │
│ └───────────────────────┘  └─────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

移动端：单栏纵向，顺序：Next Action → Timeline → Contract → Buildings → Notes → BD Assignment。

### 5.2 Timeline 节点定义

| 节点                 | 完成条件                                  | 数据来源                    |
| :------------------- | :---------------------------------------- | :-------------------------- |
| Application approved | supplier 记录存在                         | suppliers.created_at        |
| Contract sent        | contract.status >= SENT                   | contracts.updated_at        |
| Supplier signed      | provider_metadata.supplier_signed_at 存在 | contracts.provider_metadata |
| uhomes countersigned | contract.status = SIGNED                  | contracts.signed_at         |
| Data extraction      | 任一 extraction_job 完成                  | extraction_jobs.status      |
| Onboarding complete  | 所有 building score >= 80                 | buildings.score             |
| Published            | ≥1 building.onboarding_status = published | buildings.onboarding_status |

### 5.3 Building 卡片

- 按 score **从低到高**排序（最需关注的在前，Expert 2 建议）
- 每个建筑显示：建筑名、地址、Score 进度条、status badge、缺失字段数、最后更新时间
- Score 进度条颜色：渐变色（红→橙→绿，Expert 4 建议）
- 点击 → 跳转 onboarding 页面

---

## 6. DocuSign 双签改造（P0）

### 6.1 当前问题

DocuSign `envelope-completed` 事件在**所有签署人完成**后才触发。如果 Abby（uhomes 签署人）未签，extraction 和后续流程被阻塞。

### 6.2 方案：监听 `recipient-completed` 事件

1. 当供应商（Signer 1, routing_order=1）完成签署时：
   - 记录 `supplier_signed_at` 到 contract.provider_metadata
   - 更新 supplier.status → SIGNED
   - 触发 extraction（数据提取）
   - contract.status 保持 SENT（Abby 尚未签署）
2. 当所有签署人完成（`envelope-completed`）时：
   - 更新 contract.status → SIGNED
   - 下载并存储签署后 PDF

### 6.3 幂等性保护（Expert 5 关注点）

- `recipient-completed` 处理前检查：如果 `supplier_signed_at` 已存在 → 跳过，返回 200
- `envelope-completed` 处理前检查：如果 contract.status 已为 SIGNED → 跳过，返回 200
- 并发到达场景：两个事件间隔几秒，通过上述幂等检查避免重复触发 extraction

### 6.4 Plan B（若 DocuSign Connect 不支持 recipient-level webhook）

增加 Cron Job（每日），轮询 DocuSign API 检查 SENT 状态合同的 envelope recipient 状态：

- 如果供应商已签但 envelope 未 completed → 手动触发 extraction + 更新 supplier.status

### 6.5 签署人配置

- Signer 1（供应商）：routing_order = 1
- Signer 2（uhomes）：routing_order = 2，固定 `abby.zhang@uhomes.com`

### 6.6 Webhook 处理逻辑

```
收到 webhook event
├── event = "recipient-completed"
│   ├── 提取 envelope_id → 查找 contract
│   ├── 检查 recipient routing_order = 1（供应商）
│   ├── 幂等检查：provider_metadata.supplier_signed_at 已存在？→ 200
│   ├── 更新 provider_metadata.supplier_signed_at = now()
│   ├── 更新 supplier.status → SIGNED
│   ├── 触发 extraction/trigger
│   └── 返回 200
├── event = "envelope-completed"
│   ├── （现有逻辑，保持不变）
│   ├── 更新 contract.status → SIGNED
│   ├── 下载并存储签署后 PDF
│   └── 返回 200
└── 其他事件 → 200
```

---

## 7. 备注系统（分表设计）

### 7.1 新建 `supplier_notes` 表

```sql
CREATE TABLE supplier_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_notes_supplier_id ON supplier_notes(supplier_id);
ALTER TABLE supplier_notes ENABLE ROW LEVEL SECURITY;
```

> `application_notes` 表保持不变，两张表独立演进（Expert 6 建议）。

### 7.2 API

| 路由                                      | 方法 | 说明                             |
| :---------------------------------------- | :--- | :------------------------------- |
| `/api/admin/suppliers/[supplierId]/notes` | GET  | 查看供应商备注（DESC）           |
| `/api/admin/suppliers/[supplierId]/notes` | POST | 添加备注（Zod 校验 1-2000 字符） |

权限：Admin 可操作所有；BD 只能操作 bd_user_id = 自己 的供应商。

---

## 8. 供应商 KPI 统计 API

### 8.1 端点

`GET /api/admin/suppliers/stats`

### 8.2 响应

```json
{
  "new_contract": 2,
  "contract_in_progress": 3,
  "awaiting_signature": 5,
  "signed": 12,
  "live": 8,
  "overdue_count": 2,
  "avg_onboarding_score": 67
}
```

### 8.3 计算逻辑

- `new_contract`：supplier.status IN (NEW, PENDING_CONTRACT) 且无合同记录
- `contract_in_progress`：supplier.status = PENDING_CONTRACT 且 contract.status IN (DRAFT, PENDING_REVIEW, CONFIRMED)
- `awaiting_signature`：supplier.status = PENDING_CONTRACT 且 contract.status = SENT
- `signed`：supplier.status = SIGNED 且无 published 建筑
- `live`：supplier.status = SIGNED 且 ≥1 个 building published
- `overdue_count`：awaiting_signature 中超过 7 天未签的数量
- `avg_onboarding_score`：SIGNED 供应商的建筑平均分

BD 视角：仅计算 bd_user_id = 自己 的供应商。

---

## 9. 文件上传入口（Onboarding 表单增强）

### 9.1 需求

在现有 onboarding 逐字段表单基础上，增加批量上传入口：

- 支持：URL 链接、压缩文件（.zip/.rar）、云盘链接（Google Drive / Dropbox / OneDrive）
- 上传后存储到 Supabase Storage，由 BD 人工处理或后续自动提取
- **限制：最多 20 个条目**（Expert 5 建议，防 JSONB 膨胀）
- 单文件大小限制：50MB

### 9.2 数据模型

```sql
ALTER TABLE building_onboarding_data
ADD COLUMN resource_uploads JSONB DEFAULT '[]';
```

格式：

```json
[
  {
    "type": "file",
    "name": "properties.zip",
    "url": "storage://onboarding-uploads/{buildingId}/{uuid}.zip",
    "size": 2400000,
    "uploaded_at": "2026-03-07T10:00:00Z"
  },
  {
    "type": "link",
    "url": "https://drive.google.com/...",
    "uploaded_at": "2026-03-06T10:00:00Z"
  }
]
```

---

## 10. 组件清单

| 组件                   | 类型 | 说明                                                        |
| :--------------------- | :--- | :---------------------------------------------------------- |
| `SupplierStats`        | 新建 | KPI 统计卡片（5 格）                                        |
| `SupplierList`         | 重写 | Pipeline 6-tab + search + BD filter                         |
| `SupplierTable`        | 重写 | 增强行信息 + 阶段标签 + 停留天数                            |
| `SupplierDrawer`       | 新建 | 精简预览 Drawer（阶段 + Next Action + 联系信息 + 查看详情） |
| `SupplierTimeline`     | 新建 | 详情页 7 节点里程碑时间线                                   |
| `BuildingProgressCard` | 新建 | 建筑 score 进度条卡片（渐变色）                             |
| `SupplierNotes`        | 新建 | 备注组件（复用 ApplicationNotes 交互模式）                  |
| `NextActionBanner`     | 新建 | 详情页/Drawer 顶部行动提示 + 可操作按钮                     |
| `ResourceUpload`       | 新建 | Onboarding 表单上传区（文件 + 链接）                        |

---

## 11. API 清单

| 路由                                 | 方法        | 说明                     | 优先级 |
| :----------------------------------- | :---------- | :----------------------- | :----- |
| `/api/admin/suppliers/stats`         | GET         | Pipeline KPI 统计        | P0     |
| `/api/admin/suppliers/[id]/notes`    | GET/POST    | 供应商备注               | P0     |
| `/api/admin/suppliers/[id]/timeline` | GET         | 里程碑时间线数据         | P0     |
| `/api/webhooks/docusign`             | POST        | 增加 recipient-completed | P0     |
| `/api/buildings/[id]/resources`      | POST/DELETE | 上传/删除资源            | P1     |

---

## 12. 数据库变更清单

| 变更                       | SQL                                                                                 | 优先级 |
| :------------------------- | :---------------------------------------------------------------------------------- | :----- |
| 新建 `supplier_notes` 表   | 见 Section 7.1                                                                      | P0     |
| 添加 `resource_uploads` 列 | ALTER TABLE building_onboarding_data ADD COLUMN resource_uploads JSONB DEFAULT '[]' | P1     |

> `application_notes` 保持不变，不迁移。

---

## 13. 专家组评审结果（Round 2 — 最终评审）

### 评审团

| 专家     | 角色                               |
| :------- | :--------------------------------- |
| Expert 1 | Booking.com Supply Chain VP        |
| Expert 2 | Airbnb Host Onboarding Lead        |
| Expert 3 | Trip.com Partner Ops Director      |
| Expert 4 | 产品设计专家（Figma Design Lead）  |
| Expert 5 | QA/测试专家（Stripe QA Principal） |
| Expert 6 | Red Team 专家                      |

### Round 1 反馈采纳情况

| 反馈                            | 来源     | 处理                     |
| :------------------------------ | :------- | :----------------------- |
| "已上线"改为 ≥1 个 published    | Expert 1 | ✅ 采纳                  |
| KPI 加"超期数量"指标            | Expert 1 | ✅ 采纳（overdue_count） |
| Building 卡片按 score 低→高排序 | Expert 2 | ✅ 采纳                  |
| Next Action 增加可操作按钮      | Expert 2 | ✅ 采纳（copy_email 等） |
| Drawer 精简，去掉建筑和备注     | Expert 3 | ✅ 采纳                  |
| 搜索扩大到 city/country         | Expert 3 | ✅ 采纳                  |
| DocuSign 提至 P0                | Expert 3 | ✅ 采纳                  |
| 桌面端详情页两栏布局            | Expert 4 | ✅ 采纳                  |
| 全站颜色编码统一                | Expert 4 | ✅ 采纳                  |
| Score 进度条渐变色              | Expert 4 | ✅ 采纳                  |
| DocuSign 幂等性保护             | Expert 5 | ✅ 采纳                  |
| 资源上传限制 20 条目            | Expert 5 | ✅ 采纳                  |
| 分表 vs 统一 notes 表           | Expert 6 | ✅ 采纳分表              |
| "合同处理中"拆分两阶段          | Expert 6 | ✅ 采纳                  |
| DocuSign Plan B（Cron 轮询）    | Expert 6 | ✅ 采纳作为后备方案      |

### Round 2 终评

| 专家     | 分数       | 评语                                                                                                                                                            |
| :------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expert 1 | **9/10**   | Pipeline 5 阶段划分精准，KPI 加了超期指标很好。建筑完成度分布在详情页可见，列表页密度合适。                                                                     |
| Expert 2 | **9/10**   | Next Action 可操作化是关键改进。Timeline 7 节点完整覆盖了从申请到上线的全流程。Building 按分数排序合理。                                                        |
| Expert 3 | **9/10**   | Drawer 精简后信息密度合理。搜索范围扩大到城市/国家满足跨区域管理需求。DocuSign P0 是正确决策。                                                                  |
| Expert 4 | **8/10**   | 两栏详情页解决了信息过长问题。颜色编码统一方案可行。建议：Score 渐变色需要确保色盲用户可用——保留数字标注。                                                      |
| Expert 5 | **8/10**   | DocuSign 幂等性保护设计充分。剩余风险：Pipeline 计算需要 JOIN 多表，建议在 stats API 中做缓存或物化。资源上传 JSONB 限制 20 条合理。                            |
| Expert 6 | **8/10**   | 分表决策正确。Plan B（Cron 轮询）作为 DocuSign 后备合理。剩余提醒：阶段停留天数从 updated_at 推算可能不准（任何字段修改都会更新），建议记录具体的状态变更时间。 |
| **综合** | **8.5/10** | **通过，进入下一阶段**                                                                                                                                          |

### 遗留提醒（不阻塞交付）

1. Score 渐变色确保色盲可用（保留数字标注）— 实现时注意
2. Stats API 性能：如供应商数 >500，考虑缓存 — 后续优化
3. 阶段停留天数精度：当前从已有时间戳推算，可能偶有误差 — 可接受

---

## 14. 实施优先级

| 优先级 | 内容                                                    | 依赖                         |
| :----- | :------------------------------------------------------ | :--------------------------- |
| P0     | 列表页 Pipeline 视图 + KPI + 搜索 + Drawer              | 无                           |
| P0     | 详情页两栏布局 + Timeline + Next Action + Building 卡片 | 无                           |
| P0     | `supplier_notes` 表 + notes API + 备注组件              | 数据库创建                   |
| P0     | DocuSign recipient-completed 改造                       | DocuSign Connect 配置确认    |
| P1     | 资源上传入口（Onboarding 表单增强）                     | Supabase Storage bucket 配置 |
