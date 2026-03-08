# Test Plan: Suppliers 模块重设计

> Major Track Phase 2 — 测试用例
> 日期: 2026-03-08
> 对应 PRD: `docs/PRD_SUPPLIERS_REDESIGN.md`

---

## 1. Pipeline 计算逻辑 (TC-PIPE)

| ID          | 场景                             | 输入                                                             | 期望                       |
| :---------- | :------------------------------- | :--------------------------------------------------------------- | :------------------------- |
| TC-PIPE-001 | 无合同的 NEW 供应商              | supplier.status=NEW, contract=null                               | stage=NEW_CONTRACT         |
| TC-PIPE-002 | 无合同的 PENDING_CONTRACT 供应商 | supplier.status=PENDING_CONTRACT, contract=null                  | stage=NEW_CONTRACT         |
| TC-PIPE-003 | 合同 DRAFT                       | supplier.status=PENDING_CONTRACT, contract.status=DRAFT          | stage=CONTRACT_IN_PROGRESS |
| TC-PIPE-004 | 合同 PENDING_REVIEW              | supplier.status=PENDING_CONTRACT, contract.status=PENDING_REVIEW | stage=CONTRACT_IN_PROGRESS |
| TC-PIPE-005 | 合同 CONFIRMED                   | supplier.status=PENDING_CONTRACT, contract.status=CONFIRMED      | stage=CONTRACT_IN_PROGRESS |
| TC-PIPE-006 | 合同 SENT                        | supplier.status=PENDING_CONTRACT, contract.status=SENT           | stage=AWAITING_SIGNATURE   |
| TC-PIPE-007 | SIGNED 无建筑                    | supplier.status=SIGNED, buildings=[]                             | stage=SIGNED               |
| TC-PIPE-008 | SIGNED 有建筑全 incomplete       | supplier.status=SIGNED, buildings=[{status:incomplete}]          | stage=SIGNED               |
| TC-PIPE-009 | SIGNED 部分建筑 published        | supplier.status=SIGNED, buildings=[{published},{incomplete}]     | stage=LIVE                 |
| TC-PIPE-010 | SIGNED 全部建筑 published        | supplier.status=SIGNED, buildings=[{published},{published}]      | stage=LIVE                 |
| TC-PIPE-011 | 合同 CANCELED                    | supplier.status=PENDING_CONTRACT, contract.status=CANCELED       | stage=CONTRACT_IN_PROGRESS |
| TC-PIPE-012 | SIGNED 建筑 extracting           | supplier.status=SIGNED, buildings=[{extracting}]                 | stage=SIGNED               |

---

## 2. KPI 统计 API (TC-STATS)

| ID           | 场景                 | 期望                                        |
| :----------- | :------------------- | :------------------------------------------ |
| TC-STATS-001 | Admin 获取全局统计   | 返回 5 阶段计数 + overdue_count + avg_score |
| TC-STATS-002 | BD 获取个人统计      | 仅计算 bd_user_id = 自己 的供应商           |
| TC-STATS-003 | 未认证请求           | 返回 401                                    |
| TC-STATS-004 | 非 BD 角色请求       | 返回 403                                    |
| TC-STATS-005 | 空数据库             | 返回全 0 计数，avg_score=0                  |
| TC-STATS-006 | overdue_count 计算   | SENT 超 7 天的合同数量正确                  |
| TC-STATS-007 | avg_onboarding_score | 仅 SIGNED 供应商的建筑平均分                |
| TC-STATS-008 | Live 计数            | SIGNED 且 ≥1 个 published 建筑              |

---

## 3. 列表页 UI (TC-LIST)

