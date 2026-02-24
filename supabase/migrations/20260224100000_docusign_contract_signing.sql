-- Migration: DocuSign 合同签署集成 - Schema 变更
-- 1. 更新 contracts 表 status CHECK 约束，新增 PENDING_REVIEW 和 CONFIRMED 状态
-- 2. 新增 contract_fields JSONB 列，用于存储合同动态字段值

-- Step 1: 删除旧的 status CHECK 约束
ALTER TABLE public.contracts DROP CONSTRAINT contracts_status_check;

-- Step 2: 添加新的 status CHECK 约束（新增 PENDING_REVIEW、CONFIRMED）
ALTER TABLE public.contracts
ADD CONSTRAINT contracts_status_check
CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'CONFIRMED', 'SENT', 'SIGNED', 'CANCELED'));

-- Step 3: 新增 contract_fields JSONB 列，用于存储合同动态字段（如公司名、佣金比例等）
ALTER TABLE public.contracts
ADD COLUMN contract_fields jsonb DEFAULT '{}'::jsonb;
