-- Maintenance & Gas fee columns (schema only; fee logic wired separately)
ALTER TABLE journal ADD COLUMN maintenance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE journal ADD COLUMN gas NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE payment_requests ADD COLUMN maintenance_fee NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE payment_requests ADD COLUMN gas_fee NUMERIC(12, 2) DEFAULT 0;

-- Public e-receipt lookup: returns receipt-safe fields for a journal entry.
-- SECURITY DEFINER runs as the function owner so anonymous calls can read the
-- single requested journal row without relaxing journal RLS.
CREATE OR REPLACE FUNCTION public.get_receipt_by_id(txn_id UUID)
RETURNS TABLE (
  id UUID,
  date DATE,
  water NUMERIC,
  assoc NUMERIC,
  misc NUMERIC,
  maintenance NUMERIC,
  gas NUMERIC,
  mop TEXT,
  period TEXT,
  type TEXT,
  notes TEXT,
  mop_ref_no TEXT,
  pr_date_issued DATE,
  pr_ref_no TEXT,
  creator_name TEXT,
  account_name TEXT,
  account_stno TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.date,
    j.water,
    j.assoc,
    j.misc,
    j.maintenance,
    j.gas,
    j.mop,
    j.period,
    j.type,
    j.notes,
    j.mop_ref_no,
    j.pr_date_issued,
    j.pr_ref_no,
    cu.display_name,
    au.display_name,
    au.student_no
  FROM journal j
  LEFT JOIN users_view cu ON cu.id = j.creator_id
  LEFT JOIN users_view au ON au.id = j.account_id
  WHERE j.id = txn_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_receipt_by_id(UUID) TO anon, authenticated;