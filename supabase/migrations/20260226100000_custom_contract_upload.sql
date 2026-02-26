-- Migration: 非标准合同上传支持
-- 1. 新增 contract_type 列，区分标准合同和自定义上传合同
-- 2. 新增 uploaded_document_url 列，存储 BD 上传的原始 PDF 地址
--
-- 前置条件：手动在 Supabase Dashboard 创建 Storage bucket "uploaded-contracts"
--   - Public: false (仅 service_role 可访问)
--   - File size limit: 10MB
--   - Allowed MIME types: application/pdf

ALTER TABLE public.contracts
ADD COLUMN contract_type text NOT NULL DEFAULT 'STANDARD'
CHECK (contract_type IN ('STANDARD', 'CUSTOM'));

ALTER TABLE public.contracts
ADD COLUMN uploaded_document_url text;
