# uhomes.com Partners — 前端设计规范

> 本文档是 AI Agent 和开发者的**常驻设计约束**，所有 UI 变更必须遵守。
> 参考来源：Stripe Dashboard、Airbnb Host、Shopify Partners、Booking.com Extranet。

---

## 一、设计哲学

### 核心定位：「温暖专业」（Warm Professional）

uhomes.com 是服务 200+ 国家国际学生的住宿平台。供应商端面向全球物业合作伙伴，设计必须：

1. **专业但不冰冷** — 避免纯数据仪表板风格，增加人文温度
2. **简洁但不空洞** — 每个等待状态都应有引导内容，让用户知道「下一步是什么」
3. **国际化但不泛化** — 使用文化中性的图标和色彩，为未来多语言做好技术准备
4. **渐进式展示** — 根据用户生命周期阶段，只展示当前需要的信息

### 反模式清单（禁止出现）

| 反模式 | 为什么不行 | 正确做法 |
|:-------|:----------|:---------|
| 纯文字空状态（"No data yet"） | 用户感到被遗忘 | 插画/图标 + 说明 + 预期时间 + CTA |
| 只有一行提示的等待页 | 等待期用户焦虑 | 时间线 + 平台介绍 + FAQ 入口 |
| 密集的表格式布局 | B2B ≠ 数据看板 | 卡片式布局 + 充分留白 |
| 突然切换的页面风格 | 状态升级时体验断裂 | 统一 Shell + 渐变内容 |
| 无反馈的交互 | 用户不确定操作是否生效 | 微交互 + Toast 通知 |

---

## 二、色彩系统与语义

### 色彩使用规则

所有颜色必须引用 `globals.css` 中 `@theme` 定义的 CSS 变量。

| 语义 | 变量 | 适用场景 |
|:-----|:-----|:---------|
| 品牌主色 | `--color-primary` | CTA 按钮、当前步骤高亮、品牌标识 |
| 品牌浅底 | `--color-primary-light` | 提示卡片背景、图标底色 |
| 成功 | `--color-success` | 已完成步骤、发布状态、进度达标 |
| 警告 | `--color-warning` | 等待中状态图标、缺失提示 |
| 文本层级 | `primary > secondary > muted` | 标题 > 正文 > 辅助/占位 |

### 跨文化色彩安全

- `--color-primary`（#FF5A5F 珊瑚红）：全球正面联想，类似 Airbnb 品牌色，安全
- `--color-success`（#00B67A 绿色）：**永远同时使用形状差异**（✓ 图标），不单靠颜色表意
- 禁止用纯红色表示错误（与品牌色冲突），错误场景用 `--color-warning` + AlertCircle 图标

---

## 三、排版与间距

### 字体层级

| 用途 | Tailwind 类 | 场景 |
|:-----|:-----------|:-----|
| 页面大标题 | `text-2xl font-bold` | Dashboard Welcome |
| 区块标题 | `text-lg font-semibold` | "Your Properties"、"Pending Actions" |
| 正文/描述 | `text-sm` | 卡片内容、状态说明 |
| 辅助文字 | `text-xs text-[var(--color-text-muted)]` | 时间戳、步骤计数 |

### 间距规范

| 层级 | 间距 | 用途 |
|:-----|:-----|:-----|
| 页面内边距 | `p-4 md:p-8` | 由 SupplierLayout 统一提供 |
| 区块间距 | `space-y-6` | Dashboard 内各卡片区块 |
| 卡片内边距 | `p-5` 或 `p-6` | 标准内容卡片 |
| 网格间距 | `gap-4` | BuildingCard / PlatformOverview 网格 |
| 最大宽度 | `max-w-4xl`（仪表板） / `max-w-6xl`（编辑页） | 内容区约束 |

---

## 四、组件设计模式

### 4.1 卡片（Card）

三种卡片类型：

```
信息卡片（静态）：
  rounded-xl border border-[var(--color-border)]
  bg-[var(--color-bg-secondary)] p-5

可交互卡片（链接/按钮）：
  + hover:shadow-md hover:-translate-y-0.5
  + hover:border-[var(--color-primary)]/30
  + transition-all duration-200

状态卡片（强提示）：
  rounded-2xl shadow-xl text-center
  bg-[var(--color-bg-primary)] p-8 md:p-12
```

### 4.2 空状态（Empty State）

**必须包含三要素**：视觉元素 + 说明文字 + 行动指引

