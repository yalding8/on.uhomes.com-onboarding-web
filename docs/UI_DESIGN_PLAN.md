# Supplier Portal — 系统性 UI 设计规划

> 基于对 6 个供应商页面、20 个组件、3 个状态机的全面审计后产出。

---

## 一、供应商全生命周期视图

```
访客 ──→ 提交申请 ──→ 等待审批 ──→ 合同签署 ──→ 物业上架
 │          │            │            │            │
 / (landing) /dashboard   /dashboard   /dashboard   /onboarding/*
 /login      (under-review)(contract)  (buildings)
```

**5 个场景 × 对应页面状态：**

| #   | 用户场景           | 触达页面                                          | 当前状态              |
| --- | ------------------ | ------------------------------------------------- | --------------------- |
| S1  | 未登录访客         | `/` 首页 + `/login`                               | ✅ 已实现，可优化     |
| S2  | 已登录，无申请     | `/` 首页（表单预填邮箱）                          | ✅ 已实现             |
| S3  | 已登录，申请审核中 | `/dashboard` (ApplicationUnderReview)             | ✅ 已实现，视觉待优化 |
| S4  | PENDING_CONTRACT   | `/dashboard` (ContractPreview)                    | ✅ 已实现，交互待优化 |
| S5  | SIGNED             | `/dashboard` (BuildingCards) + `/onboarding/[id]` | ✅ 已实现，需补全     |

---

## 二、核心 UX 问题（按优先级排序）

### P0 — 必须修复

| 编号 | 问题                                 | 影响                                                                                                                         | 建议方案                                                 |
| ---- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| P0-1 | **无统一导航壳（Navigation Shell）** | 每个页面各自实现导航栏，样式/结构不一致。Dashboard 没有品牌 logo，Landing page 有；法律页面有 "Back to Home"，Dashboard 没有 | 抽取共享 `<SupplierShell>` 布局组件                      |
| P0-2 | **Dashboard 三态视觉断裂**           | Under Review / Contract / Buildings 三个状态的 Dashboard 布局完全不同，用户升级后感觉是不同的系统                            | 统一 Dashboard 骨架：左侧固定区（品牌+导航）+ 右侧内容区 |
| P0-3 | **无生命周期进度指示**               | 用户不知道自己在 5 步中的哪一步，不知道下一步是什么                                                                          | 顶部添加 StepIndicator 组件                              |

### P1 — 建议优化

| 编号 | 问题                                | 影响                                          | 建议方案                           |
| ---- | ----------------------------------- | --------------------------------------------- | ---------------------------------- |
| P1-1 | ContractViewer.tsx 是遗留 Mock 代码 | 未追踪文件，有 TEST_SECRET_MOCK 硬编码        | 删除或替换                         |
| P1-2 | Under Review 状态内容单薄           | 用户等待期只看到一个卡片+平台介绍，感觉被遗忘 | 增加预期时间线、FAQ、联系入口      |
| P1-3 | SIGNED Dashboard 空建筑列表提示弱   | 只有灰色文字 "No properties yet..."           | 增加进度说明和预期时间             |
| P1-4 | 移动端导航缺失                      | Dashboard 页面在移动端无汉堡菜单              | 复用 Admin 端的 MobileSidebar 模式 |

### P2 — 锦上添花

| 编号 | 问题                           | 建议方案                                                |
| ---- | ------------------------------ | ------------------------------------------------------- |
| P2-1 | 无帮助/FAQ 入口                | 添加浮动帮助按钮或 FAQ 折叠面板                         |
| P2-2 | 品牌一致性                     | Landing page footer 和 Dashboard 之间缺少视觉连接       |
| P2-3 | 法律页面导航与供应商页面不统一 | 法律页面使用 LegalLayout，与 SupplierShell 可共享导航栏 |

---

## 三、设计方案

### 3.1 统一导航壳 `<SupplierShell>` (P0-1)

**目标：** 所有供应商页面共享一致的顶部导航栏。

```
┌──────────────────────────────────────────────────────┐
│  uhomes.com Partners    [Step Indicator]    email ▼  │
│  (logo, link to /)                         Sign Out  │
└──────────────────────────────────────────────────────┘
│                                                      │
│  [Page Content]                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
│  Footer: © 2026 · Privacy · Terms · Contact         │
└──────────────────────────────────────────────────────┘
```

**实现路径：**

- 新建 `src/components/layout/SupplierShell.tsx`
- Props: `user: { email: string } | null`, `currentStep?: SupplierStep`
- 包含：品牌 logo（link to `/`）、StepIndicator（登录后）、用户菜单（email + Sign Out）、Footer
- 应用到：`/dashboard`、`/onboarding/[id]`
- Landing page (`/`) 和 Login page (`/login`) 保持独立布局（营销风格）

