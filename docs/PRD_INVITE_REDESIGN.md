# PRD: Invite Supplier 页面重设计

> 版本：v1.0 | 日期：2026-03-10 | 作者：Claude + Neil
> 轨道：Standard Track | 状态：方案评审中

---

## 1. 背景与目标

### 1.1 现状问题

| 问题         | 影响                                                                                          |
| :----------- | :-------------------------------------------------------------------------------------------- |
| 孤立表单     | 页面只有一个 `max-w-lg` 表单，缺乏上下文。BD 不知道已邀请多少人、什么状态                     |
| 视觉节奏断裂 | Applications/Suppliers 都有 Stats + 搜索 + 表格三段结构，invite 页面只有标题+表单，风格不统一 |
| 宽屏留白     | `max-w-lg` 限宽导致侧边栏布局下右侧大面积空白                                                 |
| 成功反馈弱   | 提交成功只有一条内嵌 alert，无后续引导                                                        |
| 发现性差     | Pre-fill Contract Fields 折叠在底部，大部分 BD 不知道它存在                                   |
| 缺乏流程引导 | 新 BD 不了解邀请后的完整流程，表单缺少上下文说明                                              |

### 1.2 目标

将 invite 页面从「孤立表单」升级为「邀请操作中心」：

1. BD 打开页面能看到邀请流程全景和历史记录
2. 表单提交后有明确的后续引导
3. 视觉风格与 Applications/Suppliers 页面对齐

### 1.3 Out of Scope

- 不做批量邀请（后续迭代）
- 不新增 API 端点（纯前端重构）
- 不改动 `invite-supplier` API 逻辑
- 不改动 `InviteForm` 的表单字段和校验逻辑

---

## 2. 设计方案

### 2.1 页面结构（Desktop ≥ 768px）

```
┌─────────────────────────────────────────────────────────┐
│ [UserPlus icon] Invite Supplier                         │
│ Send an onboarding invitation to a new property partner │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌── Onboarding Flow Steps (横向4步) ──────────────┐   │
│  │ ① Invite  →  ② Register  →  ③ Contract  →  ④ Live│   │
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌── Left Column (表单) ──┐ ┌── Right Column (引导) ──┐│
│  │                        │ │                          ││
│  │  [InviteForm 组件]     │ │  Tips & Guidelines       ││
│  │  · Email *             │ │  · 温馨提示卡片          ││
│  │  · Company *           │ │  · 常见问题              ││
│  │  · Type *              │ │  · Pre-fill 说明         ││
│  │  · Phone               │ │                          ││
│  │  · Website             │ │                          ││
│  │  · Contract Fields     │ │                          ││
│  │  · [Send Invitation]   │ │                          ││
│  │                        │ │                          ││
│  └────────────────────────┘ └──────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 2.2 页面结构（Mobile < 768px）

```
┌──────────────────────┐
│ [UserPlus] Invite... │
│ subtitle             │
├──────────────────────┤
│ Flow Steps (2x2 grid)│
├──────────────────────┤
│ [InviteForm]         │
│ ...                  │
├──────────────────────┤
│ Tips (折叠式)        │
└──────────────────────┘
```

移动端右侧引导区折叠到表单下方，流程步骤条从横排变为 2×2 网格。

### 2.3 组件拆分

| 组件              | 文件                                       | 职责               |
| :---------------- | :----------------------------------------- | :----------------- |
| `InvitePage`      | `src/app/admin/invite/page.tsx`            | 页面容器，双栏布局 |
| `InviteFlowSteps` | `src/components/admin/InviteFlowSteps.tsx` | 4步流程指示器      |
| `InviteForm`      | `src/components/admin/InviteForm.tsx`      | 表单（已有，微调） |
| `InviteTips`      | `src/components/admin/InviteTips.tsx`      | 右侧引导面板       |

### 2.4 各组件详细设计

#### 2.4.1 InviteFlowSteps — 流程步骤条

展示供应商 onboarding 4个阶段，让 BD 理解邀请操作在全流程中的位置。

```
 ① Invite          ② Register         ③ Contract          ④ Go Live
 [UserPlus]   ───→  [UserCheck]   ───→  [FileSignature] ───→ [Globe]
 "You send the      "They create       "Sign the partner    "Buildings
  invitation"        their account"     agreement"           go live"
