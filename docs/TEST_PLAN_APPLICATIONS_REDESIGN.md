# 测试计划: Applications 模块重设计

> 版本：v1.0 | 日期：2026-03-08 | 关联 PRD：`PRD_APPLICATIONS_REDESIGN.md`

---

## 1. API 测试用例

### 1.1 GET /api/admin/applications/stats

| ID | 场景 | 输入 | 期望结果 |
|:--|:--|:--|:--|
| TC-STATS-001 | Admin 获取全局统计 | Admin session | 200, 返回全局 pending_total/unassigned_count/converted_this_week/total_this_week/pending_last_week |
| TC-STATS-002 | BD 获取个人统计 | BD session | 200, 仅返回分配给该 BD 的统计数据 |
| TC-STATS-003 | 无认证访问 | 无 session | 401 |
| TC-STATS-004 | 无申请数据时 | Admin session, 空表 | 200, 所有字段为 0 |
| TC-STATS-005 | 跨周边界 | 周一凌晨请求 | converted_this_week 正确归零，pending_last_week 正确计算 |

### 1.2 GET /api/admin/applications/[applicationId]/notes

| ID | 场景 | 输入 | 期望结果 |
|:--|:--|:--|:--|
| TC-NOTES-001 | Admin 查看备注 | Admin session, 有效 applicationId | 200, 按 created_at DESC 返回备注列表 |
| TC-NOTES-002 | BD 查看自己申请的备注 | BD session, 分配给该 BD 的申请 | 200, 返回备注 |
| TC-NOTES-003 | BD 查看他人申请的备注 | BD session, 分配给其他 BD 的申请 | 403 |
| TC-NOTES-004 | BD 查看未分配申请的备注 | BD session, 未分配申请 | 403 |
| TC-NOTES-005 | 不存在的 applicationId | Admin session, 随机 UUID | 404 |
| TC-NOTES-006 | 无备注时 | Admin session, 无备注的申请 | 200, notes: [] |
| TC-NOTES-007 | 无认证 | 无 session | 401 |

### 1.3 POST /api/admin/applications/[applicationId]/notes

| ID | 场景 | 输入 | 期望结果 |
|:--|:--|:--|:--|
| TC-NOTES-008 | Admin 添加备注 | Admin session, { content: "已联系" } | 201, 返回 note 对象 |
| TC-NOTES-009 | BD 添加备注（自己的申请） | BD session, 分配给该 BD | 201 |
| TC-NOTES-010 | BD 添加备注（他人的申请） | BD session, 分配给其他 BD | 403 |
| TC-NOTES-011 | 空内容 | { content: "" } | 400 |
| TC-NOTES-012 | 超长内容 | { content: "x".repeat(2001) } | 400 |
| TC-NOTES-013 | 内容刚好 2000 字符 | { content: "x".repeat(2000) } | 201 |
| TC-NOTES-014 | 缺少 content 字段 | {} | 400 |
| TC-NOTES-015 | XSS 内容 | { content: "\<script\>alert(1)\</script\>" } | 201, 内容原样存储（前端 React 自动转义） |
| TC-NOTES-016 | 不存在的 applicationId | 随机 UUID | 404 |
| TC-NOTES-017 | 多字节字符 | { content: "已联系供应商，对方表示🤝" } | 201, 内容完整保存 |

### 1.4 POST /api/admin/applications/[applicationId]/claim

| ID | 场景 | 输入 | 期望结果 |
|:--|:--|:--|:--|
| TC-CLAIM-001 | BD 认领未分配申请 | BD session, assigned_bd_id IS NULL | 200, assigned_bd_id 设为该 BD |
| TC-CLAIM-002 | BD 认领已分配申请 | BD session, 已有 assigned_bd_id | 409, "Application already assigned" |
| TC-CLAIM-003 | 两个 BD 同时认领（竞态） | 并发请求 | 只有一个成功 200，另一个 409 |
| TC-CLAIM-004 | Admin 认领 | Admin session | 200（Admin 也是 BD 角色） |
| TC-CLAIM-005 | 认领非 PENDING 申请 | CONVERTED 状态的申请 | 400, "Can only claim pending applications" |
| TC-CLAIM-006 | 不存在的申请 | 随机 UUID | 404 |
| TC-CLAIM-007 | 无认证 | 无 session | 401 |

---

## 2. 组件测试用例

### 2.1 ApplicationStats

