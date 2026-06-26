
ALTER TABLE public.business_features
  ADD COLUMN IF NOT EXISTS delivery boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.delivery_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  commission_pct numeric(5,2) NOT NULL DEFAULT 25,
  payout_weekday smallint NOT NULL DEFAULT 5,
  payout_offset_days smallint NOT NULL DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_platforms TO authenticated;
GRANT ALL ON public.delivery_platforms TO service_role;
ALTER TABLE public.delivery_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_platforms_select" ON public.delivery_platforms;
CREATE POLICY "delivery_platforms_select" ON public.delivery_platforms FOR SELECT
  USING (public.is_super_admin() OR public.is_member_of(business_id));

DROP POLICY IF EXISTS "delivery_platforms_write" ON public.delivery_platforms;
CREATE POLICY "delivery_platforms_write" ON public.delivery_platforms FOR ALL
  USING (public.is_super_admin() OR public.is_member_of(business_id))
  WITH CHECK (public.is_super_admin() OR public.is_member_of(business_id));

DROP TRIGGER IF EXISTS trg_delivery_platforms_touch ON public.delivery_platforms;
CREATE TRIGGER trg_delivery_platforms_touch BEFORE UPDATE ON public.delivery_platforms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.menu_item_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES public.delivery_platforms(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, platform_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_platforms TO authenticated;
GRANT ALL ON public.menu_item_platforms TO service_role;
ALTER TABLE public.menu_item_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_item_platforms_select" ON public.menu_item_platforms;
CREATE POLICY "menu_item_platforms_select" ON public.menu_item_platforms FOR SELECT
  USING (public.is_super_admin() OR public.is_member_of(business_id));

DROP POLICY IF EXISTS "menu_item_platforms_write" ON public.menu_item_platforms;
CREATE POLICY "menu_item_platforms_write" ON public.menu_item_platforms FOR ALL
  USING (public.is_super_admin() OR public.is_member_of(business_id))
  WITH CHECK (public.is_super_admin() OR public.is_member_of(business_id));

DROP TRIGGER IF EXISTS trg_menu_item_platforms_touch ON public.menu_item_platforms;
CREATE TRIGGER trg_menu_item_platforms_touch BEFORE UPDATE ON public.menu_item_platforms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_delivery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_platform_id uuid REFERENCES public.delivery_platforms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS external_ref text;

CREATE INDEX IF NOT EXISTS orders_delivery_idx
  ON public.orders (business_id, is_delivery, created_at DESC)
  WHERE is_delivery;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS delivery_platform_id uuid REFERENCES public.delivery_platforms(id) ON DELETE SET NULL;