| ID          | 场景                        | 期望                                                                    |
| :---------- | :-------------------------- | :---------------------------------------------------------------------- |
| TC-LIST-001 | 默认加载                    | 显示 KPI 卡片 + Pipeline Tab，默认选中 New                              |
| TC-LIST-002 | Tab 计数                    | 每个 Tab 显示对应阶段供应商数量                                         |
| TC-LIST-003 | Tab 切换 New                | 只显示 NEW_CONTRACT 阶段供应商                                          |
| TC-LIST-004 | Tab 切换 In Progress        | 只显示 CONTRACT_IN_PROGRESS 阶段供应商                                  |
| TC-LIST-005 | Tab 切换 Awaiting Signature | 只显示 AWAITING_SIGNATURE 阶段供应商                                    |
| TC-LIST-006 | Tab 切换 Signed             | 只显示 SIGNED 阶段供应商                                                |
| TC-LIST-007 | Tab 切换 Live               | 只显示 LIVE 阶段供应商                                                  |
| TC-LIST-008 | Tab 切换 All                | 显示全部供应商                                                          |
| TC-LIST-009 | 搜索公司名                  | 输入关键词，300ms 后过滤匹配结果                                        |
| TC-LIST-010 | 搜索邮箱                    | 邮箱部分匹配也能搜到                                                    |
| TC-LIST-011 | 搜索城市                    | 按城市名过滤                                                            |
| TC-LIST-012 | 搜索国家                    | 按国家名过滤                                                            |
| TC-LIST-013 | 搜索防抖                    | 快速输入 5 个字符，只触发 1 次过滤                                      |
| TC-LIST-014 | 清除搜索                    | 点击 X 清除搜索框，恢复全列表                                           |
| TC-LIST-015 | BD 筛选（Admin）            | 下拉选择 BD，只显示该 BD 负责的供应商                                   |
| TC-LIST-016 | BD 筛选不可见（BD）         | BD 角色看不到 BD 筛选下拉                                               |
| TC-LIST-017 | 清除所有筛选                | 重置 Tab + 搜索 + BD 筛选                                               |
| TC-LIST-018 | 空状态                      | 当前筛选无结果时显示空状态提示                                          |
| TC-LIST-019 | 行信息完整性                | 每行显示：公司名、BD 名、阶段标签、合同状态、建筑数、停留天数、更新时间 |
| TC-LIST-020 | 停留天数橙色                | 阶段停留 >7 天显示橙色                                                  |
| TC-LIST-021 | 停留天数红色                | 阶段停留 >14 天显示红色                                                 |
| TC-LIST-022 | Live 阶段建筑列             | 显示 "X/Y published" 格式                                               |
| TC-LIST-023 | 行点击打开 Drawer           | 点击行，右侧 Drawer 滑入                                                |

---

## 4. Drawer 预览 (TC-DRAWER)

| ID            | 场景                | 期望                                        |
| :------------ | :------------------ | :------------------------------------------ |
| TC-DRAWER-001 | Drawer 打开         | 显示公司名 + 阶段标签 + Next Action         |
| TC-DRAWER-002 | 联系信息            | 显示邮箱、电话、城市、国家                  |
| TC-DRAWER-003 | 合同摘要            | 显示合同状态一行                            |
| TC-DRAWER-004 | 无合同              | 显示"No contract yet"                       |
| TC-DRAWER-005 | 查看详情按钮        | 点击跳转 /admin/suppliers/[id]              |
| TC-DRAWER-006 | 关闭 Drawer         | 点击 X / 点击背景遮罩 / 按 Escape           |
| TC-DRAWER-007 | Drawer 不含建筑列表 | 建筑和备注不在 Drawer 中出现                |
| TC-DRAWER-008 | 移动端全屏          | <768px 时 Drawer 全屏覆盖                   |
| TC-DRAWER-009 | Next Action 可操作  | AWAITING_SIGNATURE 阶段显示 Copy Email 按钮 |

---

## 5. Next Action 逻辑 (TC-ACTION)

| ID            | 场景                                  | 期望文本                                            |
| :------------ | :------------------------------------ | :-------------------------------------------------- |
| TC-ACTION-001 | NEW_CONTRACT                          | "Create contract for this supplier"                 |
| TC-ACTION-002 | CONTRACT_IN_PROGRESS + DRAFT          | "Complete contract editing"                         |
| TC-ACTION-003 | CONTRACT_IN_PROGRESS + PENDING_REVIEW | "Review and confirm contract"                       |
| TC-ACTION-004 | CONTRACT_IN_PROGRESS + CONFIRMED      | "Send contract to supplier"                         |
| TC-ACTION-005 | AWAITING_SIGNATURE                    | "Follow up with supplier to sign contract"          |
| TC-ACTION-006 | SIGNED + 有 incomplete 建筑           | "X building(s) need more data"                      |
| TC-ACTION-007 | SIGNED + 有 previewable 建筑          | "X building(s) ready for review"                    |
| TC-ACTION-008 | SIGNED + 无建筑                       | "Monitor onboarding progress"                       |
| TC-ACTION-009 | LIVE                                  | "All buildings published — operational maintenance" |

---

## 6. 详情页 (TC-DETAIL)

| ID            | 场景                    | 期望                                                      |
| :------------ | :---------------------- | :-------------------------------------------------------- |
| TC-DETAIL-001 | 页面加载                | 显示公司名、阶段标签、联系信息、Next Action               |
| TC-DETAIL-002 | 返回按钮                | 点击"← Back to Suppliers"返回列表页                       |
| TC-DETAIL-003 | 桌面端两栏              | ≥1024px 时左栏 Timeline/Contract/BD，右栏 Buildings/Notes |
| TC-DETAIL-004 | 移动端单栏              | <1024px 时纵向排列所有区块                                |
| TC-DETAIL-005 | BD 不可见其他人的供应商 | BD 访问非自己负责的供应商返回 404                         |
| TC-DETAIL-006 | Admin 可见所有          | Admin 可访问任意供应商详情                                |

