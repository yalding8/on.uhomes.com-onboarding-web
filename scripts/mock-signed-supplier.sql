-- ============================================================
-- Mock Signed Supplier — 测试 LLM Extraction 流程
-- 在 Supabase SQL Editor 执行
-- ============================================================

-- 1. 找到一个现有的 APPROVED/CONVERTING supplier（或手动选一个 supplier ID）
-- 如果没有合适的，以下会创建一组完整的测试数据

DO $$
DECLARE
  v_supplier_id uuid;
  v_contract_id uuid;
  v_building_id uuid;
  v_bd_id uuid;
BEGIN
  -- 尝试找到一个有 building 的 supplier
  SELECT s.id INTO v_supplier_id
  FROM suppliers s
  JOIN buildings b ON b.supplier_id = s.id
  WHERE s.status IN ('APPROVED', 'CONVERTING', 'SIGNED')
  LIMIT 1;

  -- 如果没有找到，创建一个新的测试 supplier
  IF v_supplier_id IS NULL THEN
    -- 使用任意一个 bd user
    SELECT id INTO v_bd_id FROM auth.users LIMIT 1;

    INSERT INTO suppliers (
      company_name, contact_email, contact_phone, city, country,
      website_url, supplier_type, status, bd_user_id
    ) VALUES (
      'Mock PBSA London (Test)', 'test-pbsa@example.com', '+44 20 1234 5678',
      'London', 'United Kingdom',
      'https://www.unitestudents.com/london', 'Purpose Built Student Accommodation Provider',
      'SIGNED', v_bd_id
    ) RETURNING id INTO v_supplier_id;

    RAISE NOTICE 'Created supplier: %', v_supplier_id;
  ELSE
    -- 更新现有 supplier 为 SIGNED
    UPDATE suppliers SET status = 'SIGNED' WHERE id = v_supplier_id;
    RAISE NOTICE 'Updated existing supplier to SIGNED: %', v_supplier_id;
  END IF;

  -- 2. 确保有 contract（SIGNED 状态）
  SELECT id INTO v_contract_id
  FROM contracts
  WHERE supplier_id = v_supplier_id
  LIMIT 1;

  IF v_contract_id IS NULL THEN
    INSERT INTO contracts (
      supplier_id, contract_type, status, signed_at,
      provider_metadata
    ) VALUES (
      v_supplier_id, 'STANDARD_PROMOTION_2026', 'SIGNED', now(),
      jsonb_build_object(
        'supplier_signed_at', now()::text,
        'envelope_id', 'mock-envelope-' || gen_random_uuid()::text
      )
    ) RETURNING id INTO v_contract_id;

    RAISE NOTICE 'Created contract: %', v_contract_id;
  ELSE
    UPDATE contracts
    SET status = 'SIGNED',
        signed_at = COALESCE(signed_at, now()),
        provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) ||
          jsonb_build_object('supplier_signed_at', now()::text)
    WHERE id = v_contract_id;

    RAISE NOTICE 'Updated existing contract to SIGNED: %', v_contract_id;
  END IF;

  -- 3. 确保有 building
  SELECT id INTO v_building_id
  FROM buildings
  WHERE supplier_id = v_supplier_id
  LIMIT 1;

  IF v_building_id IS NULL THEN
    INSERT INTO buildings (
      supplier_id, name, onboarding_status, website_url
    ) VALUES (
      v_supplier_id, 'Unite Students Tower Bridge',
      'pending_extraction',
      'https://www.unitestudents.com/london/tower-bridge'
    ) RETURNING id INTO v_building_id;

    RAISE NOTICE 'Created building: %', v_building_id;
  ELSE
    -- Reset building to pending_extraction for testing
    UPDATE buildings
    SET onboarding_status = 'pending_extraction', score = NULL
    WHERE id = v_building_id;

    RAISE NOTICE 'Reset building for extraction test: %', v_building_id;
  END IF;

  -- 4. 清理该 building 的旧 extraction_jobs 和 onboarding_data（测试用）
  DELETE FROM extraction_jobs WHERE building_id = v_building_id;
  DELETE FROM building_onboarding_data WHERE building_id = v_building_id;

  -- 5. 输出 ID 供后续使用
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Mock data ready! Use these IDs:';
  RAISE NOTICE '  supplier_id: %', v_supplier_id;
  RAISE NOTICE '  contract_id: %', v_contract_id;
  RAISE NOTICE '  building_id: %', v_building_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Copy the building_id and supplier_id';
  RAISE NOTICE '2. Run the trigger curl command (see mock-extraction-test.sh)';
  RAISE NOTICE '3. Run the callback curl command with mock extracted data';
END $$;

-- 查看结果
SELECT
  s.id as supplier_id,
  s.company_name,
  s.status as supplier_status,
  c.id as contract_id,
  c.status as contract_status,
  b.id as building_id,
  b.name as building_name,
  b.onboarding_status
FROM suppliers s
LEFT JOIN contracts c ON c.supplier_id = s.id
LEFT JOIN buildings b ON b.supplier_id = s.id
WHERE s.status = 'SIGNED'
ORDER BY s.created_at DESC
LIMIT 5;
