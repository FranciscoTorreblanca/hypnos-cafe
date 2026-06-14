
CREATE TABLE public.menu_item_addons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  extra_price numeric(10,2) NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  business_id uuid NOT NULL DEFAULT current_business_id() REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX menu_item_addons_menu_item_id_idx ON public.menu_item_addons(menu_item_id);
CREATE INDEX menu_item_addons_business_id_idx ON public.menu_item_addons(business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_addons TO authenticated;
GRANT SELECT ON public.menu_item_addons TO anon;
GRANT ALL ON public.menu_item_addons TO service_role;

ALTER TABLE public.menu_item_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view addons" ON public.menu_item_addons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view addons" ON public.menu_item_addons FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can insert addons" ON public.menu_item_addons FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update addons" ON public.menu_item_addons FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete addons" ON public.menu_item_addons FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "active_business_scope" ON public.menu_item_addons AS RESTRICTIVE FOR SELECT
  USING (auth.uid() IS NULL OR business_id = current_business_id());
CREATE POLICY "business_scope_restrictive" ON public.menu_item_addons AS RESTRICTIVE
  USING (auth.uid() IS NULL OR is_super_admin() OR is_member_of(business_id))
  WITH CHECK (is_super_admin() OR is_member_of(business_id));

CREATE TRIGGER update_menu_item_addons_updated_at
  BEFORE UPDATE ON public.menu_item_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
