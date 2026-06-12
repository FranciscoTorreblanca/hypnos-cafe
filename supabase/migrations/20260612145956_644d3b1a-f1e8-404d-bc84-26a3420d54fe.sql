
-- 1) Track per-user active business
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

-- 2) RPC to set active business (validates membership unless super admin)
CREATE OR REPLACE FUNCTION public.set_active_business(_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_member_of(_business_id) THEN
    RAISE EXCEPTION 'Not a member of this business';
  END IF;
  UPDATE public.profiles SET active_business_id = _business_id WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_active_business(uuid) TO authenticated;

-- 3) Make current_business_id() prefer the explicit active selection
CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT active_business_id FROM public.profiles WHERE id = auth.uid()),
    (SELECT business_id FROM public.business_members
       WHERE user_id = auth.uid()
       ORDER BY is_default DESC, created_at ASC
       LIMIT 1)
  )
$$;

-- 4) Add restrictive read scope on every per-business table.
--    Anonymous (auth.uid() IS NULL) requests pass through so public menus keep working.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'balance_adjustments','budget_categories','business_features','combo_choice_groups',
    'combo_choice_options','combo_items','combos','event_cost_items','events',
    'expense_entries','ingredients','loyalty_coupon_items','loyalty_coupons',
    'loyalty_member_coupons','loyalty_members','loyalty_visits','menu_categories',
    'menu_entries','menu_item_ingredients','menu_item_skus','menu_items','menus',
    'order_items','orders','payments','push_subscriptions','recurring_expenses',
    'reservations','restaurant_settings','ticket_prints','tickets','till_transactions',
    'usage_events'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS active_business_scope ON public.%I', t);
    -- order_items, combo_choice_options, menu_item_ingredients, loyalty_coupon_items,
    -- combo_items, combo_choice_groups, menu_entries, event_cost_items, loyalty_visits,
    -- loyalty_member_coupons, ticket_prints don't always have business_id directly;
    -- but per the schema check all 35 do. So plain business_id filter works.
    EXECUTE format(
      'CREATE POLICY active_business_scope ON public.%I
         AS RESTRICTIVE FOR SELECT
         USING (auth.uid() IS NULL OR business_id = public.current_business_id())',
      t
    );
  END LOOP;
END $$;
