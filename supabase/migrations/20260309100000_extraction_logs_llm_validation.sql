-- Add LLM self-validation tracking columns to extraction_logs
-- Phase 1: 自适应进化 — LLM 交叉验证质量指标

ALTER TABLE extraction_logs
  ADD COLUMN IF NOT EXISTS llm_validation_quality text,
  ADD COLUMN IF NOT EXISTS llm_validation_adjustments integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_validation_removals integer DEFAULT 0;

COMMENT ON COLUMN extraction_logs.llm_validation_quality IS 'LLM self-validation overall quality: high/medium/low/skipped';
COMMENT ON COLUMN extraction_logs.llm_validation_adjustments IS 'Number of confidence adjustments made by LLM validation';
COMMENT ON COLUMN extraction_logs.llm_validation_removals IS 'Number of fields removed by LLM validation (wrong + low confidence)';