**文件变更：**

| 文件                                       | 操作                     |
| ------------------------------------------ | ------------------------ |
| `src/components/layout/SupplierShell.tsx`  | 新建                     |
| `src/components/layout/SupplierNav.tsx`    | 新建（导航栏）           |
| `src/components/layout/SupplierFooter.tsx` | 新建（页脚）             |
| `src/app/dashboard/page.tsx`               | 修改，包裹 SupplierShell |
| `src/app/onboarding/[buildingId]/page.tsx` | 修改，包裹 SupplierShell |

---

### 3.2 生命周期进度指示器 `<StepIndicator>` (P0-3)

**目标：** 让用户清晰了解自己在注册流程中的位置。

```
  ① Apply    ② Review    ③ Contract    ④ Onboarding
  ───●───────────○────────────○─────────────○───
       (current)
```

**5 步定义：**

| Step | 标签             | 对应状态                        |
| ---- | ---------------- | ------------------------------- |
| 1    | Apply            | NEW（未提交申请）               |
| 2    | Under Review     | NEW（已提交申请）               |
| 3    | Sign Contract    | PENDING_CONTRACT                |
| 4    | Setup Properties | SIGNED（building 列表）         |
| 5    | Live             | SIGNED（有 published building） |

**实现路径：**

- 新建 `src/components/layout/StepIndicator.tsx`
- Props: `currentStep: 1 | 2 | 3 | 4 | 5`
- 纯视觉组件，无状态逻辑
- 在 SupplierShell 中根据 supplier 状态计算 step

---

### 3.3 Dashboard 统一骨架 (P0-2)

**目标：** 三个 Dashboard 状态共享统一的页面结构，只替换内容区域。

**统一结构：**

```
┌─ SupplierShell (Nav + StepIndicator) ────────────────┐
│                                                      │
│  ┌─ Welcome Header ──────────────────────────────┐   │
│  │  Welcome, {companyName || email}               │   │
│  │  Your onboarding portal                        │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Status-Specific Content ──────────────────────┐  │
│  │                                                 │  │
│  │  [S3] ApplicationUnderReview + Timeline         │  │
│  │  [S4] ContractPreview + Actions                 │  │
│  │  [S5] BuildingCard Grid                         │  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Platform Overview (S3/S4 only) ──────────────┐   │
│  │  uhomes.com / pro.uhomes.com cards             │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
└─ SupplierShell (Footer) ─────────────────────────────┘
```

**文件变更：**

| 文件                                             | 操作 | 说明                                             |
| ------------------------------------------------ | ---- | ------------------------------------------------ |
| `src/app/dashboard/page.tsx`                     | 重构 | 提取 Welcome Header 为共享块，包裹 SupplierShell |
| `src/components/form/ApplicationUnderReview.tsx` | 修改 | 增加审核时间线、FAQ 折叠                         |

---

### 3.4 各场景页面细化设计

#### S1/S2: Landing Page (`/`)

**当前状态：** 已实现，基本完善。

**优化项：**

- [ ] 登录用户（S2）的导航栏已显示 email + Sign Out，保持不变
- [ ] 社交证明区数字可从数据库动态读取（后续优化，非本期）

**不变更：** 保持现有两栏布局（Hero + ApplicationForm）

---

#### S3: Dashboard — 申请审核中

**当前 UI：** 居中的 Under Review 卡片 + PlatformOverview

**优化后设计：**

```
┌─ SupplierShell ──────────────────────────────────────┐
│  StepIndicator: ●──●──○──○──○  (Step 2: Under Review)│
│                                                      │
│  ┌─ Welcome Header ──────────────────────────────┐   │
│  │  Welcome, {email}                              │   │
│  │  Your onboarding portal                        │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Application Status Card ─────────────────────┐   │
│  │  🕐 Application Under Review                   │   │
│  │                                                │   │
│  │  Our BD team is reviewing your application.    │   │
│  │  Typical review time: 1–3 business days.       │   │
│  │                                                │   │
│  │  Questions? contact@uhomes.com                 │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ What Happens Next ───────────────────────────┐   │
│  │  ✓ Application Received                        │   │
│  │  → Under Review (current)                      │   │
│  │  ○ Contract Preparation                        │   │
│  │  ○ Sign & Go Live                              │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ PlatformOverview ────────────────────────────┐   │
│  │  uhomes.com / pro.uhomes.com                   │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**新组件：** `<OnboardingTimeline step={2} />` — 简单的垂直时间线。

---

#### S4: Dashboard — 合同签署

**当前 UI：** Pending Actions + ContractPreview + PlatformOverview

**优化后设计：**

```
┌─ SupplierShell ──────────────────────────────────────┐
│  StepIndicator: ●──●──●──○──○  (Step 3: Contract)    │
│                                                      │
│  ┌─ Welcome Header ──────────────────────────────┐   │
│  │  Welcome, {companyName}                        │   │
│  │  Your onboarding portal                        │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Contract Action Card ────────────────────────┐   │
│  │  (ContractPreview — 保持现有实现)               │   │
│  │  根据合同 6 个状态渲染不同内容                    │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ PlatformOverview ────────────────────────────┐   │
│  │  uhomes.com / pro.uhomes.com                   │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**变更：** 仅包裹 SupplierShell + StepIndicator。ContractPreview 和 ContractStatusContent 保持不变。

