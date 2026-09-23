-- Allow residents to update (cancel) their own payment requests.
-- Mirrors the laundry_update policy from 20260729000000_auth_uid_linking_and_rls.sql,
-- which recreated pr_select/pr_insert but left pr_update officer-only.
DROP POLICY IF EXISTS pr_update ON payment_requests;
CREATE POLICY pr_update ON payment_requests FOR UPDATE TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

-- pr_delete stays officer-only; residents cancel via status = 'CANCELLED'.