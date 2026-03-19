
CREATE TABLE public.loyalty_coupon_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.loyalty_coupons(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  UNIQUE(coupon_id, menu_item_id)
);

ALTER TABLE public.loyalty_coupon_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view coupon items" ON public.loyalty_coupon_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view coupon items" ON public.loyalty_coupon_items FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can insert coupon items" ON public.loyalty_coupon_items FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete coupon items" ON public.loyalty_coupon_items FOR DELETE TO authenticated USING (is_admin());
