-- 017: Per-instance laundry operating hours (Supabase constants)
--
-- Each deployment is one hall instance (INSTANCE_ADMIN email) with its own
-- Supabase project, so rows in `constants` are inherently per-instance.
-- Residents can read them (constants_select USING (true)); only officers can
-- write them (constants_write requires is_officer()). No RLS change needed.
--
-- The slot engine (src/lib/utils/laundry-slots.ts) builds fixed 2-hour slots
-- with 30-minute turnover buffers from this window and extends the effective
-- close instead of emitting a partial trailing slot.

INSERT INTO public.constants (key, value, description) VALUES
  ('LAUNDRY_OPEN', '05:00', 'Laundry opening time (HH:MM, 24h). Per-instance operating window start.'),
  ('LAUNDRY_CLOSE', '22:00', 'Laundry closing time (HH:MM, 24h). Slots regenerate when changed; tail extends instead of partial slots.')
ON CONFLICT (key) DO NOTHING;