---

## 7. Timeline (TC-TIMELINE)

| ID              | 场景                   | 期望                                                                                             |
| :-------------- | :--------------------- | :----------------------------------------------------------------------------------------------- |
| TC-TIMELINE-001 | 全部完成               | 7 个节点全 ✓ 状态                                                                                |
| TC-TIMELINE-002 | 合同未发送             | "Contract sent"及之后节点为 ○                                                                    |
| TC-TIMELINE-003 | 供应商已签 uhomes 未签 | "Supplier signed" ✓，"uhomes countersigned" ○                                                    |
| TC-TIMELINE-004 | 正在 extraction        | "Data extraction" 显示 ● 进行中                                                                  |
| TC-TIMELINE-005 | Onboarding 未完成      | score < 80 的建筑存在时，"Onboarding complete" 为 ○                                              |
| TC-TIMELINE-006 | 部分建筑 published     | "Published" 为 ○（需全部 published 才 ✓）——PRD 定义按 ≥1 个即 LIVE，但 Timeline 节点显示精确状态 |
| TC-TIMELINE-007 | 新建供应商无合同       | 仅 "Application approved" 为 ✓，其余 ○                                                           |

---

## 8. Building 卡片 (TC-BUILDING)

| ID              | 场景            | 期望                                                        |
| :-------------- | :-------------- | :---------------------------------------------------------- |
| TC-BUILDING-001 | 排序            | 按 score 从低到高排列                                       |
| TC-BUILDING-002 | 进度条颜色      | score 0-49 偏红，50-79 偏橙，80-100 偏绿                    |
| TC-BUILDING-003 | 显示内容        | 建筑名、地址、score/100、status badge、缺失字段数、最后更新 |
| TC-BUILDING-004 | 点击跳转        | 点击卡片跳转到 onboarding 页面                              |
| TC-BUILDING-005 | 无建筑          | 显示空状态 "No buildings yet"                               |
| TC-BUILDING-006 | extracting 状态 | 显示 extracting badge + 动效                                |

---

## 9. Supplier Notes API (TC-NOTES-API)

| ID               | 场景                 | 期望                    |
| :--------------- | :------------------- | :---------------------- |
| TC-NOTES-API-001 | GET 空列表           | 返回 200 + 空数组       |
| TC-NOTES-API-002 | POST 添加备注        | 返回 201 + 新建备注对象 |
| TC-NOTES-API-003 | POST 内容为空        | 返回 400                |
| TC-NOTES-API-004 | POST 超 2000 字符    | 返回 400                |
| TC-NOTES-API-005 | GET 排序             | 按 created_at DESC 返回 |
| TC-NOTES-API-006 | Admin 查看任意供应商 | 返回 200                |
| TC-NOTES-API-007 | BD 查看自己负责的    | 返回 200                |
| TC-NOTES-API-008 | BD 查看他人负责的    | 返回 403                |
| TC-NOTES-API-009 | 未认证               | 返回 401                |
| TC-NOTES-API-010 | 供应商不存在         | 返回 404                |

---

## 10. Supplier Notes UI (TC-NOTES-UI)

| ID              | 场景             | 期望                                     |
| :-------------- | :--------------- | :--------------------------------------- |
| TC-NOTES-UI-001 | 加载备注列表     | 显示已有备注（作者邮箱 + 时间 + 内容）   |
| TC-NOTES-UI-002 | 添加备注         | 输入内容 + 点击 Send，备注出现在列表顶部 |
| TC-NOTES-UI-003 | Enter 提交       | 按 Enter 键提交备注                      |
| TC-NOTES-UI-004 | 空输入不提交     | 空白内容时 Send 按钮禁用                 |
| TC-NOTES-UI-005 | 提交失败保留内容 | API 报错时输入框内容不清除               |
| TC-NOTES-UI-006 | 空状态           | 无备注时显示空状态提示                   |
| TC-NOTES-UI-007 | 滚动             | 备注超过可视区域时可滚动                 |

---

## 11. DocuSign 改造 (TC-DOCUSIGN)

