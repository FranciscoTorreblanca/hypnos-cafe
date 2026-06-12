
-- Helper that returns the caller's default business id (or any single membership)
CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT business_id FROM public.business_members
   WHERE user_id = auth.uid()
   ORDER BY is_default DESC, created_at ASC
   LIMIT 1
$$;

DO $$
DECLARE
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
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET DEFAULT public.current_business_id()', v_table);
  END LOOP;
END $$;
