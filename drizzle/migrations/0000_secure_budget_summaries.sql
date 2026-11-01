CREATE INDEX IF NOT EXISTS payments_business_created_idx ON public.payments (business_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS expenses_business_paid_idx ON public.expense_entries (business_id, paid_at DESC, id);
CREATE INDEX IF NOT EXISTS adjustments_business_created_idx ON public.balance_adjustments (business_id, created_at DESC, id);

CREATE OR REPLACE FUNCTION public.budget_payment_net(_gross numeric, _method text, _commission numeric DEFAULT 0, _vat numeric DEFAULT 0)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT CASE WHEN _method = 'card' THEN _gross * 0.95
 WHEN _method = 'delivery' THEN _gross * (1 - _commission / 100) / (1 + _vat / 100)
 ELSE _gross END;
$$;
REVOKE ALL ON FUNCTION public.budget_payment_net(numeric,text,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.budget_payment_net(numeric,text,numeric,numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.till_balance(_business_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR _business_id IS DISTINCT FROM public.current_business_id()
 OR NOT (public.is_super_admin() OR public.is_member_of(_business_id)) THEN
  RAISE EXCEPTION 'Business access denied' USING ERRCODE = '42501';
 END IF;
 RETURN (SELECT COALESCE(SUM(public.till_tx_signed(type, amount)),0) FROM public.till_transactions WHERE business_id = _business_id);
END;
$$;
REVOKE ALL ON FUNCTION public.till_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.till_balance(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.budget_summary(_business_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
 v_timezone text;
 v_vat numeric;
 v_start timestamptz;
 v_end timestamptz;
 v_cash numeric;
 v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR _business_id IS DISTINCT FROM public.current_business_id()
 OR NOT (public.is_super_admin() OR (public.is_member_of(_business_id) AND
 (public.is_admin() OR public.has_business_role(auth.uid(), _business_id, 'business_admin') OR public.has_business_role(auth.uid(), _business_id, 'admin')))) THEN
  RAISE EXCEPTION 'Budget access denied' USING ERRCODE = '42501';
 END IF;
 SELECT timezone, vat_rate INTO v_timezone, v_vat FROM public.businesses WHERE id = _business_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;
 v_start := date_trunc('month', now() AT TIME ZONE v_timezone) AT TIME ZONE v_timezone;
 v_end := (date_trunc('month', now() AT TIME ZONE v_timezone) + interval '1 month') AT TIME ZONE v_timezone;
 v_cash := public.till_balance(_business_id);
 WITH payment_rows AS (
  SELECT p.*, public.budget_payment_net(p.amount + p.tip, p.payment_method, COALESCE(dp.commission_pct,0), v_vat) AS net
  FROM public.payments p
  LEFT JOIN public.orders o ON o.id = p.order_id AND o.business_id = _business_id
  LEFT JOIN public.delivery_platforms dp ON dp.id = COALESCE(p.delivery_platform_id,o.delivery_platform_id) AND dp.business_id = _business_id
  WHERE p.business_id = _business_id
 ), payment_totals AS (
  SELECT count(*) AS payment_count,
   COALESCE(sum(net) FILTER (WHERE payment_method IN ('card','transfer')),0) AS card_receipts,
   COALESCE(sum(net) FILTER (WHERE payment_method = 'delivery'),0) AS delivery_pending,
   COALESCE(sum(net) FILTER (WHERE created_at >= v_start AND created_at < v_end),0) AS month_income
  FROM payment_rows
 ), expense_totals AS (
  SELECT COALESCE(sum(e.amount) FILTER (WHERE e.payment_source = 'card'),0) AS card_expenses,
   COALESCE(sum(e.amount) FILTER (WHERE e.paid_at >= v_start AND e.paid_at < v_end),0) AS month_spent,
   COALESCE(sum(e.amount) FILTER (WHERE e.paid_at >= v_start AND e.paid_at < v_end AND c.kind = 'fixed'),0) AS month_fixed_spent,
   COALESCE(sum(e.amount) FILTER (WHERE e.paid_at >= v_start AND e.paid_at < v_end AND c.kind IS DISTINCT FROM 'fixed'),0) AS month_variable_spent
  FROM public.expense_entries e LEFT JOIN public.budget_categories c ON c.id = e.category_id AND c.business_id = _business_id
  WHERE e.business_id = _business_id
 ), adjustment_totals AS (
  SELECT COALESCE(sum(amount),0) AS card_adjustments FROM public.balance_adjustments WHERE business_id = _business_id AND source = 'card'
 ), recurring_total AS (
  SELECT COALESCE(sum(amount * CASE frequency WHEN 'daily' THEN 30 WHEN 'weekly' THEN 4.345 WHEN 'biweekly' THEN 2.1725 WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 1.0/3 WHEN 'yearly' THEN 1.0/12 ELSE 0 END),0) AS monthly_fixed
  FROM public.recurring_expenses WHERE business_id = _business_id AND is_active
 ), category_totals AS (
  SELECT c.id,c.label,c.label_en,c.color,sum(e.amount) AS amount FROM public.expense_entries e
  JOIN public.budget_categories c ON c.id = e.category_id AND c.business_id = _business_id
  WHERE e.business_id = _business_id AND e.paid_at >= v_start AND e.paid_at < v_end GROUP BY c.id
 ), last_paid AS (
  SELECT recurring_id,max(paid_at) AS paid_at FROM public.expense_entries WHERE business_id = _business_id AND recurring_id IS NOT NULL GROUP BY recurring_id
 )
 SELECT jsonb_build_object(
  'business_id',_business_id,'fetched_at',now(),'month_start',v_start,
  'cash',v_cash,'card',p.card_receipts + a.card_adjustments - e.card_expenses,
  'total',v_cash + p.card_receipts + a.card_adjustments - e.card_expenses,
  'delivery_pending',p.delivery_pending,'payment_count',p.payment_count,
  'monthly_fixed',r.monthly_fixed,'month_income',p.month_income,
  'month_spent',e.month_spent,'month_fixed_spent',e.month_fixed_spent,'month_variable_spent',e.month_variable_spent,
  'by_category',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.amount DESC) FROM category_totals c),'[]'::jsonb),
  'last_paid',COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM last_paid l),'[]'::jsonb)
 ) INTO v_result FROM payment_totals p CROSS JOIN expense_totals e CROSS JOIN adjustment_totals a CROSS JOIN recurring_total r;
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.budget_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.budget_summary(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.budget_summary(uuid) IS 'Complete authorized active-business balances; cash uses Till exclusively; delivery net is a receivable, not an assumed bank deposit. Does not modify any ledger.';