| ID              | 场景                           | 期望                                                                           |
| :-------------- | :----------------------------- | :----------------------------------------------------------------------------- |
| TC-DOCUSIGN-001 | recipient-completed 供应商签署 | 记录 supplier_signed_at，更新 supplier.status → SIGNED，触发 extraction        |
| TC-DOCUSIGN-002 | recipient-completed 非供应商   | 忽略（Abby 签署），返回 200                                                    |
| TC-DOCUSIGN-003 | recipient-completed 幂等       | supplier_signed_at 已存在时，跳过处理，返回 200                                |
| TC-DOCUSIGN-004 | envelope-completed             | 更新 contract.status → SIGNED，下载 PDF                                        |
| TC-DOCUSIGN-005 | envelope-completed 幂等        | contract 已 SIGNED 时，跳过，返回 200                                          |
| TC-DOCUSIGN-006 | 并发到达                       | recipient-completed 和 envelope-completed 间隔 <1s 到达，不重复触发 extraction |
| TC-DOCUSIGN-007 | HMAC 签名验证                  | 无效签名返回 401                                                               |
| TC-DOCUSIGN-008 | 未知事件类型                   | 返回 200（不处理）                                                             |
| TC-DOCUSIGN-009 | extraction 触发失败            | supplier_signed_at 已记录，extraction 失败记入日志，不回滚                     |
| TC-DOCUSIGN-010 | PDF 下载失败                   | envelope-completed 成功但 PDF 下载失败，记录到 provider_metadata，不回滚       |

---

## 12. 权限与安全 (TC-PERM)

| ID          | 场景                     | 期望                                 |
| :---------- | :----------------------- | :----------------------------------- |
| TC-PERM-001 | BD 列表仅自己负责        | BD 看不到其他 BD 负责的供应商        |
| TC-PERM-002 | Admin 列表全部           | Admin 看到所有供应商                 |
| TC-PERM-003 | BD 详情仅自己负责        | BD 访问他人供应商返回 404            |
| TC-PERM-004 | BD Assignment 不可见     | BD 看不到 BD Assignment 下拉         |
| TC-PERM-005 | Admin BD Assignment 可见 | Admin 可见且可操作 BD 分配下拉       |
| TC-PERM-006 | stats API BD scoping     | BD 的 stats 只统计自己的供应商       |
| TC-PERM-007 | notes API BD scoping     | BD 只能查看/添加自己负责的供应商备注 |

---

## 13. 响应式 (TC-RESP)

| ID          | 场景              | 期望                                 |
| :---------- | :---------------- | :----------------------------------- |
| TC-RESP-001 | 列表页 <768px     | KPI 卡片单列、Tab 可横滑、表格变卡片 |
| TC-RESP-002 | 列表页 768-1024px | KPI 卡片网格、表格显示但隐藏次要列   |
| TC-RESP-003 | 列表页 >1024px    | 完整表格 + 所有列                    |
| TC-RESP-004 | Drawer <768px     | 全屏覆盖 + ArrowLeft 返回            |
| TC-RESP-005 | Drawer ≥768px     | 右侧 420px + 背景遮罩                |
| TC-RESP-006 | 详情页 <1024px    | 单栏纵向排列                         |
| TC-RESP-007 | 详情页 ≥1024px    | 两栏布局                             |
| TC-RESP-008 | 搜索框移动端      | w-full 不溢出                        |

---

## 14. 边界场景 (TC-EDGE)

| ID          | 场景                               | 期望                                                             |
| :---------- | :--------------------------------- | :--------------------------------------------------------------- |
| TC-EDGE-001 | 供应商 0 个建筑                    | 详情页 Buildings 区显示空状态；Pipeline = SIGNED（不是 LIVE）    |
| TC-EDGE-002 | 合同 CANCELED                      | Pipeline = CONTRACT_IN_PROGRESS；详情页合同区显示 CANCELED badge |
| TC-EDGE-003 | 多份合同                           | 取最新非 CANCELED 合同用于 Pipeline 计算                         |
| TC-EDGE-004 | supplier.status = DELETION_PENDING | 不在 Pipeline 中显示（或归入特殊处理）                           |
| TC-EDGE-005 | 停留天数 = 0                       | 今天创建的，显示 "Today" 或 "<1d"                                |
| TC-EDGE-006 | 搜索特殊字符                       | 输入 `<script>` 不触发 XSS                                       |
| TC-EDGE-007 | KPI 加载失败                       | 显示 "—" 而非崩溃                                                |
| TC-EDGE-008 | Timeline 数据部分缺失              | extraction_jobs 不存在时，extraction 节点显示 ○                  |
| TC-EDGE-009 | 资源上传达到 20 条限制             | 上传按钮禁用，提示已满                                           |
| TC-EDGE-010 | 供应商有 100+ 建筑                 | 建筑列表可滚动，页面不卡顿                                       |

---

## 测试用例统计

| 类别          | 数量    |
| :------------ | :------ |
| Pipeline 计算 | 12      |
| KPI 统计 API  | 8       |
| 列表页 UI     | 23      |
| Drawer        | 9       |
| Next Action   | 9       |
| 详情页        | 6       |
| Timeline      | 7       |
| Building 卡片 | 6       |
| Notes API     | 10      |
| Notes UI      | 7       |
| DocuSign      | 10      |
| 权限安全      | 7       |
| 响应式        | 8       |
| 边界场景      | 10      |
| **总计**      | **132** |
