# PRD: Applications 模块重设计

> 版本：v1.0 | 日期：2026-03-08 | 作者：Claude + Neil
> 轨道：Major Track | 状态：方案评审中

---

## 1. 背景与目标

### 1.1 现状问题

| 问题 | 影响 |
|:--|:--|
| 列表无重点 | PENDING/CONVERTED/REJECTED 混合展示，BD 无法快速定位待处理项 |
| 信息层级缺失 | 表格列平铺，无优先级、紧急度标识 |
| BD 视角缺位 | 没有「我的待办」概念，BD 需要肉眼扫描找自己的申请 |
| 详情不清晰 | 展开行仅显示 phone/website/BD selector，无时间线、沟通记录 |
| 无跟进机制 | BD 联系供应商后无处记录，跟进状态全靠记忆 |
| 无数据概览 | 缺少转化率、处理时长等关键运营指标 |

### 1.2 目标

将 Applications 管理页面从「数据展示表格」升级为 **BD 工作台**，核心目标：

1. BD 打开页面 3 秒内知道「今天该联系谁」
2. Admin 一眼看到「哪些申请没分配」和「转化率如何」
3. 每条申请有完整的跟进记录，可追溯

### 1.3 Out of Scope

- 不新增申请状态（不加「已联系」等中间态，用备注替代）
- 不做 Kanban 看板（3 个状态不适合看板形态）
- 不做 BI 级数据分析仪表板
- 不改动供应商端申请表单和流程
- 不改动 `/api/apply` 和 `/api/admin/approve-supplier` 的核心逻辑

---

## 2. 用户角色与核心场景

### 2.1 角色定义

| 角色 | 权限 | 核心需求 |
|:--|:--|:--|
| Admin | 全部申请可见 + 分配 BD + 审批 + 备注 | 分配、监控全局 |
| BD | 自己的申请 + 未分配申请（只读） + 认领 + 审批 + 备注 | 联系供应商、推进转化 |

### 2.2 核心用户故事

**Admin 视角：**

- US-A1: 作为 Admin，我打开页面能立即看到待处理数、未分配数、本周转化数
- US-A2: 作为 Admin，我能快速找到未分配 BD 的申请并一键分配
- US-A3: 作为 Admin，我能按公司名或邮箱搜索特定申请
- US-A4: 作为 Admin，我能查看任意申请的跟进记录

**BD 视角：**

- US-B1: 作为 BD，我打开页面默认看到分配给我的待处理申请
- US-B2: 作为 BD，我能在申请详情中记录每次联系情况
- US-B3: 作为 BD，我能认领未分配的申请
- US-B4: 作为 BD，我能看到每条申请等了多久（紧急度感知）

---

## 3. 信息架构

### 3.1 页面布局