```tsx
// 结构模板
<div className="flex flex-col items-center py-12 px-6 text-center ...">
  <div className="h-16 w-16 rounded-full bg-[var(--color-primary-light)] mb-6 flex items-center justify-center">
    <Icon className="h-8 w-8 text-[var(--color-primary)] opacity-60" />
  </div>
  <h3 className="text-lg font-semibold mb-2">标题</h3>
  <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-6">说明</p>
  <a className="text-sm text-[var(--color-primary)] font-medium">行动链接</a>
</div>
```

### 4.3 进度/步骤指示器

- 桌面端：水平圆圈 + 连接线（已完成绿色、当前品牌色、未来灰色）
- 移动端：紧凑进度条 + 当前步骤标签
- **必须带 ARIA**：`role="progressbar"` + `aria-valuenow` + `aria-label`

### 4.4 等待状态

等待状态（Under Review、合同准备中）**禁止只放一行文字**，必须包含：

1. 状态图标 + 标题
2. 预期时间说明（如 "1–3 business days"）
3. 联系渠道
4. 下方：时间线或平台介绍内容

---

## 五、微交互与动效

### 必须有的微交互

| 交互点 | 效果 | 实现 |
|:-------|:-----|:-----|
| 按钮点击 | 微缩放反馈 | `active:scale-[0.98] transition-transform` |
| 可交互卡片 hover | 轻微上浮 | `hover:-translate-y-0.5 hover:shadow-md transition-all duration-200` |
| 输入框聚焦 | 边框 + 光晕 | `focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20` |
| 进度条变化 | 平滑增长 | `transition-all duration-500 ease-out` |
| Toast 通知 | 入场动画 | `animate-[slideUp_0.3s_ease-out]` |

### 不引入的动效

- 不引入 Framer Motion（33KB），使用纯 CSS `@keyframes` + Tailwind `transition-*`
- 不使用全页过渡动画（Next.js App Router 不原生支持）
- 不使用 confetti 等装饰库（MVP 阶段不需要）

---

## 六、国际化准备（i18n-Ready）

### 现在就要做的

1. **CSS 逻辑属性**：新代码优先使用 `ms-*`/`me-*`/`ps-*`/`pe-*` 代替 `ml-*`/`mr-*`/`pl-*`/`pr-*`
2. **文本对齐**：使用 `text-start`/`text-end` 代替 `text-left`/`text-right`
3. **不固定宽度的文本容器**：按钮、标签使用 `px-*` padding 而非 `w-[fixed]`
4. **文化中性图标**：仅使用抽象概念图标（Lucide），禁止手势/动物/宗教符号
5. **颜色 + 形状双编码**：状态永远同时用颜色和图标/形状表意

### 暂不做但要准备的

- 深色模式：`globals.css` 中的语义化变量已为此做好准备
- 多语言：文案暂硬编码英文，但布局要预留 40% 文本扩展空间
- RTL：使用逻辑属性即可，无需额外处理

---

## 七、供应商生命周期页面设计规范

### 每个阶段的页面内容要求

| 阶段 | 必须包含 | 推荐包含 |
|:-----|:---------|:---------|
| Under Review | 状态卡片 + 预期时间 + 联系方式 | 时间线 + PlatformOverview |
| Sign Contract | ContractPreview（按合同状态渲染）| PlatformOverview |
| Setup Properties | BuildingCard 网格 / 空状态 | 完成度统计 |
| Onboarding 编辑 | FieldGroups + GapReport + ScoreBar | 面包屑导航回 Dashboard |

### 状态视觉编码

| 状态 | 颜色 | 图标 |
|:-----|:-----|:-----|
| 已完成 | `--color-success` | Check / CheckCircle |
| 当前/进行中 | `--color-primary` | 数字 / Loader |
| 等待中 | `--color-warning` | Clock |
| 未开始 | `--color-border` | 空心圆 / 数字 |
| 错误 | `--color-warning` | AlertCircle |

---

## 八、审查清单

每次 UI 变更必须自查：

- [ ] 所有颜色使用 CSS 变量，零硬编码 hex
- [ ] 空状态有图标 + 说明 + 行动指引（不是只有一行灰字）
- [ ] 等待状态有预期时间提示
- [ ] 可交互元素有 hover/focus/active 反馈
- [ ] Mobile-first，三断点均可用
- [ ] 新代码使用 CSS 逻辑属性（`ms-*`/`me-*` 优先于 `ml-*`/`mr-*`）
- [ ] 状态用颜色 + 形状双编码（不单靠颜色）
- [ ] 文本容器不使用固定宽度（为文本扩展预留空间）
