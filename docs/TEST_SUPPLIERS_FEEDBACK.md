# 20 家测试供应商画像 & 潜在 Bug 清单

> 目标：模拟 20 种不同类型的真实供应商来体验完整的 Onboarding 流程，找出产品中可能存在的 Bug 和体验问题。

---

## 一、测试供应商画像

### 供应商 1 — 美国大型连锁学生公寓（American Campus Communities 类型）

| 字段         | 值                                                                                      |
| ------------ | --------------------------------------------------------------------------------------- |
| Company Name | Campus Living USA                                                                       |
| Email        | leasing@campusliving.com                                                                |
| Phone        | +1 5125551234                                                                           |
| City         | Austin                                                                                  |
| Country      | United States                                                                           |
| Website      | https://www.campusliving.com                                                            |
| 特征         | 管理 200+ 栋楼、全部 furnished、支持 I-20、Per Bedroom 租赁、多城市运营                 |
| 测试重点     | 多 building 批量录入场景、price_min/price_max 范围跨度大（$600-$2,500）、amenities 全选 |

---

### 供应商 2 — 英国 PBSA 运营商（Unite Students 类型）

| 字段         | 值                                                                              |
| ------------ | ------------------------------------------------------------------------------- |
| Company Name | UniLiving UK Ltd                                                                |
| Email        | partnerships@uniliving.co.uk                                                    |
| Phone        | +44 2071234567                                                                  |
| City         | London                                                                          |
| Country      | United Kingdom                                                                  |
| Website      | https://www.uniliving.co.uk                                                     |
| 特征         | GBP 计价、Joint Lease、有 shuttle service、Deposit 以周计算而非月               |
| 测试重点     | currency=GBP 场景、英国租赁习惯（weekly rent）与系统字段（monthly price）的冲突 |

---

### 供应商 3 — 澳洲独立公寓运营商

| 字段         | 值                                                                     |
| ------------ | ---------------------------------------------------------------------- |
| Company Name | Sydney Student Stays Pty Ltd                                           |
| Email        | info@sydneystudentstays.com.au                                         |
| Phone        | +61 291234567                                                          |
| City         | Sydney                                                                 |
| Country      | Australia                                                              |
| Website      | https://sydneystudentstays.com.au                                      |
| 特征         | AUD 计价、只有 3 栋楼、Per Unit 和 Per Bedroom 混合、无 I-20（非美国） |
| 测试重点     | i20_accepted 字段对非美国供应商是否有意义？是否产生困惑？              |

---

### 供应商 4 — 日本语言学校附属宿舍

| 字段         | 值                                                                                 |
| ------------ | ---------------------------------------------------------------------------------- |
| Company Name | 東京グローバルハウス株式会社                                                       |
| Email        | housing@tokyoglobal.jp                                                             |
| Phone        | +81 312345678                                                                      |
| City         | 東京                                                                               |
| Country      | Japan                                                                              |
| Website      | https://www.tokyoglobal.jp                                                         |
| 特征         | 公司名和城市都是日文、JPY 计价、价格数值极大（¥80,000-¥150,000）、furnished 为标配 |
| 测试重点     | **非拉丁字符**公司名/城市在表单、合同、PDF 中的显示是否正常？大数值价格显示        |

---

### 供应商 5 — 加拿大中型物业管理公司

| 字段         | 值                                                               |
| ------------ | ---------------------------------------------------------------- |
| Company Name | Maple Housing Group                                              |
| Email        | bd@maplehousing.ca                                               |
| Phone        | +1 4165551234                                                    |
| City         | Toronto                                                          |
| Country      | Canada                                                           |
| Website      | https://maplehousing.ca                                          |
| 特征         | CAD 计价、提供 guarantor 服务、有 pet policy、utilities 部分包含 |
| 测试重点     | 标准流程的 happy path 验证、pet_fee + pet_rent 同时填写场景      |

---

### 供应商 6 — 没有网站的小房东

| 字段         | 值                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------- |
| Company Name | Mr. Chen's Apartments                                                                    |
| Email        | chenwei88@gmail.com                                                                      |
| Phone        | +1 6265559876                                                                            |
| City         | Los Angeles                                                                              |
| Country      | United States                                                                            |
| Website      | _(留空)_                                                                                 |
| 特征         | 无网站、只有 2 个 unit、个人 Gmail 邮箱、所有信息需手动填写、无法 AI 提取                |
| 测试重点     | website_url 为空时 AI extraction 的 website_crawl job 会失败还是跳过？错误处理是否友好？ |

