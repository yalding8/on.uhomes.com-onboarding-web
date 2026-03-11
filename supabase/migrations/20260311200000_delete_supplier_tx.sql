-- Transaction function: atomically delete/anonymize all supplier DB data.
-- Storage cleanup and Auth user deletion stay in the application layer.

CREATE OR REPLACE FUNCTION public.delete_supplier_tx(
  p_supplier_id UUID,
  p_contact_email TEXT,
  p_is_australia BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_ids UUID[];
BEGIN
  -- 1. Delete supplier notes
  DELETE FROM supplier_notes WHERE supplier_id = p_supplier_id;

  -- 2. Delete supplier badges
  DELETE FROM supplier_badges WHERE supplier_id = p_supplier_id;

  -- 3. Delete building_images (before buildings, since buildings cascade but images table may not)
  DELETE FROM building_images
  WHERE building_id IN (SELECT id FROM buildings WHERE supplier_id = p_supplier_id);

  -- 4. Delete buildings (child tables cascade via FK)
  DELETE FROM buildings WHERE supplier_id = p_supplier_id;

  -- 5. Anonymize contracts (both paths need this)
  UPDATE contracts
  SET document_url = NULL, signature_fields = NULL
  WHERE supplier_id = p_supplier_id;

  -- 6. Collect application IDs for note cleanup
  IF p_contact_email IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_app_ids
    FROM applications
    WHERE contact_email = p_contact_email;

    IF v_app_ids IS NOT NULL THEN
      DELETE FROM application_notes WHERE application_id = ANY(v_app_ids);
    END IF;

    DELETE FROM applications WHERE contact_email = p_contact_email;
  END IF;

  -- 7. Supplier: anonymize (AU) or hard-delete (GDPR)
  IF p_is_australia THEN
    UPDATE suppliers
    SET contact_email = 'deleted-' || p_supplier_id || '@anonymized.local',
        company_name = '[DELETED]',
        status = 'DELETED'
    WHERE id = p_supplier_id;
  ELSE
    DELETE FROM suppliers WHERE id = p_supplier_id;
  END IF;
END;
$$;