```
┌──────────────────────────────────────────────────────────────┐
│  KPI 统计栏（3 个卡片）                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ 📋 待处理      │  │ ⚠️ 未分配     │  │ 📈 本周转化    │       │
│  │     12        │  │      5       │  │    3 / 8     │        │
│  │  vs 上周 +3   │  │   需要分配    │  │  转化率 37%   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
├──────────────────────────────────────────────────────────────┤
│  工具栏                                                       │
│  [待处理(12)] [已转化(45)] [已拒绝(3)] [全部(60)]              │
│                                          🔍 搜索公司名/邮箱   │
│  BD 筛选: [全部 BD ▾]  (Admin only)                           │
├──────────────────────────────────────────────────────────────┤
│  列表（精简 5 列）                                              │
│                                                               │
│  公司名称          类型     国家    等待时间    操作            │
│  ─────────────────────────────────────────────────────────── │
│  ⚠ ABC Holdings    PBSA    UK     5 天前     [详情] [审批]    │
│    未分配 BD                                                   │
│                                                               │
│  ● XYZ Property    PMC     AU     2 天前     [详情] [审批]    │
│    Sarah Chen                                                 │
│                                                               │
│  ✓ DEF Lettings    Agent   US     —          [详情]           │
│    Tom Wang        已转化                                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  点击 [详情] → 右侧 Drawer 滑出（桌面）/ 全屏页（移动端）       │
│                                                               │
│  ┌─────────────────────────────────────┐                     │
│  │ ABC Holdings                    ✕   │                     │
│  │                                     │                     │
│  │ 📊 基本信息                          │                     │
│  │ 类型: PBSA                          │                     │
│  │ 邮箱: abc@example.com              │                     │
│  │ 电话: +44 20 1234 5678             │                     │
│  │ 国家: United Kingdom               │                     │
│  │ 网站: https://abc.com              │                     │
│  │ 申请时间: 2026-03-03 10:30 UTC     │                     │
│  │ 推荐码: REF123                      │                     │
│  │                                     │                     │
│  │ 👤 BD 分配                          │                     │
│  │ [BD 选择下拉框 ▾]  或 [认领] 按钮    │                     │
│  │                                     │                     │
│  │ 📝 跟进记录                          │                     │
│  │ ┌─────────────────────────────┐    │                     │
│  │ │ 输入跟进备注...        [提交] │    │                     │
│  │ └─────────────────────────────┘    │                     │
│  │                                     │                     │
│  │ 2026-03-07 Sarah:                  │                     │
│  │   "已电话联系，对方表示下周回复"      │                     │
│  │                                     │                     │
│  │ 2026-03-05 Admin:                  │                     │
│  │   "分配给 Sarah，UK 区域负责人"      │                     │
│  │                                     │
│  │ ─────────────────────────────────  │                     │
│  │ [审批]  [拒绝]                       │                     │
│  └─────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 列表列定义（精简为 5 列）

| 列 | 内容 | 说明 |
|:--|:--|:--|
| 公司名称 | 公司名 + BD 名（或「未分配」标记） | 双行显示，主信息 + 副信息 |
| 类型 | supplier_type 缩写 | PBSA / PMC / Agent / Hotel 等 |
| 国家 | country | 直接显示 |
| 等待时间 | 相对时间 | 「2 天前」「1 周前」，CONVERTED/REJECTED 显示「—」 |
| 操作 | [详情] + [审批] | 审批按钮仅 PENDING 可用 |

### 3.3 状态视觉编码

| 状态 | 颜色 | 图标 | 行样式 |
|:--|:--|:--|:--|
| PENDING + 未分配 | Warning (橙色) | AlertTriangle | 左侧橙色边框 |
| PENDING + 已分配 | Primary (蓝色) | Clock | 左侧蓝色边框 |
| CONVERTED | Success (绿色) | CheckCircle2 | 正常行 |
| REJECTED | Muted (灰色) | XCircle | 正常行，文字变淡 |

---

## 4. 数据模型变更

### 4.1 新增表：`application_notes`

```sql
CREATE TABLE application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,          -- suppliers.id (BD/Admin)
  author_email TEXT NOT NULL,       -- 冗余存储，便于显示
  content TEXT NOT NULL,            -- 备注内容，最大 2000 字符
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_application_notes_app_id ON application_notes(application_id);

-- RLS
ALTER TABLE application_notes ENABLE ROW LEVEL SECURITY;

-- BD/Admin 可查看和创建自己的备注
CREATE POLICY "BD and Admin can view notes"
  ON application_notes FOR SELECT
  USING (
    author_id IN (
      SELECT id FROM suppliers WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM suppliers WHERE user_id = auth.uid() AND contact_email IN (
        SELECT unnest(ARRAY['admin1@uhomes.com', 'admin2@uhomes.com'])
      )
    )
  );
```

> 注意：RLS 策略的 admin 邮箱列表需与 `ADMIN_EMAILS` 保持同步。实际实现中，备注的读写通过 Admin Client（service_role）绕过 RLS，由 API 路由自行鉴权。

### 4.2 applications 表无变更

现有列已满足需求，不新增列。

---

## 5. API 变更

### 5.1 新增 API

#### `GET /api/admin/applications/stats`

返回 KPI 统计数据。

```typescript
// Response
{
  pending_total: number;         // PENDING 总数
  unassigned_count: number;      // PENDING 且未分配 BD
  converted_this_week: number;   // 本周 CONVERTED 数量
  total_this_week: number;       // 本周总申请数（用于计算转化率）
  pending_last_week: number;     // 上周同期 PENDING 数（用于对比）
}
```

Auth: Session（BD/Admin）。BD 只看自己的统计，Admin 看全局。

#### `GET /api/admin/applications/[applicationId]/notes`

获取某申请的所有备注。

```typescript
// Response
{
  notes: Array<{
    id: string;
    author_email: string;
    content: string;
    created_at: string;
  }>
}
```

Auth: Session（BD/Admin）。BD 只能看自己分配的申请的备注，Admin 可看全部。

#### `POST /api/admin/applications/[applicationId]/notes`

添加备注。

```typescript
// Request
{ content: string }  // 1-2000 字符