---

### 供应商 7 — 欧洲跨国集团（多国运营）

| 字段         | 值                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Company Name | EuroStudent Housing GmbH                                                                                                           |
| Email        | expansion@eurostudent.de                                                                                                           |
| Phone        | +49 3012345678                                                                                                                     |
| City         | Berlin                                                                                                                             |
| Country      | Germany                                                                                                                            |
| Website      | https://www.eurostudent.de                                                                                                         |
| 特征         | EUR 计价、在德国/荷兰/奥地利都有物业、合同覆盖多个城市                                                                             |
| 测试重点     | 一家供应商多栋不同城市/国家的 building，covered_properties 字段是否支持？building 级别的 city/country 是否可以不同于 supplier 的？ |

---

### 供应商 8 — 中国大陆留学生公寓品牌

| 字段         | 值                                                                             |
| ------------ | ------------------------------------------------------------------------------ |
| Company Name | 优居海外公寓（深圳）有限公司                                                   |
| Email        | partner@youju.cn                                                               |
| Phone        | +86 75512345678                                                                |
| City         | 深圳                                                                           |
| Country      | China                                                                          |
| Website      | https://www.youju.cn                                                           |
| 特征         | 中文公司名、CNY 计价、可能在海外也有物业（如英国曼彻斯特）、需要中文界面       |
| 测试重点     | 中文名在合同模板中的渲染、supplier 城市=深圳但 building 城市=Manchester 的场景 |

---

### 供应商 9 — 手机号格式特殊的中东供应商

| 字段         | 值                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Company Name | Gulf Student Residences                                                                                     |
| Email        | info@gulfresidences.ae                                                                                      |
| Phone        | +971 501234567                                                                                              |
| City         | Dubai                                                                                                       |
| Country      | United Arab Emirates                                                                                        |
| Website      | https://gulfresidences.ae                                                                                   |
| 特征         | 阿联酋手机号格式、RTL 语言环境用户、长国家名称                                                              |
| 测试重点     | phone regex `/^\+\d{1,4}\s\d{4,14}$/` 是否支持所有国家号码格式？"United Arab Emirates" 在 UI 中是否被截断？ |

---

### 供应商 10 — 共享居住（Co-living）新兴品牌

| 字段         | 值                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Company Name | NomadNest Co-Living                                                                             |
| Email        | hello@nomadnest.io                                                                              |
| Phone        | +1 3125559999                                                                                   |
| City         | Chicago                                                                                         |
| Country      | United States                                                                                   |
| Website      | https://nomadnest.io                                                                            |
| 特征         | Per Bedroom、furnished、短租+长租混合、无传统 lease 概念、灵活 cancellation                     |
| 测试重点     | lease_type/rental_method 字段是否覆盖非传统模式？cancellation_policy 自由文本能否表达复杂策略？ |

---

### 供应商 11 — 极端超长公司名供应商

| 字段         | 值                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Company Name | The International Student Accommodation & Property Management Services Corporation of Greater Metropolitan Area |
| Email        | admin@isapms.com                                                                                                |
| Phone        | +1 2125551111                                                                                                   |
| City         | New York                                                                                                        |
| Country      | United States                                                                                                   |
| Website      | https://isapms.com                                                                                              |
| 特征         | 公司名超过 100 个字符                                                                                           |
| 测试重点     | **超长 company_name** 在表单提交、数据库存储、合同 PDF 生成、Dashboard 卡片、Admin 列表中是否正确显示/截断？    |

---

### 供应商 12 — 特殊字符公司名供应商

| 字段         | 值                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Company Name | O'Brien & Associates — Student Living (UK)                                                        |
| Email        | info@obrien-living.co.uk                                                                          |
| Phone        | +44 1611234567                                                                                    |
| City         | Manchester                                                                                        |
| Country      | United Kingdom                                                                                    |
| Website      | https://obrien-living.co.uk                                                                       |
| 特征         | 公司名包含 `'`（撇号）、`&`、`—`（em dash）、`()`                                                 |
| 测试重点     | **特殊字符** 在 JSON 序列化、SQL 存储、合同 PDF 渲染、HTML 显示中是否引起问题？XSS 防护是否到位？ |

---

### 供应商 13 — 重复申请的供应商

