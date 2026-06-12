
-- 1. businesses
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  legal_name text,
  tax_id text,
  address text,
  phone text,
  email text,
  logo_url text,
  ticket_header text,
  ticket_footer text,
  currency text NOT NULL DEFAULT 'MXN',
  language text NOT NULL DEFAULT 'es',
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  vat_rate numeric NOT NULL DEFAULT 16,
  card_commission_rate numeric NOT NULL DEFAULT 5,
  mp_access_token text,
  mp_device_id text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT ON public.businesses TO anon;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- 2. business_features
CREATE TABLE public.business_features (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  tickets boolean NOT NULL DEFAULT true,
  calendar boolean NOT NULL DEFAULT true,
  loyalty boolean NOT NULL DEFAULT true,
  kitchen boolean NOT NULL DEFAULT true,
  cost_calculator boolean NOT NULL DEFAULT true,
  stock boolean NOT NULL DEFAULT true,
  budget boolean NOT NULL DEFAULT true,
  analytics boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  mercado_pago boolean NOT NULL DEFAULT true,
  menu_generator boolean NOT NULL DEFAULT true,
  wifi boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_features TO authenticated;
GRANT SELECT ON public.business_features TO anon;
GRANT ALL ON public.business_features TO service_role;
ALTER TABLE public.business_features ENABLE ROW LEVEL SECURITY;

-- 3. business_members
CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, business_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- 4. Helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = auth.uid() AND business_id = _business_id
  )
$$;

-- 5. Policies on new tables
CREATE POLICY "businesses_super_admin_all" ON public.businesses FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "businesses_members_select" ON public.businesses FOR SELECT TO authenticated
  USING (public.is_member_of(id));
CREATE POLICY "businesses_anon_select_active" ON public.businesses FOR SELECT TO anon
  USING (status = 'active');

CREATE POLICY "business_features_super_admin_all" ON public.business_features FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "business_features_members_select" ON public.business_features FOR SELECT TO authenticated
  USING (public.is_member_of(business_id));
CREATE POLICY "business_features_anon_select" ON public.business_features FOR SELECT TO anon
  USING (true);

CREATE POLICY "business_members_super_admin_all" ON public.business_members FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "business_members_self_select" ON public.business_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "business_members_admin_manage" ON public.business_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.is_member_of(business_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.is_member_of(business_id));

-- 6. Seed Hypnos Cafe + link users + promote super admins
DO $$
DECLARE
  v_bid uuid := gen_random_uuid();
  v_name text;
  v_address text;
  v_phone text;
  v_rfc text;
  v_currency text;
  v_language text;
  v_tax numeric;
  v_mp_device text;
BEGIN
  SELECT value INTO v_name FROM public.restaurant_settings WHERE key = 'restaurant_name';
  SELECT value INTO v_address FROM public.restaurant_settings WHERE key = 'business_address';
  SELECT value INTO v_phone FROM public.restaurant_settings WHERE key = 'business_phone';
  SELECT value INTO v_rfc FROM public.restaurant_settings WHERE key = 'business_rfc';
  SELECT value INTO v_currency FROM public.restaurant_settings WHERE key = 'currency';
  SELECT value INTO v_language FROM public.restaurant_settings WHERE key = 'language';
  SELECT NULLIF(value,'')::numeric INTO v_tax FROM public.restaurant_settings WHERE key = 'tax_rate';
  SELECT value INTO v_mp_device FROM public.restaurant_settings WHERE key = 'mp_device_id';

  INSERT INTO public.businesses (id, name, slug, address, phone, tax_id, currency, language, vat_rate, mp_device_id)
  VALUES (
    v_bid,
    COALESCE(NULLIF(v_name,''), 'Hypnos Cafe'),
    'hypnos-cafe',
    NULLIF(v_address,''),
    NULLIF(v_phone,''),
    NULLIF(v_rfc,''),
    COALESCE(NULLIF(v_currency,''), 'MXN'),
    COALESCE(NULLIF(v_language,''), 'es'),
    COALESCE(v_tax, 16),
    NULLIF(v_mp_device,'')
  );

  INSERT INTO public.business_features (business_id) VALUES (v_bid);

  INSERT INTO public.business_members (user_id, business_id, is_default)
  SELECT DISTINCT id, v_bid, true FROM auth.users
  ON CONFLICT DO NOTHING;
END $$;

-- Promote existing admins to super_admin
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::public.app_role FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- 7. Add business_id column to every operational table, backfill, NOT NULL, restrictive RLS
DO $$
DECLARE
  v_bid uuid;
  v_table text;
  v_tables text[] := ARRAY[
    'menu_items','menu_categories','menus','menu_entries',
    'combos','combo_items','combo_choice_groups','combo_choice_options',
    'ingredients','menu_item_ingredients','menu_item_skus',
    'orders','order_items','payments','tickets','ticket_prints',
    'till_transactions','balance_adjustments',
    'budget_categories','expense_entries','recurring_expenses',
    'reservations','events','event_cost_categories','event_cost_items',
    'loyalty_members','loyalty_coupons','loyalty_coupon_items',
    'loyalty_member_coupons','loyalty_visits',
    'push_subscriptions','usage_events','restaurant_settings'
  ];
BEGIN
  SELECT id INTO v_bid FROM public.businesses WHERE slug = 'hypnos-cafe';

  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE', v_table);
    EXECUTE format('UPDATE public.%I SET business_id = %L WHERE business_id IS NULL', v_table, v_bid);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET NOT NULL', v_table);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(business_id)', v_table || '_business_id_idx', v_table);

    EXECUTE format($f$
      DROP POLICY IF EXISTS "business_scope_restrictive" ON public.%I;
      CREATE POLICY "business_scope_restrictive" ON public.%I
        AS RESTRICTIVE FOR ALL TO public
        USING (
          auth.uid() IS NULL
          OR public.is_super_admin()
          OR public.is_member_of(business_id)
        )
        WITH CHECK (
          public.is_super_admin()
          OR public.is_member_of(business_id)
        );
    $f$, v_table, v_table);
  END LOOP;
END $$;

-- 8. Remove obsolete tables_count
DELETE FROM public.restaurant_settings WHERE key = 'tables_count';

-- 9. updated_at triggers for new tables
CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER business_features_updated_at BEFORE UPDATE ON public.business_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
