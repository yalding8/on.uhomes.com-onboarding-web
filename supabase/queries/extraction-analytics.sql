-- ═══════════════════════════════════════════════════════════
-- Extraction Analytics Queries — 自适应进化监控面板
-- 用于分析 extraction_logs 积累的经验数据
-- ═══════════════════════════════════════════════════════════

-- 1. 策略效果总览 — 哪种策略提取质量最高？
SELECT
  strategy_used,
  COUNT(*) AS total_crawls,
  ROUND(AVG(field_coverage_ratio), 3) AS avg_coverage,
  ROUND(AVG(confidence_high_count), 1) AS avg_high,
  ROUND(AVG(confidence_medium_count), 1) AS avg_medium,
  ROUND(AVG(confidence_low_count), 1) AS avg_low,
  ROUND(AVG(total_duration_ms), 0) AS avg_duration_ms,
  ROUND(AVG(validation_issues_count), 1) AS avg_issues
FROM extraction_logs
GROUP BY strategy_used
ORDER BY avg_coverage DESC;

-- 2. LLM 自校验效果 — 验证质量分布
SELECT
  llm_validation_quality,
  COUNT(*) AS count,
  ROUND(AVG(llm_validation_adjustments), 1) AS avg_adjustments,
  ROUND(AVG(llm_validation_removals), 1) AS avg_removals,
  ROUND(AVG(confidence_high_count), 1) AS avg_high_after,
  ROUND(AVG(field_coverage_ratio), 3) AS avg_coverage
FROM extraction_logs
WHERE llm_validation_quality IS NOT NULL
GROUP BY llm_validation_quality
ORDER BY count DESC;

-- 3. 站点类型 × 框架 矩阵 — 发现提取薄弱区域
SELECT
  site_type,
  site_framework,
  COUNT(*) AS crawls,
  ROUND(AVG(field_coverage_ratio), 3) AS avg_coverage,
  ROUND(AVG(confidence_high_count + confidence_medium_count), 1) AS avg_useful_fields,
  ROUND(AVG(total_duration_ms), 0) AS avg_ms
FROM extraction_logs
WHERE site_type IS NOT NULL
GROUP BY site_type, site_framework
ORDER BY crawls DESC;

-- 4. 域名 Top-N 质量排名 — 识别高价值/低价值域名
SELECT
  url_domain,
  COUNT(*) AS crawls,
  ROUND(AVG(field_coverage_ratio), 3) AS avg_coverage,
  ROUND(AVG(confidence_high_count), 1) AS avg_high,
  ROUND(AVG(total_duration_ms), 0) AS avg_ms,
  MAX(created_at) AS last_crawl
FROM extraction_logs
GROUP BY url_domain
ORDER BY avg_coverage DESC
LIMIT 20;

-- 5. 时间趋势 — 提取质量是否在改善？
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS crawls,
  ROUND(AVG(field_coverage_ratio), 3) AS avg_coverage,
  ROUND(AVG(confidence_high_count), 1) AS avg_high,
  ROUND(AVG(validation_issues_count), 1) AS avg_issues,
  ROUND(AVG(llm_validation_adjustments), 1) AS avg_val_adjustments
FROM extraction_logs
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- 6. LLM 效果对比 — 跳过 LLM vs 使用 LLM
SELECT
  llm_skipped,
  COUNT(*) AS crawls,
  ROUND(AVG(field_coverage_ratio), 3) AS avg_coverage,
  ROUND(AVG(confidence_high_count + confidence_medium_count + confidence_low_count), 1) AS avg_total_fields,
  ROUND(AVG(confidence_high_count), 1) AS avg_high,
  ROUND(AVG(total_duration_ms), 0) AS avg_ms
FROM extraction_logs
GROUP BY llm_skipped;

-- 7. 失败热点 — 哪些域名经常失败？
SELECT
  url_domain,
  COUNT(*) AS total,
  SUM(CASE WHEN validation_issues_count > 3 THEN 1 ELSE 0 END) AS high_issue_count,
  ROUND(AVG(validation_issues_count), 1) AS avg_issues
FROM extraction_logs
WHERE validation_issues_count > 0
GROUP BY url_domain
HAVING COUNT(*) >= 2
ORDER BY avg_issues DESC
LIMIT 15;
