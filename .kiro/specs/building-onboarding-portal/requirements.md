# 需求文档：Building Onboarding Portal

## 简介

Building Onboarding Portal 是 on.uhomes.com 平台 P1/P2 阶段的核心功能模块。当供应商完成合同签署后，系统需要自动从多个数据源（合同 PDF、供应商网站、Google Sheets）并行提取信息，将提取的数据映射到 uhomes 标准字段，识别缺失字段，并提供一个以 building 为粒度的协作编辑页面，让供应商、BD 和数据团队共同完善信息。系统通过自动化质量评分（0-100）驱动上架流程，评分达标后生成内部预览，供应商确认后推送至 uhomes.com 主站。

## 术语表

- **Onboarding_System**：Building Onboarding Portal 系统整体，包含数据提取、编辑、评分、预览和发布功能
- **Extraction_Pipeline**：AI 信息提取管道，负责从合同 PDF、供应商网站和 Google Sheets 并行提取数据
- **Scoring_Engine**：质量评分引擎，基于字段完整度计算 0-100 分的质量分数
- **Onboarding_Page**：以 building 为粒度的信息编辑页面（路由 `/onboarding/[buildingId]`）
- **Preview_Generator**：内部预览生成器，在 on.uhomes.com 内模拟 uhomes.com 主站的房源展示效果
- **Dashboard**：供应商总览面板（路由 `/dashboard`），展示所有 building 的状态卡片
- **Field_Schema**：字段定义模型，定义每个 onboarding 字段的名称、类型、分类、权重、可提取等级（A/B/C tier）和数据来源
- **Gap_Report**：缺失字段报告，对比已提取数据与完整 onboarding 需求后生成的差异清单
- **Building_Record**：单个 building 的 onboarding 数据记录，包含所有字段值及其来源追踪信息
- **Supplier**：供应商用户，只能查看和编辑自己名下的 building 数据
- **BD_Staff**：商务拓展人员，可编辑所负责供应商的 building 数据
- **Data_Team**：数据团队人员，可编辑和维护所有 building 数据
- **External_Worker**：独立部署的重型处理服务（Railway/Render），负责 PDF 解析和 Playwright 网页爬取
- **Quality_Score**：质量分数，0-100 的整数，基于 Field_Schema 中定义的字段权重计算

## 需求

### 需求 1：AI 多源并行信息提取

**用户故事：** 作为系统运营方，我希望在供应商签署合同后自动从多个数据源并行提取信息，以便在 5 分钟内完成初始数据填充。

#### 验收标准

1. WHEN 合同签署完成事件被触发, THE Extraction_Pipeline SHALL 在 10 秒内同时启动三个提取任务：合同 PDF 解析、供应商网站爬取、Google Sheets 读取
2. WHEN 合同 PDF 提取任务启动, THE External_Worker SHALL 解析签署后的 PDF 文件并提取公寓商信息（公司名称、地址、联系人、佣金率）和公寓楼信息（楼盘名称、地址列表），以 JSON 格式返回结构化数据
3. WHEN 供应商网站 URL 存在于合同或供应商记录中, THE External_Worker SHALL 使用 Playwright headless browser 爬取网站页面并提取公寓楼详情（描述、图片、设施列表、交通信息、价格范围）
4. WHEN Google Sheets 链接存在于合同 Appendix A 中, THE Extraction_Pipeline SHALL 通过 Google Sheets API 读取共享表格并提取单元列表、价格和户型数据
5. IF 任一提取任务在 3 分钟内未返回结果, THEN THE Extraction_Pipeline SHALL 使用已获得的数据继续后续流程，并将超时任务标记为待异步补充
6. WHEN 多个数据源对同一字段返回不同值, THE Extraction_Pipeline SHALL 按优先级（合同 > Google Sheets > 网站爬虫）自动选择高优先级值，并保留所有来源值供人工确认
7. WHEN 所有已完成的提取任务返回结果, THE Extraction_Pipeline SHALL 将融合后的数据写入对应的 Building_Record，并为每个字段标注数据来源和置信度等级（高/中/低）

### 需求 2：字段定义与缺失分析

**用户故事：** 作为 BD 人员，我希望系统能清晰展示每个 building 的数据完整度和缺失字段列表，以便我知道还需要补充哪些信息。

#### 验收标准

