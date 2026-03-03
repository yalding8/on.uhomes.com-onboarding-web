-- ============================================================================
-- 提取反馈表 — 支持 AI 自适应进化的反馈闭环
--
-- BD 确认/修正提取结果后，写入此表。
-- 系统定期分析反馈，优化提取策略和 LLM Prompt。
-- ============================================================================

-- 提取反馈（BD 修正记录）
CREATE TABLE IF NOT EXISTS extraction_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  extraction_job_id uuid REFERENCES extraction_jobs(id) ON DELETE SET NULL,

  -- 站点分类信息
  url_domain text NOT NULL,
  site_type text CHECK (site_type IN ('static', 'spa', 'wordpress', 'platform_template', 'unknown')),
  strategy_used text,

  -- 字段级反馈
  field_key text NOT NULL,
  extracted_value jsonb,
  corrected_value jsonb,
  feedback_type text NOT NULL CHECK (feedback_type IN ('correct', 'wrong', 'missing', 'hallucinated')),

  -- 元信息
  corrected_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 索引：按域名和站点类型分析
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_domain
  ON extraction_feedback(url_domain);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_site_type
  ON extraction_feedback(site_type);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_field
  ON extraction_feedback(field_key, feedback_type);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_building
  ON extraction_feedback(building_id);

-- 提取运行日志（每次提取的完整记录）
CREATE TABLE IF NOT EXISTS extraction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_job_id uuid REFERENCES extraction_jobs(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,

  -- 站点分析
  source_url text NOT NULL,
  url_domain text NOT NULL,
  site_type text,
  site_framework text,
  site_complexity text,

  -- 提取策略
  strategy_used text NOT NULL,
  has_json_ld boolean DEFAULT false,
  has_open_graph boolean DEFAULT false,
  llm_skipped boolean DEFAULT false,
  llm_provider text,

  -- 提取质量
  field_coverage_ratio numeric(4,3),
  confidence_high_count integer DEFAULT 0,
  confidence_medium_count integer DEFAULT 0,
  confidence_low_count integer DEFAULT 0,
  validation_issues_count integer DEFAULT 0,

  -- 性能
  probe_duration_ms integer,
  scrape_duration_ms integer,
  llm_duration_ms integer,
  total_duration_ms integer,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extraction_logs_domain
  ON extraction_logs(url_domain);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_job
  ON extraction_logs(extraction_job_id);

-- RLS 策略
ALTER TABLE extraction_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_logs ENABLE ROW LEVEL SECURITY;

-- BD/Data Team 可读写反馈
CREATE POLICY extraction_feedback_bd_read ON extraction_feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('bd', 'data_team')
    )
  );

CREATE POLICY extraction_feedback_bd_write ON extraction_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('bd', 'data_team')
    )
  );

-- 所有已认证用户可读提取日志
CREATE POLICY extraction_logs_read ON extraction_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role 可写入提取日志（worker 回调写入）
CREATE POLICY extraction_logs_service_write ON extraction_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