---

#### S5: Dashboard — 物业管理

**当前 UI：** Welcome + BuildingCard grid

**优化后设计：**

```
┌─ SupplierShell ──────────────────────────────────────┐
│  StepIndicator: ●──●──●──●──○  (Step 4: Properties)  │
│                                                      │
│  ┌─ Welcome Header ──────────────────────────────┐   │
│  │  Welcome, {companyName}                        │   │
│  │  Your onboarding portal                        │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Properties Section ──────────────────────────┐   │
│  │  Your Properties ({count})                     │   │
│  │                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │ BuildingCard │  │ BuildingCard │             │   │
│  │  └─────────────┘  └─────────────┘             │   │
│  │                                                │   │
│  │  (empty state: extraction pipeline message)    │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**变更：** 包裹 SupplierShell + StepIndicator。BuildingCard 保持不变。

---

#### Onboarding Editor (`/onboarding/[buildingId]`)

**当前 UI：** Back to Dashboard 面包屑 + OnboardingForm（两栏）

**优化后设计：**

```
┌─ SupplierShell ──────────────────────────────────────┐
│  StepIndicator: ●──●──●──●──○  (Step 4)              │
│                                                      │
│  ← Back to Dashboard                                 │
│                                                      │
│  ┌─ OnboardingForm (保持现有两栏布局) ───────────┐   │
│  │  Left: FieldGroups + ScoreBar                  │   │
│  │  Right: GapReportPanel                         │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**变更：** 仅包裹 SupplierShell。面包屑和 OnboardingForm 保持不变。

---

## 四、实施计划（分阶段）

### Phase 1: 基础设施（统一导航壳）

**预估工作量：** 3-4 个组件

| 序号 | 任务                                          | 涉及文件                              |
| ---- | --------------------------------------------- | ------------------------------------- |
| 1.1  | 创建 `SupplierNav.tsx`                        | 新建                                  |
| 1.2  | 创建 `SupplierFooter.tsx`                     | 新建                                  |
| 1.3  | 创建 `SupplierShell.tsx`（组合 Nav + Footer） | 新建                                  |
| 1.4  | 创建 `StepIndicator.tsx`                      | 新建                                  |
| 1.5  | Dashboard 接入 SupplierShell                  | 修改 dashboard/page.tsx               |
| 1.6  | Onboarding 接入 SupplierShell                 | 修改 onboarding/[buildingId]/page.tsx |

### Phase 2: Dashboard 状态优化

**预估工作量：** 2 个组件修改

| 序号 | 任务                                    | 涉及文件                        |
| ---- | --------------------------------------- | ------------------------------- |
| 2.1  | 优化 ApplicationUnderReview：增加时间线 | 修改 ApplicationUnderReview.tsx |
| 2.2  | 创建 `OnboardingTimeline.tsx`           | 新建                            |
| 2.3  | Dashboard Welcome Header 提取为共享块   | 修改 dashboard/page.tsx         |

### Phase 3: 清理与收尾

| 序号 | 任务                                     | 涉及文件 |
| ---- | ---------------------------------------- | -------- |
| 3.1  | 删除遗留 ContractViewer.tsx（Mock 代码） | 删除     |
| 3.2  | 法律页面 LegalLayout 复用 SupplierNav    | 可选优化 |
| 3.3  | 移动端适配验证                           | 各页面   |

---

## 五、不在本期范围

- Landing page 重设计（当前已完善）
- Login page 重设计（当前已完善）
- Admin 后台 UI 优化（独立规划）
- 数据可视化/分析面板
- 国际化/多语言支持
- 深色模式

---

## 六、验证检查清单

- [ ] 所有颜色使用 CSS 变量，无硬编码 hex
- [ ] Mobile-first 三断点适配
- [ ] 每个文件 ≤ 300 行
- [ ] TypeScript 无 `any` 类型
- [ ] `npx prettier --write .` 通过
- [ ] `npx tsc --noEmit` 通过
- [ ] `bash scripts/check-file-lines.sh` 通过
