
-- 1. loyalty_members
CREATE TABLE public.loyalty_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL DEFAULT '',
  member_code text UNIQUE NOT NULL,
  total_visits integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert loyalty members" ON public.loyalty_members FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can view loyalty members" ON public.loyalty_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update loyalty members" ON public.loyalty_members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anon can select own loyalty member" ON public.loyalty_members FOR SELECT TO anon USING (true);

-- 2. loyalty_visits
CREATE TABLE public.loyalty_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
  registered_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text NOT NULL DEFAULT ''
);
ALTER TABLE public.loyalty_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view loyalty visits" ON public.loyalty_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert loyalty visits" ON public.loyalty_visits FOR INSERT TO authenticated WITH CHECK (true);

-- 3. loyalty_coupons
CREATE TABLE public.loyalty_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_en text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  min_visits integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view loyalty coupons" ON public.loyalty_coupons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view active loyalty coupons" ON public.loyalty_coupons FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Admins can insert loyalty coupons" ON public.loyalty_coupons FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update loyalty coupons" ON public.loyalty_coupons FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete loyalty coupons" ON public.loyalty_coupons FOR DELETE TO authenticated USING (public.is_admin());

-- 4. loyalty_member_coupons
CREATE TABLE public.loyalty_member_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES public.loyalty_coupons(id) ON DELETE CASCADE,
  is_redeemed boolean NOT NULL DEFAULT false,
  redeemed_at timestamptz,
  redeemed_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_member_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view member coupons" ON public.loyalty_member_coupons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view member coupons" ON public.loyalty_member_coupons FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can update member coupons" ON public.loyalty_member_coupons FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can insert member coupons" ON public.loyalty_member_coupons FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete member coupons" ON public.loyalty_member_coupons FOR DELETE TO authenticated USING (public.is_admin());

-- Enable realtime for visits
ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_visits;
