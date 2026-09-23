-- 006: Residents can see all active laundry slots so bookings cannot conflict.
--
-- Residents who are eligible to use the laundry service must be able to
-- SELECT every booking row in order to (a) see which slots are already taken
-- on the calendar and (b) let the overlap guard reject duplicate bookings.
-- Writes remain restricted to a resident's own rows (insert/update/delete).

DROP POLICY IF EXISTS laundry_select ON laundry;
CREATE POLICY laundry_select ON laundry FOR SELECT TO authenticated
  USING (is_officer() OR can_access_laundry(current_user_id()));