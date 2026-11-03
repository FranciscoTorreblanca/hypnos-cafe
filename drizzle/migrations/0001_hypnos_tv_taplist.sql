ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS beer_style text,
  ADD COLUMN IF NOT EXISTS beer_abv numeric,
  ADD COLUMN IF NOT EXISTS beer_brewery text;

CREATE TABLE public.menu_item_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  label text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  promo_price numeric,
  promo_label text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_item_presentations_item_idx ON public.menu_item_presentations(menu_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_presentations TO authenticated;
GRANT ALL ON public.menu_item_presentations TO service_role;
ALTER TABLE public.menu_item_presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read presentations" ON public.menu_item_presentations FOR SELECT TO authenticated USING (public.is_member_of(business_id) OR public.is_super_admin());
CREATE POLICY "admins write presentations" ON public.menu_item_presentations FOR ALL TO authenticated USING (public.can_manage_schedule(business_id)) WITH CHECK (public.can_manage_schedule(business_id));

CREATE TABLE public.tv_integrations (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  taplist_category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  auto_sync boolean NOT NULL DEFAULT true,
  has_api_key boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  last_sync_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tv_integrations TO authenticated;
GRANT ALL ON public.tv_integrations TO service_role;
ALTER TABLE public.tv_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read tv integration" ON public.tv_integrations FOR SELECT TO authenticated USING (public.is_member_of(business_id) OR public.is_super_admin());
CREATE POLICY "admins insert tv integration" ON public.tv_integrations FOR INSERT TO authenticated WITH CHECK (public.can_manage_schedule(business_id));
CREATE POLICY "admins update tv integration" ON public.tv_integrations FOR UPDATE TO authenticated USING (public.can_manage_schedule(business_id)) WITH CHECK (public.can_manage_schedule(business_id));

-- Keys and remote id mappings: server-only (no client grants)
CREATE TABLE public.tv_integration_secrets (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  api_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tv_integration_secrets TO service_role;
ALTER TABLE public.tv_integration_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tv_remote_refs (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  local_key text NOT NULL,
  remote_id text NOT NULL,
  PRIMARY KEY (business_id, kind, local_key)
);
GRANT ALL ON public.tv_remote_refs TO service_role;
ALTER TABLE public.tv_remote_refs ENABLE ROW LEVEL SECURITY;