1. THE Field_Schema SHALL 定义完整的 onboarding 字段集合，每个字段包含：字段名、数据类型、所属分类（基本信息/佣金/联系人/查房方式/预订流程/租约政策/租客资质/楼宇详情/费用/房间详情）、权重分值、可提取等级（A-tier 自动提取/B-tier 部分提取需确认/C-tier 必须手动填写）
2. WHEN Extraction_Pipeline 完成数据写入后, THE Onboarding_System SHALL 将已提取数据与 Field_Schema 进行逐字段比对，生成 Gap_Report
3. WHEN Gap_Report 生成完成, THE Gap_Report SHALL 包含：缺失字段列表（按分类分组）、每个缺失字段的权重分值、以及该字段的可提取等级标注
4. WHEN 用户查看 Gap_Report, THE Onboarding_Page SHALL 将缺失字段按分类分组展示，C-tier 字段标记为"需手动填写"，B-tier 字段标记为"需确认"

### 需求 3：Building 级别 Onboarding 编辑页面

**用户故事：** 作为供应商，我希望有一个以 building 为粒度的页面来查看预填数据、纠正错误和补充缺失字段，以便我能高效完成信息录入。

#### 验收标准

1. THE Onboarding_Page SHALL 在路由 `/onboarding/[buildingId]` 下为每个 building 提供独立的编辑页面
2. WHEN Supplier 访问 Onboarding_Page, THE Onboarding_Page SHALL 展示所有已提取的预填数据，每个字段旁标注数据来源（合同/网站/Google Sheets/手动填写）
3. WHEN Supplier 编辑某个字段并保存, THE Onboarding_System SHALL 将变更持久化到数据库，记录操作人、操作时间和修改前后的值
4. WHILE Supplier 处于登录状态, THE Onboarding_Page SHALL 仅展示该 Supplier 名下的 building 数据，禁止访问其他供应商的 building
5. WHEN BD_Staff 访问 Onboarding_Page, THE Onboarding_Page SHALL 允许 BD_Staff 编辑其负责的供应商名下的所有 building 数据
6. WHEN Data_Team 访问 Onboarding_Page, THE Onboarding_Page SHALL 允许 Data_Team 编辑任意 building 数据
7. THE Onboarding_Page SHALL 将字段按分类（基本信息、佣金结构、联系人、查房方式、预订流程、租约政策、租客资质、楼宇详情、费用、房间详情）分组展示，每个分类可折叠展开
8. WHEN Onboarding_Page 加载完成, THE Onboarding_Page SHALL 在页面顶部展示当前 Quality_Score、缺失字段数量和整体完成百分比

### 需求 4：质量评分系统

**用户故事：** 作为系统运营方，我希望系统能自动计算每个 building 的信息完整度分数，以便驱动自动化上架流程。

#### 验收标准

1. THE Scoring_Engine SHALL 基于 Field_Schema 中定义的字段权重，计算每个 Building_Record 的 Quality_Score（0-100 整数）
2. WHEN 任意字段值被创建或更新, THE Scoring_Engine SHALL 在 2 秒内重新计算该 Building_Record 的 Quality_Score
3. THE Scoring_Engine SHALL 确保 Quality_Score 的计算公式为：已填写字段的权重之和 / 所有字段的权重总和 × 100，结果四舍五入为整数
4. WHEN Quality_Score 从低于 80 变为 80 或以上, THE Onboarding_System SHALL 将该 Building_Record 标记为"可预览"状态
5. IF 一个已标记为"可预览"的 Building_Record 的 Quality_Score 因字段删除而降至 80 以下, THEN THE Onboarding_System SHALL 将该 Building_Record 状态回退为"待完善"

### 需求 5：内部预览

**用户故事：** 作为供应商，我希望在正式发布前能预览我的 building 在 uhomes.com 上的展示效果，以便确认信息准确无误。

#### 验收标准

1. WHEN Building_Record 状态变为"可预览", THE Preview_Generator SHALL 在 on.uhomes.com 内部生成一个预览页面，模拟 uhomes.com 主站的房源列表卡片和详情页展示效果
2. WHEN Supplier 查看预览页面, THE Preview_Generator SHALL 展示：building 名称、地址、价格范围、主图、户型概述、核心设施标签，布局与 uhomes.com 主站保持视觉一致
3. WHEN Supplier 在预览页面点击"确认发布", THE Onboarding_System SHALL 将该 Building_Record 标记为"待发布"状态
4. WHEN Supplier 在预览页面发现错误, THE Onboarding_System SHALL 提供"返回编辑"入口，引导 Supplier 回到 Onboarding_Page 修正数据

### 需求 6：Dashboard 增强

**用户故事：** 作为供应商，我希望在 Dashboard 上看到我名下所有 building 的 onboarding 状态总览，以便快速了解整体进度。

