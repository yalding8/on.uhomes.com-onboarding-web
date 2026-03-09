# 自适应提取管线进化路线图

> 2026-03-09 调研成果 + 专家评审结论

## 当前基线

- 8 个公寓商官网，3 种策略（lightweight/standard/stealth），100% 路由准确率
- DeepSeek LLM 提取，平均 24 分（满分 100），最高 44 分（Unite Students）
- 平均 11 个字段 / 66 个字段，Tier A 覆盖 64%，Tier B 覆盖 71%，Tier C 覆盖 0%

## 分阶段路线

### Phase 0：数据积累（地基）

每次提取自动记录完整上下文到 `extraction_logs`，为后续所有优化提供数据基础：

- 站点特征快照（type, framework, CF level, JSON-LD/OG 有无）
- 策略选择及耗时分布（probe/scrape/llm 各阶段 ms）
- 提取结果（字段 key, value, confidence, source）
- LLM 调用详情（provider, model, token count, latency）
- 人工修正记录（原始值 → 修正值，来自 `extraction_feedback`）

### Phase 1：提取自查（LLM 自校验）

提取完成后增加一轮校验 prompt，检查：

- 价格范围合理性（月租 $100-$10,000）
- 地址格式完整性（有无城市/国家）
- 字段间一致性（currency 与 price 匹配）
- 图片 URL 可达性
- 将 medium 置信度提升为 high 或降级为 low

### Phase 2：Few-shot 注入（Prompt 自动优化）

从 feedback 数据中：

- 统计各字段错误率，识别高频失败字段
- 自动从成功案例中挑选 few-shot 示例
- 注入 prompt 模板，提升弱势字段提取率

前置条件：50+ 条人工修正反馈

### Phase 3：策略自适应（路由进化）

- 分析 feedback 中 cheerio 失败 → Playwright 成功的模式
- 自动扩展 site-probe 指纹库（新建站平台、新框架）
- 策略降级/升级自动调整

前置条件：100+ 条反馈 + 跨 20+ 站点

### Phase 4：Schema 自优化

参考 PARSE (arXiv 2025) 论文：

- LLM 自动优化字段描述和提取指令
- A/B 对比不同 prompt 版本的提取效果
- 自动选择最优 prompt

前置条件：200+ 条反馈

## 学术参考

| 论文                        | 年份 | 核心思想                      | 适用阶段  |
| :-------------------------- | :--- | :---------------------------- | :-------- |
| AutoScraper (EMNLP 2024)    | 2024 | 渐进式理解 + 爬虫合成         | Phase 3   |
| SeeAct / GPT-4V (ICML 2024) | 2024 | 视觉+DOM 双通道理解           | Phase 4   |
| PARSE (arXiv 2025)          | 2025 | JSON Schema 自优化 + 反射校验 | Phase 4   |
| WebRL (清华 2024)           | 2024 | 自进化课程 RL，从失败中学习   | Phase 4+  |
| ChatExtract (Nature 2024)   | 2024 | 提取-追问-验证三段式          | Phase 1   |
| SelfRefinement4ExtractGPT   | 2024 | LLM 自修正循环                | Phase 1-2 |

## 开源项目参考

| 项目          | Stars | 核心价值                     | 适用阶段     |
| :------------ | :---- | :--------------------------- | :----------- |
| Scrapling     | 25k+  | 自适应元素定位，应对网站改版 | Phase 3      |
| Crawl4AI      | 20k+  | 自适应爬取 + LLM 抽取        | Phase 2-3    |
| ScrapeGraphAI | 20k+  | 图流水线多步抽取             | Phase 3      |
| Firecrawl     | 70k+  | 工业级 API，JS 渲染强        | 基础设施参考 |
| AutoScraper   | 5k+   | 给示例即学，快速适配新站点   | Phase 2      |

## 设计原则

1. **每次爬取都在积累经验** — 即使不做任何优化，数据也在为未来铺路
2. **人工修正是最有价值的信号** — BD 对提取结果的每一次修正都是训练数据
3. **渐进式升级** — 每个 Phase 独立可用，不依赖后续 Phase
4. **成本可控** — Phase 0-1 几乎零额外成本，Phase 2+ 按需启用
