CREATE TABLE IF NOT EXISTS public.email_blast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'haone' CHECK (source IN ('haone', 'csv')),
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_blast_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_blast_campaigns_select" ON public.email_blast_campaigns;
CREATE POLICY "email_blast_campaigns_select"
  ON public.email_blast_campaigns
  FOR SELECT TO authenticated
  USING (public.is_officer());

DROP POLICY IF EXISTS "email_blast_campaigns_insert" ON public.email_blast_campaigns;
CREATE POLICY "email_blast_campaigns_insert"
  ON public.email_blast_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.is_officer());

DROP POLICY IF EXISTS "email_blast_campaigns_update" ON public.email_blast_campaigns;
CREATE POLICY "email_blast_campaigns_update"
  ON public.email_blast_campaigns
  FOR UPDATE TO authenticated
  USING (public.is_officer())
  WITH CHECK (public.is_officer());

DROP POLICY IF EXISTS "email_blast_campaigns_delete" ON public.email_blast_campaigns;
CREATE POLICY "email_blast_campaigns_delete"
  ON public.email_blast_campaigns
  FOR DELETE TO authenticated
  USING (public.is_officer());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_blast_campaigns TO authenticated;