#### 验收标准

1. WHEN Supplier 访问 `/dashboard`, THE Dashboard SHALL 展示该 Supplier 名下所有 building 的状态卡片列表
2. THE Dashboard SHALL 在每个 building 状态卡片上展示：building 名称、当前 Quality_Score（以进度条形式）、缺失字段数量、当前状态标签（数据提取中/待完善/可预览/待发布/已发布）
3. WHEN Supplier 点击某个 building 状态卡片, THE Dashboard SHALL 导航至该 building 的 Onboarding_Page（`/onboarding/[buildingId]`）
4. WHEN 新的 building 通过 Extraction_Pipeline 创建, THE Dashboard SHALL 在 Supplier 下次访问或刷新时展示新增的 building 卡片

### 需求 7：发布到主站

**用户故事：** 作为系统运营方，我希望供应商确认预览后能将标准化数据推送到 uhomes.com 主站，以便房源尽快上线接收预订。

#### 验收标准

1. WHEN Building_Record 状态变为"待发布", THE Onboarding_System SHALL 将该 Building_Record 的标准化数据通过 API 推送至 uhomes.com 主站
2. WHEN 主站 API 返回成功响应, THE Onboarding_System SHALL 将该 Building_Record 状态更新为"已发布"，并记录发布时间
3. IF 主站 API 返回错误响应, THEN THE Onboarding_System SHALL 将该 Building_Record 状态保持为"待发布"，记录错误详情，并在 Dashboard 上展示发布失败提示
4. WHEN Building_Record 状态变为"已发布", THE Onboarding_System SHALL 通过邮件通知 Supplier 和对应的 BD_Staff，邮件中包含 uhomes.com 主站的房源链接

### 需求 8：数据模型与来源追踪

**用户故事：** 作为数据团队人员，我希望每个字段都记录其数据来源和修改历史，以便我能追溯数据质量问题。

#### 验收标准

1. THE Building_Record SHALL 为每个字段存储：当前值、数据来源（contract_pdf/website_crawl/google_sheets/manual_input）、来源置信度（high/medium/low）、最后更新时间和最后更新人
2. WHEN 任意用户修改 Building_Record 中的字段, THE Onboarding_System SHALL 在审计日志中记录：操作人 ID、操作人角色、字段名、修改前值、修改后值、修改时间
3. WHEN Extraction_Pipeline 异步补充超时任务的数据, THE Onboarding_System SHALL 仅更新尚未被人工确认的字段，保留已人工确认的字段值不变
4. THE Building_Record SHALL 使用 JSON 结构存储字段值和元数据，支持 Field_Schema 的动态扩展而无需数据库 schema 变更

### 需求 9：权限与安全

**用户故事：** 作为系统管理员，我希望不同角色的用户只能访问和编辑其权限范围内的数据，以便保障数据安全。

#### 验收标准

1. WHILE Supplier 处于登录状态, THE Onboarding_System SHALL 通过 Supabase RLS 策略确保 Supplier 仅能读取和编辑自己名下的 Building_Record
2. WHILE BD_Staff 处于登录状态, THE Onboarding_System SHALL 允许 BD_Staff 读取和编辑其负责的供应商名下的所有 Building_Record
3. WHILE Data_Team 处于登录状态, THE Onboarding_System SHALL 允许 Data_Team 读取和编辑所有 Building_Record
4. WHEN 未认证用户尝试访问 `/onboarding/[buildingId]`, THE Onboarding_System SHALL 重定向至登录页面
5. THE Onboarding_System SHALL 确保 External_Worker 与 Onboarding_System 之间的通信使用 service_role key 鉴权，且 External_Worker 的回调端点验证请求签名

### 需求 10：响应式设计与技术约束

**用户故事：** 作为供应商，我希望在手机、平板和桌面设备上都能流畅使用 Onboarding_Page，以便我随时随地补充信息。

#### 验收标准

1. THE Onboarding_Page SHALL 采用 Mobile-First 响应式设计，适配三个断点：Mobile（<768px）、Tablet（768-1024px）、Desktop（>1024px）
2. THE Onboarding_System SHALL 使用 Tailwind CSS 4 的 CSS 变量（design tokens）定义所有颜色，禁止硬编码十六进制色值
3. THE Onboarding_System SHALL 确保所有页面组件的单文件代码行数不超过 300 行
4. THE Onboarding_System SHALL 确保所有重型处理任务（PDF 解析、Playwright 爬取）在 External_Worker 上执行，Vercel serverless 函数仅负责触发和接收结果