| 字段         | 值                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Company Name | Pacific Dorm Management                                                                                            |
| Email        | apply@pacificdorm.com                                                                                              |
| Phone        | +1 4155552222                                                                                                      |
| City         | San Francisco                                                                                                      |
| Country      | United States                                                                                                      |
| Website      | https://pacificdorm.com                                                                                            |
| 特征         | 同一个 email 提交两次申请                                                                                          |
| 测试重点     | 重复 email 提交是否有去重逻辑？是否允许？如果第一次 PENDING 还未处理，第二次提交会怎样？是否有 unique constraint？ |

---

### 供应商 14 — BD 直接邀请的供应商（跳过 Landing Page）

| 字段         | 值                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Company Name | Elite University Housing                                                                                         |
| Email        | ceo@eliteuniversityhousing.com                                                                                   |
| Phone        | _(BD 邀请时未填)_                                                                                                |
| City         | _(BD 邀请时未填)_                                                                                                |
| Country      | _(BD 邀请时未填)_                                                                                                |
| Website      | https://eliteuniversityhousing.com                                                                               |
| 特征         | 通过 `/api/admin/invite-supplier` 创建，只有 email + company_name，其余字段为空                                  |
| 测试重点     | phone/city/country 为 null 的 supplier 在 Dashboard、合同编辑、Building Onboarding 中是否会导致空指针/显示异常？ |

---

### 供应商 15 — 价格为零/免费住宿的供应商

| 字段         | 值                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------- |
| Company Name | University Campus Housing Office                                                              |
| Email        | housing@stateuniversity.edu                                                                   |
| Phone        | +1 8005550000                                                                                 |
| City         | Columbus                                                                                      |
| Country      | United States                                                                                 |
| Website      | https://housing.stateuniversity.edu                                                           |
| 特征         | 学校自营宿舍、price_min=0（含奖学金住宿）、.edu 邮箱                                          |
| 测试重点     | price_min=0 是否被 number 类型验证拒绝？价格为 0 的显示逻辑是否正常（"$0" vs "Free" vs 空）？ |

---

### 供应商 16 — 网站是 SPA（单页应用）的供应商

| 字段         | 值                                                                              |
| ------------ | ------------------------------------------------------------------------------- |
| Company Name | Modern Living Apartments                                                        |
| Email        | tech@modernliving.com                                                           |
| Phone        | +1 7135553333                                                                   |
| City         | Houston                                                                         |
| Country      | United States                                                                   |
| Website      | https://modernliving.com                                                        |
| 特征         | 网站完全由 React 渲染、无服务端 HTML、Playwright 爬虫需等待 JS 加载             |
| 测试重点     | AI extraction 的 website_crawl 对 JS-heavy SPA 网站的抓取成功率如何？超时处理？ |

---

### 供应商 17 — 合同条款极其复杂的供应商

| 字段         | 值                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------- |
| Company Name | Landmark Properties Inc.                                                                     |
| Email        | legal@landmarkproperties.com                                                                 |
| Phone        | +1 7065554444                                                                                |
| City         | Athens                                                                                       |
| Country      | United States                                                                                |
| Website      | https://landmarkproperties.com                                                               |
| 特征         | commission_rate 按阶梯计算（前 10 单 8%，之后 10%）、合同附加条款多                          |
| 测试重点     | commission_rate 字段只是 text，复杂佣金结构能否表达？合同自定义 PDF 上传后 extraction 效果？ |

---

### 供应商 18 — 刚注册但长时间不操作的供应商

| 字段         | 值                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Company Name | Pending Properties LLC                                                                                           |
| Email        | john@pendingproperties.com                                                                                       |
| Phone        | +1 3035555555                                                                                                    |
| City         | Denver                                                                                                           |
| Country      | United States                                                                                                    |
| Website      | https://pendingproperties.com                                                                                    |
| 特征         | 提交申请后 30 天不登录、被 approve 后不签合同、session/token 过期                                                |
| 测试重点     | Supabase Auth OTP token 过期后重新登录流程是否顺畅？长时间 PENDING_CONTRACT 状态的 supplier 再回来操作是否正常？ |

---

### 供应商 19 — 通过 Referral Code 来的供应商