// Response
{ success: true, note: { id, author_email, content, created_at } }
```

Auth: Session（BD/Admin）。BD 只能对自己分配的申请添加备注。

#### `POST /api/admin/applications/[applicationId]/claim`

BD 认领未分配的申请。

```typescript
// Response
{ success: true, application_id: string }
```

Auth: Session（BD）。原子操作：只有 `assigned_bd_id IS NULL` 时才能认领（防止竞态）。

### 5.2 现有 API 改动

#### `GET /admin/applications/page.tsx`（Server Component）

增加查询参数支持：
- `?status=PENDING` — 状态筛选（默认 PENDING）
- `?search=xxx` — 公司名/邮箱模糊搜索
- `?bd=xxx` — BD ID 筛选（Admin only）

数据获取改为支持分页（初期可选，数据量小时可暂不分页）。

---

## 6. 组件设计

### 6.1 新增组件

| 组件 | 类型 | 职责 |
|:--|:--|:--|
| `ApplicationStats` | Client | 3 个 KPI 卡片，调用 stats API |
| `ApplicationSearchBar` | Client | 搜索框 + BD 筛选下拉 |
| `ApplicationDrawer` | Client | 右侧详情抽屉面板（桌面） |
| `ApplicationDetailMobile` | Client | 全屏详情页（移动端） |
| `ApplicationNotes` | Client | 备注列表 + 输入框 |
| `ClaimButton` | Client | BD 认领按钮 |

### 6.2 改造组件

| 组件 | 改动 |
|:--|:--|
| `ApplicationList` | 增加搜索、BD 筛选逻辑；默认状态改为 PENDING |
| `ApplicationTable` | 精简列为 5 列；行样式按状态+分配情况区分；点击行打开 Drawer 而非展开 |
| `ApplicationExpandedRow` | 移除（功能迁移到 Drawer） |

### 6.3 响应式策略

| 断点 | 详情展示方式 | 列表适配 |
|:--|:--|:--|
| `> 1024px` | 右侧 Drawer（宽度 420px） | 完整表格 |
| `768-1024px` | 右侧 Drawer（宽度 360px） | 精简表格（隐藏类型列） |
| `< 768px` | 全屏覆盖页 | 卡片列表 |

---

## 7. 权限矩阵

| 操作 | Admin | BD（自己的申请） | BD（他人的申请） | BD（未分配） |
|:--|:--|:--|:--|:--|
| 查看列表 | 全部 | 自己的 + 未分配 | 不可见 | 只读 |
| 查看详情 | 全部 | 可 | 不可 | 可（只读） |
| 分配 BD | 可 | — | — | — |
| 认领 | — | — | — | 可 |
| 审批/拒绝 | 可 | 可 | 不可 | 不可 |
| 添加备注 | 可 | 可 | 不可 | 不可 |
| 查看备注 | 可 | 可 | 不可 | 不可 |
| 查看 KPI | 全局 | 个人 | — | — |

---

## 8. 国际化考量

| 场景 | 处理方式 |
|:--|:--|
| 相对时间显示 | 使用 `Intl.RelativeTimeFormat`，自动适配浏览器语言 |
| supplier_type 显示 | 当前为英文枚举值，列表用缩写映射表显示 |
| 搜索 | 使用 Supabase `ilike` 模糊匹配，支持非 ASCII 字符 |
| 备注内容 | 纯文本，不做语言限制 |
| 日期 | Drawer 中精确时间使用 `Intl.DateTimeFormat` + UTC 标注 |

---

## 9. 竞品分析

| 平台 | 供应商入驻列表设计 | 可借鉴点 |
|:--|:--|:--|
| Booking.com Extranet | 看板式 Pipeline，每阶段可拖拽 | 状态可视化；但不适合我们（状态太少） |
| Airbnb Host Dashboard | 卡片列表 + 顶部 KPI | 3 秒规则、相对时间、KPI 卡片 |
| Stripe Dashboard | 精简表格 + 侧边详情面板 | Drawer 交互模式、信息密度控制 |
| HubSpot CRM | 联系人列表 + 跟进记录 | 备注/活动时间线设计 |
| Salesforce | 全功能 CRM 列表视图 | 太重，不适合当前阶段 |

---

## 10. 文件清单

### 新增文件

```
src/app/api/admin/applications/stats/route.ts
src/app/api/admin/applications/[applicationId]/notes/route.ts
src/app/api/admin/applications/[applicationId]/claim/route.ts
src/components/admin/ApplicationStats.tsx
src/components/admin/ApplicationSearchBar.tsx
src/components/admin/ApplicationDrawer.tsx
src/components/admin/ApplicationNotes.tsx
src/components/admin/ClaimButton.tsx
supabase/migrations/20260308_create_application_notes.sql
```

### 改造文件

```
src/app/admin/applications/page.tsx
src/components/admin/ApplicationList.tsx
src/components/admin/ApplicationTable.tsx
```

### 删除文件

```
src/components/admin/ApplicationExpandedRow.tsx  → 功能迁移到 Drawer
```

---

## 11. 风险与缓解

| 风险 | 缓解措施 |
|:--|:--|
| `application_notes` 表需手动创建 | 提供 migration SQL + 写入 manual-actions.md |
| BD 认领竞态（两个 BD 同时认领） | 原子 UPDATE：`.is("assigned_bd_id", null)` WHERE 守卫 |
| 备注内容 XSS | 服务端 Zod 校验长度 + 前端渲染时使用 React（自动转义） |
| Drawer 动画性能 | 使用 CSS `transform: translateX()` + `will-change`，避免 layout thrashing |
| 移动端 Drawer 体验差 | 移动端用全屏页替代 Drawer |