| ID | 场景 | 期望结果 |
|:--|:--|:--|
| TC-UI-STATS-001 | 正常数据渲染 | 显示 3 个卡片：待处理数、未分配数、转化率 |
| TC-UI-STATS-002 | 加载中 | 3 个骨架屏卡片 |
| TC-UI-STATS-003 | 请求失败 | 卡片显示「—」，不阻断页面 |
| TC-UI-STATS-004 | 全部为 0 | 显示 0，转化率显示 「0 / 0」 |
| TC-UI-STATS-005 | vs 上周对比 | pending_total > pending_last_week 显示 "+N"，< 显示 "-N" |

### 2.2 ApplicationSearchBar

| ID | 场景 | 期望结果 |
|:--|:--|:--|
| TC-UI-SEARCH-001 | 按公司名搜索 | 输入后 300ms 防抖，过滤匹配项 |
| TC-UI-SEARCH-002 | 按邮箱搜索 | 大小写不敏感匹配 |
| TC-UI-SEARCH-003 | 搜索无结果 | 显示 "No applications match your search." + 清除按钮 |
| TC-UI-SEARCH-004 | 清除搜索 | 点击清除或删空输入框，恢复全量列表 |
| TC-UI-SEARCH-005 | BD 筛选下拉（Admin） | Admin 可见 BD 筛选下拉，选择后过滤 |
| TC-UI-SEARCH-006 | BD 筛选下拉（BD） | BD 不可见此下拉 |
| TC-UI-SEARCH-007 | 搜索 + 状态 Tab 联动 | 搜索在当前 Tab 范围内过滤 |

### 2.3 ApplicationTable（重设计）

| ID | 场景 | 期望结果 |
|:--|:--|:--|
| TC-UI-TABLE-001 | 桌面端列显示 | 5 列：公司名称、类型、国家、等待时间、操作 |
| TC-UI-TABLE-002 | 公司名行双行显示 | 主行：公司名；副行：BD 名或「未分配」（橙色） |
| TC-UI-TABLE-003 | 未分配行样式 | 左侧橙色边框 + ⚠ 图标 |
| TC-UI-TABLE-004 | 已分配 PENDING 行样式 | 左侧蓝色边框 + Clock 图标 |
| TC-UI-TABLE-005 | CONVERTED 行样式 | 绿色 CheckCircle2，文字正常 |
| TC-UI-TABLE-006 | REJECTED 行样式 | 灰色 XCircle，文字变淡 |
| TC-UI-TABLE-007 | 相对时间显示 | 刚申请 → "刚刚"；3 天前 → "3 天前"；30 天前 → "30 天前" |
| TC-UI-TABLE-008 | 点击行打开 Drawer | 桌面端：右侧 Drawer 滑出 |
| TC-UI-TABLE-009 | 审批按钮仅 PENDING 可用 | CONVERTED/REJECTED 行无审批按钮 |
| TC-UI-TABLE-010 | 默认 Tab 为「待处理」 | 页面加载后只显示 PENDING 申请 |
| TC-UI-TABLE-011 | Tab 计数准确 | 每个 Tab 括号内数字与实际数据一致 |
| TC-UI-TABLE-012 | 移动端卡片布局 | <768px 切换为卡片式，信息堆叠 |
| TC-UI-TABLE-013 | 空列表（BD 无待处理） | "All caught up! No pending applications." + 图标 |
| TC-UI-TABLE-014 | 列表排序 | PENDING 按 created_at ASC（最旧优先），其他按 DESC |

### 2.4 ApplicationDrawer

| ID | 场景 | 期望结果 |
|:--|:--|:--|
| TC-UI-DRAWER-001 | 桌面端打开 | 右侧滑入，宽度 420px，带遮罩 |
| TC-UI-DRAWER-002 | 关闭方式 | 点击 ✕ / 点击遮罩 / 按 Escape 均可关闭 |
| TC-UI-DRAWER-003 | 基本信息展示 | 类型、邮箱、电话、国家、网站（可点击）、申请时间（UTC）、推荐码 |
| TC-UI-DRAWER-004 | BD 分配区域（Admin） | 显示 BD 选择下拉框 |
| TC-UI-DRAWER-005 | 认领按钮（BD，未分配） | 显示 [认领] 按钮 |
| TC-UI-DRAWER-006 | 认领按钮（BD，已分配给自己） | 不显示认领按钮 |
| TC-UI-DRAWER-007 | 认领按钮（BD，已分配给他人） | 不显示（BD 不应看到此申请详情） |
| TC-UI-DRAWER-008 | 备注区域 | 显示 ApplicationNotes 组件 |
| TC-UI-DRAWER-009 | 操作按钮（PENDING） | 底部显示 [审批] [拒绝] |
| TC-UI-DRAWER-010 | 操作按钮（非 PENDING） | 不显示操作按钮 |
| TC-UI-DRAWER-011 | 加载中 | 骨架屏 |
| TC-UI-DRAWER-012 | 移动端 <768px | 全屏覆盖页，顶部返回箭头 |
| TC-UI-DRAWER-013 | 中等屏幕 768-1024px | Drawer 宽度 360px |