| 字段         | 值                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Company Name | Referred Housing Partners                                                                                                             |
| Email        | referred@housingpartners.com                                                                                                          |
| Phone        | +1 9515556666                                                                                                                         |
| City         | Riverside                                                                                                                             |
| Country      | United States                                                                                                                         |
| Website      | _(留空)_                                                                                                                              |
| 特征         | 通过 BD 的 referral link（`/?ref=XXXX`）访问 Landing Page                                                                             |
| 测试重点     | referral_code 在 URL → 表单 → API → 数据库的完整传递链路是否正确？无效 referral_code 的处理？referral_code 对应的 BD 不存在时会怎样？ |

---

### 供应商 20 — 同时操作的两个 BD 分别编辑同一供应商

| 字段         | 值                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Company Name | Concurrent Edit Properties                                                                                                 |
| Email        | ops@concurrentedit.com                                                                                                     |
| Phone        | +1 2065557777                                                                                                              |
| City         | Seattle                                                                                                                    |
| Country      | United States                                                                                                              |
| Website      | https://concurrentedit.com                                                                                                 |
| 特征         | 两个 BD 同时打开同一个 supplier 的合同编辑页、同时修改 building 字段                                                       |
| 测试重点     | 合同编辑的并发控制（contracts 表无 version 字段！）、Building 的 optimistic locking 是否真正生效？冲突时用户提示是否清晰？ |

---

## 二、按流程阶段的潜在 Bug 清单

### Phase 1: Landing Page & 申请提交

| #   | Bug 描述                                                                                                                                                            | 严重程度 | 触发供应商 | 影响范围       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | -------------- |
| B01 | **Phone 正则过严**：`/^\+\d{1,4}\s\d{4,14}$/` 要求国际区号后必须有且仅有一个空格，但真实用户可能输入 `+86-755-12345678` 或 `+44 (0) 207 123 4567`，导致合法号码被拒 | 高       | #4, #9     | 所有国际供应商 |
| B02 | **重复 email 无去重**：applications 表 contact_email 无 unique 约束，同一邮箱可提交多次申请，BD 会看到重复记录                                                      | 中       | #13        | 申请管理       |
| B03 | **website_url 的 transform 逻辑单向**：输入 `ftp://example.com` 会被前面的 https 检查跳过，但 `z.string().url()` 可能接受 ftp 协议，不一定是预期行为                | 低       | 边缘       | 数据质量       |
| B04 | **Country 字段无标准化**：纯文本输入，用户可能写 "US"、"USA"、"United States"、"United States of America"，导致后续数据聚合困难                                     | 中       | 所有       | 数据一致性     |
| B05 | **City 字段最小长度为 2**：某些城市名可能只有 1 个字（如中文"沪"），虽罕见但 min(2) 会拒绝                                                                          | 低       | #4, #8     | 中日韩用户     |

### Phase 2: BD 审核 & 供应商创建

| #   | Bug 描述                                                                                                                                                                 | 严重程度 | 触发供应商 | 影响范围    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------- | ----------- |
| B06 | **BD 邀请供应商时 phone/city 可为空**：`invite-supplier` API 中 phone/city 为 optional，但后续合同模板 `partner_city` 可能依赖这些字段，生成空白合同                     | 高       | #14        | BD 邀请流程 |
| B07 | **approve-supplier 创建 Auth 用户时邮箱冲突**：如果供应商之前自己注册过 Supabase Auth（比如浏览过 login 页面点了 OTP），再被 approve 时 `createUser` 会失败              | 高       | #13, #18   | 审批流程    |
| B08 | **assigned_bd_id 为 null 的申请无人处理**：从 Landing Page 直接提交（无 referral_code）的申请，assigned_bd_id 为 null，如果 Admin 列表按 BD 分组过滤，这些申请可能被遗漏 | 中       | #6, #15    | 申请流转    |

### Phase 3: 合同编辑 & 签署

| #   | Bug 描述                                                                                                                                             | 严重程度 | 触发供应商 | 影响范围   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ---------- |
| B09 | **合同编辑无并发控制**：contracts 表无 `version` 字段（不像 building_onboarding_data），两个 BD 同时编辑同一份合同，后保存者会静默覆盖先保存者的内容 | 高       | #20        | 数据完整性 |
| B10 | **非拉丁字符在 DocuSign 合同 PDF 中乱码**：如果 partner_company_name 包含中文/日文（如 "東京グローバルハウス株式会社"），DocuSign 模板字体可能不支持 | 高       | #4, #8     | 合同签署   |
| B11 | **特殊字符在 contract_fields JSONB 中的存储**：`O'Brien & Associates — Student Living (UK)` 中的撇号和 em dash 在 JSON 序列化时是否被正确处理？      | 中       | #12        | 合同数据   |
| B12 | **超长公司名在合同模板中溢出**：100+ 字符的公司名在 DocuSign 合同模板的固定宽度字段中可能被截断或溢出                                                | 中       | #11        | 合同显示   |
| B13 | **DocuSign webhook 的幂等性边界**：如果 webhook 在 supplier.status 更新成功但 PDF 下载失败后重发，signed_at 已设置，但 document_url 仍为 null        | 中       | 所有       | 签约完成   |

