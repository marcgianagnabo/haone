-- Public clearance lookup: returns clearance-safe fields for an account
-- by its CE reference number. SECURITY DEFINER runs as the function owner
-- so anonymous calls can verify the single requested clearance without
-- relaxing accounts/users RLS. Mirrors get_receipt_by_id() for receipts.
CREATE OR REPLACE FUNCTION public.get_clearance_by_refno(refno TEXT)
RETURNS TABLE (
  ref_no TEXT,
  account_name TEXT,
  account_stno TEXT,
  ce_issued TEXT,
  period TEXT,
  signatory TEXT,
  signatory_title TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.ce_ref_no,
    COALESCE(
      NULLIF(TRIM(ru.display_name_fl), ''),
      NULLIF(TRIM(ru.display_name), ''),
      'Resident'
    ),
    COALESCE(ru.student_no, ''),
    COALESCE(a.ce_issued::TEXT, ''),
    COALESCE(a.period, ''),
    COALESCE(
      NULLIF(TRIM(iu.display_name_fl), ''),
      NULLIF(TRIM(iu.display_name), ''),
      'HOUSE COUNCIL OFFICER'
    ),
    COALESCE(o.position, 'Officer')
  FROM accounts a
  LEFT JOIN users_view ru ON ru.id = a.resident_id
  LEFT JOIN users_view iu ON iu.id = a.issuer_id
  LEFT JOIN officers o
    ON LOWER(o.email) = LOWER(iu.email)
    AND o.term = a.period
  WHERE a.ce_ref_no = refno
  ORDER BY o.created_at DESC NULLS LAST
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clearance_by_refno(TEXT) TO anon, authenticated;