### 2.5 ApplicationNotes

| ID | 场景 | 期望结果 |
|:--|:--|:--|
| TC-UI-NOTES-001 | 备注列表渲染 | 按时间倒序显示，每条显示作者邮箱 + 时间 + 内容 |
| TC-UI-NOTES-002 | 添加备注 | 输入内容 → 点击提交 → 乐观更新列表 → 清空输入框 |
| TC-UI-NOTES-003 | 空输入提交 | 提交按钮禁用 |
| TC-UI-NOTES-004 | 提交中状态 | 按钮显示 spinner，输入框禁用 |
| TC-UI-NOTES-005 | 提交失败 | 显示错误提示，内容不清空（允许重试） |
| TC-UI-NOTES-006 | 无备注时 | 显示 "暂无跟进记录" + 引导文案 |
| TC-UI-NOTES-007 | 长内容换行 | 超长文本自动换行，不溢出 |
| TC-UI-NOTES-008 | 备注时间显示 | 相对时间（"2 小时前"、"昨天"） |

### 2.6 ClaimButton

| ID | 场景 | 期望结果 |
|:--|:--|:--|
| TC-UI-CLAIM-001 | 点击认领 | 按钮变 loading → 成功后刷新页面 |
| TC-UI-CLAIM-002 | 认领失败（已被他人认领） | 显示 "已被其他 BD 认领" 提示 |
| TC-UI-CLAIM-003 | Admin 不显示认领按钮 | Admin 使用分配下拉，不需要认领 |

---

## 3. 权限测试用例

| ID | 场景 | 角色 | 期望结果 |
|:--|:--|:--|:--|
| TC-PERM-001 | BD 查看列表 | BD | 只看到自己的申请 + 未分配申请 |
| TC-PERM-002 | BD 查看他人申请详情 | BD | 403 或不可点击 |
| TC-PERM-003 | Admin 查看全部列表 | Admin | 所有申请可见 |
| TC-PERM-004 | Admin BD 筛选 | Admin | 可按 BD 过滤 |
| TC-PERM-005 | BD 无 BD 筛选 | BD | 筛选下拉不可见 |
| TC-PERM-006 | BD 分配功能（Admin） | Admin | Drawer 中可选择 BD 下拉 |
| TC-PERM-007 | BD 分配功能（BD） | BD | Drawer 中无 BD 下拉 |
| TC-PERM-008 | 普通供应商访问 | supplier (非 BD) | 整个页面 403 |

---

## 4. 响应式测试用例

| ID | 屏幕 | 场景 | 期望结果 |
|:--|:--|:--|:--|
| TC-RESP-001 | >1024px | 列表 + Drawer | 表格 5 列 + 右侧 420px Drawer |
| TC-RESP-002 | 768-1024px | 列表 + Drawer | 隐藏类型列 + 360px Drawer |
| TC-RESP-003 | <768px | 列表 | 卡片布局，无表格 |
| TC-RESP-004 | <768px | 详情 | 全屏覆盖页，顶部返回按钮 |
| TC-RESP-005 | <768px | KPI 卡片 | 横向滚动或纵向堆叠 |
| TC-RESP-006 | <768px | 搜索栏 | 全宽输入框 |

---

## 5. 边界与异常测试

| ID | 场景 | 期望结果 |
|:--|:--|:--|
| TC-EDGE-001 | 大量申请（500+） | 页面性能正常，首屏渲染 < 2s |
| TC-EDGE-002 | 大量备注（100+） | 备注列表可滚动，不撑破 Drawer |
| TC-EDGE-003 | 申请被删除后查看详情 | 404 提示，关闭 Drawer |
| TC-EDGE-004 | 网络断开时提交备注 | 错误提示，内容保留 |
| TC-EDGE-005 | 并发审批同一申请 | 只有一个成功，另一个 409 |
| TC-EDGE-006 | BD 查看详情时申请被重新分配 | 刷新后权限变更正确反映 |
| TC-EDGE-007 | 特殊字符公司名搜索 | `O'Brien & Co.` 正常搜索，无 SQL 注入 |

---

## 6. 测试用例统计

| 类别 | 数量 |
|:--|:--|
| API 测试 | 31 |
| 组件 UI 测试 | 39 |
| 权限测试 | 8 |
| 响应式测试 | 6 |
| 边界与异常 | 7 |
| **合计** | **91** |