### Phase 4: AI 数据提取

| #   | Bug 描述                                                                                                                                                                    | 严重程度 | 触发供应商 | 影响范围 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | -------- |
| B14 | **无网站供应商触发 website_crawl 失败**：website_url 为空的供应商（#6, #19），extraction trigger 仍会创建 website_crawl job，该 job 永远 fail/timeout，影响整体提取状态判断 | 高       | #6, #19    | 数据提取 |
| B15 | **SPA 网站爬取失败**：Playwright 对 JavaScript 密集型 SPA 网站（React/Vue）的等待策略如果不够，可能只抓到空白页面或 loading 状态                                            | 中       | #16        | 数据提取 |
| B16 | **JPY/CNY 大数值价格提取混淆**：AI 从合同中提取 ¥150,000 时可能误判货币（JPY vs CNY），或对 "万" 等中文数量词理解错误                                                       | 中       | #4, #8     | 数据质量 |
| B17 | **Extraction job 全部完成的判断逻辑**：如果 3 个 job 中有 1 个 timeout，系统如何退出 `extracting` 状态？building 会不会永远卡在 `extracting`？                              | 高       | #6, #16    | 状态流转 |

### Phase 5: Building Onboarding & 字段编辑

| #   | Bug 描述                                                                                                                                                               | 严重程度 | 触发供应商 | 影响范围 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | -------- |
| B18 | **i20_accepted 字段对非美国供应商造成困惑**：I-20 是美国特有的学生签证文件，非美国供应商（英国、澳洲、日本）看到此字段会困惑，不知该选 "Yes"、"No" 还是 "N/A"          | 中       | #2, #3, #4 | 用户体验 |
| B19 | **price_min > price_max 无前端校验**：number 类型字段独立校验，未做交叉校验。供应商可能误输入 min=2000, max=800                                                        | 中       | 所有       | 数据质量 |
| B20 | **周租 vs 月租计价差异**：英国/澳洲供应商习惯按周报价（如 £200/week），但 price_min/price_max 的 label 未指明是月租还是周租，数据对比会出现偏差                        | 高       | #2, #3     | 数据质量 |
| B21 | **key_amenities 最多 6 个 tag 限制**：multi_select 配置了 12 个选项但 label 写 "up to 6 tags"，前端是否真正限制了最大选择数？还是只是建议性文字？                      | 中       | #1         | 数据校验 |
| B22 | **image_urls 类型字段无上传能力**：images 字段类型为 `image_urls`，但如果只支持 URL 输入而无文件上传，小供应商（#6）可能没有图片托管服务，无法提供图片 URL             | 高       | #6         | 功能缺失 |
| B23 | **Optimistic locking 409 冲突的用户提示**：当 version 冲突返回 409 时，前端是否有明确的提示和自动刷新机制？还是只显示一个通用错误？                                    | 中       | #20        | 用户体验 |
| B24 | **Score 计算的 weight 分配不够合理**：cover_image (weight=8) 和 building_name (weight=10) 权重接近，但 cover_image 的获取难度远高于 building_name，可能导致 score 偏低 | 低       | 所有       | 评分策略 |

### Phase 6: 状态流转 & 边界场景

| #   | Bug 描述                                                                                                                                                                     | 严重程度 | 触发供应商 | 影响范围 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | -------- |
| B25 | **SIGNED 状态供应商重定向 pro.uhomes.com 过早**：架构文档提到已签约供应商"直接重定向跳转 pro.uhomes.com"，但实际上签约后还需要完成 Building Onboarding，过早跳转会中断流程   | 高       | 所有       | 核心流程 |
| B26 | **Supplier status=NEW 的用途不明**：suppliers 表有 NEW/PENDING_CONTRACT/SIGNED 三个状态，但 approve-supplier 直接创建为 PENDING_CONTRACT，NEW 状态什么时候用？是否为死代码？ | 低       | -          | 代码质量 |
| B27 | **合同 CANCELED 后无法重新发起**：如果 BD 取消了一份合同，supplier 的状态仍为 PENDING_CONTRACT，但没有机制创建新合同                                                         | 高       | 任意       | 合同管理 |
| B28 | **building.onboarding_status 从 ready_to_publish 不能回退**：如果供应商提交后发现数据有误，ready_to_publish 和 published 状态被锁定不允许自动降级，但是否有手动回退的 UI？   | 中       | 所有       | 状态管理 |