```

- 第一步高亮（品牌色背景圆），其余步骤灰色
- 步骤之间用虚线连接（非实线，表示"尚未到达"）
- 每步：图标 + 标题 + 一行说明文字
- 移动端 2×2 grid，无连接线

#### 2.4.2 InviteForm 微调

保持现有逻辑不变，仅做以下调整：

1. **移除 `max-w-lg`**：宽度由父容器双栏布局控制
2. **成功状态升级**：提交成功后，替换表单为成功卡片：
   ```
   ┌──────────────────────────────┐
   │    ✓ Invitation Sent!        │
   │                              │
   │  [company] will receive an   │
   │  email at [email] shortly.   │
   │                              │
   │  [Invite Another] [View →]   │
   └──────────────────────────────┘
   ```

   - "Invite Another" 按钮重置表单
   - "View Suppliers →" 链接跳转到 `/admin/suppliers`
3. **必填说明**：表单顶部加 `* Required` 说明行
4. **Phone placeholder 优化**：改为 `+1 234 567 8900`（更通用）

#### 2.4.3 InviteTips — 右侧引导面板

使用卡片列表，每张卡片包含图标 + 标题 + 说明文字：

**卡片 1：Quick Tips**

- 图标：Lightbulb
- 内容：
  - Use the supplier's official business email
  - The invitation link expires in 7 days
  - Supplier will be assigned to you as their BD

**卡片 2：Pre-fill Contract Fields**

- 图标：FileText
- 内容：
  - If you already have contract details, expand the "Pre-fill Contract Fields" section below the form
  - Pre-filled contracts skip the DRAFT stage and go directly to Pending Review

**卡片 3：Need Help?**

- 图标：HelpCircle
- 内容：
  - For bulk invitations, contact your admin
  - Having issues? Reach out on the internal channel

### 2.5 视觉规范

所有样式严格使用 `globals.css` 定义的 CSS 变量：

| 元素           | 样式                                                                          |
| :------------- | :---------------------------------------------------------------------------- |
| 步骤条高亮步骤 | `bg-[var(--color-primary-light)]`，图标 `text-[var(--color-primary)]`         |
| 步骤条未来步骤 | `bg-[var(--color-bg-secondary)]`，图标 `text-[var(--color-text-muted)]`       |
| 步骤连接线     | `border-dashed border-[var(--color-border)]`                                  |
| Tips 卡片      | `border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-primary)]` |
| 成功卡片       | `bg-[var(--color-success-light)] border border-[var(--color-success)]`        |
| 成功图标       | `text-[var(--color-success)]` CheckCircle2                                    |

### 2.6 响应式断点

| 断点         | 布局                                    |
| :----------- | :-------------------------------------- |
| `< 768px`    | 单栏，步骤 2×2 grid，Tips 在表单下方    |
| `768–1024px` | 双栏 `grid-cols-5`：表单占 3，Tips 占 2 |
| `> 1024px`   | 双栏 `grid-cols-3`：表单占 2，Tips 占 1 |

### 2.7 国际化准备

- 所有间距用 CSS 逻辑属性（`ms-*`/`me-*`/`ps-*`/`pe-*`）
- 文本容器不设固定宽度
- 图标用 Lucide 抽象概念图标（UserPlus, UserCheck, FileSignature, Globe, Lightbulb, HelpCircle）

---

## 3. 影响范围

### 3.1 修改文件

| 文件                                       | 变更类型 | 说明                        |
| :----------------------------------------- | :------- | :-------------------------- |
| `src/app/admin/invite/page.tsx`            | 修改     | 双栏布局 + 流程步骤 + Tips  |
| `src/components/admin/InviteForm.tsx`      | 修改     | 移除 max-w-lg，成功状态升级 |
| `src/components/admin/InviteFlowSteps.tsx` | 新建     | 4步流程指示器               |
| `src/components/admin/InviteTips.tsx`      | 新建     | 右侧引导面板                |

### 3.2 不修改的文件

- `invite-form-utils.ts` — 校验逻辑不变
- `ContractFieldGrid.tsx` — 复用不变
- `/api/admin/invite-supplier` — API 不变
- 数据库 — 无 migration

### 3.3 风险评估

| 风险                        | 等级 | 缓解措施                                    |
| :-------------------------- | :--- | :------------------------------------------ |
| InviteForm 修改影响现有功能 | 低   | 只移除外层样式 + 新增成功状态，核心逻辑不变 |
| 新组件超 300 行             | 低   | FlowSteps ≈50 行，Tips ≈60 行，均远低于限制 |
| 移动端布局适配              | 中   | 测试用例覆盖三个断点                        |

---

## 4. 测试方案

### 4.1 单元测试

#### TC-INVITE-UI-001: InviteFlowSteps 渲染

```
Given: 组件挂载
Then:  渲染 4 个步骤（Invite / Register / Contract / Go Live）
And:   第一步有高亮样式（primary-light 背景）
And:   其余步骤为灰色样式
```

#### TC-INVITE-UI-002: InviteTips 渲染

```
Given: 组件挂载
Then:  渲染 3 张 tips 卡片
And:   每张包含图标 + 标题 + 说明文字
```

#### TC-INVITE-UI-003: 成功状态显示成功卡片

```
Given: 表单提交成功
Then:  表单区域替换为成功卡片
And:   显示提交的公司名和邮箱
And:   显示 "Invite Another" 按钮
And:   显示 "View Suppliers" 链接
```

#### TC-INVITE-UI-004: "Invite Another" 重置表单

```
Given: 成功卡片已显示
When:  点击 "Invite Another"
Then:  成功卡片隐藏
And:   表单恢复初始状态（所有字段清空）
And:   Contract Fields 折叠区关闭
```

#### TC-INVITE-UI-005: 现有校验逻辑不受影响

```
Given: 空表单
When:  点击 Send Invitation
Then:  显示 3 个必填字段错误（Email, Company, Type）
And:   不发送请求
```

### 4.2 可视化/布局测试（手动）

#### TC-INVITE-VISUAL-001: Desktop 双栏布局

```
Viewport: 1280px
Expected: 左栏表单 + 右栏 Tips 并排显示
And:      流程步骤条横排 4 步
And:      步骤间有虚线连接
```

#### TC-INVITE-VISUAL-002: Tablet 布局

```
Viewport: 768px
Expected: 双栏（3:2 比例）
And:      流程步骤横排 4 步
```

#### TC-INVITE-VISUAL-003: Mobile 单栏布局

```
Viewport: 375px
Expected: 单栏，Tips 在表单下方
And:      流程步骤 2×2 网格
And:      无步骤连接线
```

### 4.3 回归测试

#### TC-INVITE-REGR-001: 表单提交功能不受影响

```
Given: 填写 Email + Company + Type
When:  点击 Send Invitation
Then:  请求 POST /api/admin/invite-supplier
And:   payload 包含正确字段
```

#### TC-INVITE-REGR-002: Contract Fields 预填功能

```
Given: 展开 Pre-fill Contract Fields
And:   填写 partner_company_name
When:  提交表单
Then:  payload 包含 contractFields 对象
```

#### TC-INVITE-REGR-003: 错误处理

```
Given: API 返回 4xx/5xx
Then:  显示错误 alert（红色背景 + AlertCircle 图标）
And:   表单保持用户输入，不清空
```

### 4.4 测试文件规划

| 文件                                                      | 覆盖范围                       |
| :-------------------------------------------------------- | :----------------------------- |
| `src/components/admin/__tests__/InviteFlowSteps.test.tsx` | TC-001                         |
| `src/components/admin/__tests__/InviteTips.test.tsx`      | TC-002                         |
| `src/components/admin/__tests__/InviteForm.test.tsx`      | TC-003, 004, 005, REGR-001~003 |

---

## 5. 实现计划

| 步骤 | 内容                                               | 预计行数               |
| :--- | :------------------------------------------------- | :--------------------- |
| 1    | 创建 `InviteFlowSteps.tsx`                         | ~50 行                 |
| 2    | 创建 `InviteTips.tsx`                              | ~60 行                 |
| 3    | 修改 `InviteForm.tsx`：移除外层限宽 + 成功状态卡片 | 净增 ~30 行（总 ≤290） |
| 4    | 修改 `invite/page.tsx`：双栏布局 + 引入新组件      | ~50 行                 |
| 5    | 编写测试文件                                       | ~200 行                |
