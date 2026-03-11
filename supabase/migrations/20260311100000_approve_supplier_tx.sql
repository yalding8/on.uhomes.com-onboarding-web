-- Transaction function: atomically create supplier + contract + mark application CONVERTED.
-- Auth user creation stays in the application layer (Supabase Auth API).

CREATE OR REPLACE FUNCTION public.approve_supplier_tx(
  p_application_id UUID,
  p_user_id UUID,
  p_company_name TEXT,
  p_supplier_type TEXT,
  p_contact_email TEXT,
  p_bd_user_id UUID,
  p_contract_type TEXT,
  p_role TEXT DEFAULT 'supplier'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id UUID;
  v_contract_id UUID;
BEGIN
  -- 1. Create supplier record
  INSERT INTO suppliers (user_id, company_name, supplier_type, contact_email, status, role, bd_user_id)
  VALUES (p_user_id, p_company_name, p_supplier_type, p_contact_email, 'PENDING_CONTRACT', p_role, p_bd_user_id)
  RETURNING id INTO v_supplier_id;

  -- 2. Create contract record
  INSERT INTO contracts (supplier_id, status, signature_provider, contract_fields, provider_metadata)
  VALUES (
    v_supplier_id,
    'DRAFT',
    'DOCUSIGN',
    '{}'::jsonb,
    jsonb_build_object('type', p_contract_type, 'source_application', p_application_id::text)
  )
  RETURNING id INTO v_contract_id;

  -- 3. Mark application as CONVERTED
  UPDATE applications
  SET status = 'CONVERTED'
  WHERE id = p_application_id AND status = 'CONVERTING';

  RETURN jsonb_build_object(
    'supplier_id', v_supplier_id,
    'contract_id', v_contract_id
  );
END;
$$;