### Phase 7: 安全 & 权限

| #   | Bug 描述                                                                                                                                                                  | 严重程度 | 触发供应商 | 影响范围 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | -------- |
| B29 | **Supplier 可能通过修改 URL 访问其他 supplier 的 building**：RLS 策略是否完备？`/api/buildings/[buildingId]/fields` 的 GET/PATCH 是否校验了 building 所属的 supplier_id？ | 高       | 任意       | 安全性   |
| B30 | **Admin email 硬编码在代码中**：`ADMIN_EMAILS` 数组写死在 `permissions.ts` 中，新增/移除 admin 需要代码变更而非配置                                                       | 低       | -          | 可维护性 |

---

## 三、按优先级排序的 Top 10 关键 Bug

| 排名 | Bug ID | 描述                                                     | 严重程度 | 修复建议                                                                                       |
| ---- | ------ | -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| 1    | B01    | Phone 正则过严，拒绝合法国际号码                         | 高       | 使用 libphonenumber 库或放宽正则为 `/^\+\d{1,4}[\s-]?\d{4,14}$/`                               |
| 2    | B14    | 无网站供应商的 website_crawl job 无意义地失败            | 高       | extraction trigger 时判断 website_url 是否存在，为空则跳过创建 crawl job                       |
| 3    | B09    | 合同编辑无并发控制                                       | 高       | 为 contracts 表增加 version 字段，复用 building 的 optimistic locking 模式                     |
| 4    | B10    | 非拉丁字符在 DocuSign PDF 中乱码                         | 高       | DocuSign 模板需配置 Unicode 字体（如 Noto Sans CJK）                                           |
| 5    | B17    | Extraction job timeout 导致 building 永远卡在 extracting | 高       | 添加超时监控 cron job，或在 callback 中检查所有 job 终态（completed/failed/timeout）都算"完成" |
| 6    | B25    | 已签约供应商过早跳转 pro.uhomes.com                      | 高       | 中间件逻辑应区分 SIGNED + 有 building 正在 onboarding 的供应商                                 |
| 7    | B27    | 合同取消后无法重新创建                                   | 高       | 增加 "Create New Contract" 功能，或允许 CANCELED → DRAFT 回退                                  |
| 8    | B22    | image_urls 字段无上传能力，小供应商无法提供              | 高       | 集成 Supabase Storage 文件上传，生成 URL 后写入字段                                            |
| 9    | B20    | 周租 vs 月租歧义导致跨国价格数据不一致                   | 高       | price_min/price_max 增加 rent_period 字段（weekly/monthly/yearly），或在 label 中明确说明      |
| 10   | B07    | Auth 用户已存在时 approve-supplier 失败                  | 高       | approve 时先检查 auth.users 是否已有该 email，如有则复用                                       |

---

## 四、测试执行建议

### 测试顺序

1. **先跑 Happy Path**（供应商 #5 — 加拿大标准流程）确认核心链路正常
2. **国际化测试**（#4 日本、#8 中国、#9 中东）验证非拉丁字符和多币种
3. **边界测试**（#6 无网站、#11 超长名、#12 特殊字符、#15 价格为零）
4. **并发与状态测试**（#13 重复申请、#18 长时间不操作、#20 并发编辑）
5. **流程分支测试**（#14 BD 邀请、#19 Referral Code）

### 环境准备

- 确保 Supabase 测试环境已配置
- 准备 DocuSign Sandbox 账号
- 准备多个测试邮箱（可用 Gmail + 别名：`test+supplier1@gmail.com`）
- Extraction Worker 需要有测试模式或 mock

### 验收标准

每个供应商需完整走通以下流程：

1. Landing Page 申请提交 (或 BD 邀请)
2. BD 审核通过
3. 合同编辑 & 发送
4. 供应商签约
5. AI 数据提取
6. Building 信息填写至 score >= 80%
7. 提交 Ready to Publish
