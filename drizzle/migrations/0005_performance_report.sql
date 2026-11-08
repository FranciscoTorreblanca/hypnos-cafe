CREATE INDEX IF NOT EXISTS idx_orders_business_created ON public.orders(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_business_paid ON public.expense_entries(business_id, paid_at);

CREATE OR REPLACE FUNCTION public.performance_report(_business_id uuid, _start timestamptz, _end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tz text; v_vat numeric; v_monthly_fixed numeric; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR _business_id IS DISTINCT FROM public.current_business_id()
 OR NOT (public.is_super_admin() OR (public.is_member_of(_business_id) AND
 (public.is_admin() OR public.has_business_role(auth.uid(), _business_id, 'business_admin') OR public.has_business_role(auth.uid(), _business_id, 'admin')))) THEN
  RAISE EXCEPTION 'Performance access denied' USING ERRCODE = '42501';
 END IF;
 IF _end <= _start OR _end - _start > interval '800 days' THEN RAISE EXCEPTION 'Invalid range'; END IF;
 SELECT timezone, vat_rate INTO v_tz, v_vat FROM public.businesses WHERE id = _business_id;

 WITH rec AS (
  SELECT r.amount * CASE r.frequency WHEN 'daily' THEN 30 WHEN 'weekly' THEN 4.345 WHEN 'biweekly' THEN 2.1725 WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 1.0/3 WHEN 'yearly' THEN 1.0/12 ELSE 0 END AS monthly,
   COALESCE(c.key,'other') AS key, COALESCE(c.label,'—') AS label, COALESCE(c.label_en,'—') AS label_en
  FROM public.recurring_expenses r LEFT JOIN public.budget_categories c ON c.id = r.category_id
  WHERE r.business_id = _business_id AND r.is_active
 ), pay AS (
  SELECT p.created_at, p.payment_method, p.amount, p.tip, o.is_delivery,
   public.budget_payment_net(p.amount, p.payment_method, COALESCE(dp.commission_pct,0), v_vat) AS net
  FROM public.payments p
  LEFT JOIN public.orders o ON o.id = p.order_id
  LEFT JOIN public.delivery_platforms dp ON dp.id = COALESCE(p.delivery_platform_id, o.delivery_platform_id)
  WHERE p.business_id = _business_id AND p.created_at >= _start AND p.created_at < _end
 ), ord AS (
  SELECT o.id, o.created_at, o.is_delivery FROM public.orders o
  WHERE o.business_id = _business_id AND o.status IN ('paid','completed') AND o.created_at >= _start AND o.created_at < _end
 ), items AS (
  SELECT oi.menu_item_id, oi.quantity, oi.quantity * oi.unit_price - COALESCE(oi.discount_amount,0) AS revenue,
   oi.quantity * COALESCE(mi.cost,0) AS cost, (COALESCE(mi.cost,0) > 0) AS has_cost, o.created_at
  FROM ord o JOIN public.order_items oi ON oi.order_id = o.id LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
 ), exp AS (
  SELECT e.amount, e.paid_at, COALESCE(c.kind,'variable') AS kind, COALESCE(c.key,'other') AS key,
   COALESCE(c.label,'—') AS label, COALESCE(c.label_en,'—') AS label_en
  FROM public.expense_entries e LEFT JOIN public.budget_categories c ON c.id = e.category_id
  WHERE e.business_id = _business_id AND e.paid_at >= _start AND e.paid_at < _end
 ), months AS (
  SELECT (m AT TIME ZONE v_tz) AS ms, ((m + interval '1 month') AT TIME ZONE v_tz) AS me
  FROM generate_series(date_trunc('month', _start AT TIME ZONE v_tz), date_trunc('month', (_end - interval '1 second') AT TIME ZONE v_tz), interval '1 month') m
 )
 SELECT jsonb_build_object(
  'fetched_at', now(), 'start', _start, 'end', _end, 'timezone', v_tz,
  'first_sale_at', (SELECT min(created_at) FROM public.payments WHERE business_id = _business_id),
  'monthly_fixed_plan', (SELECT COALESCE(sum(monthly),0) FROM rec),
  'fixed_plan_by_key', COALESCE((SELECT jsonb_agg(x) FROM (SELECT key,label,label_en,sum(monthly) amount FROM rec GROUP BY 1,2,3) x),'[]'),
  'gross_sales', (SELECT COALESCE(sum(amount),0) FROM pay),
  'net_revenue', (SELECT COALESCE(sum(net),0) FROM pay),
  'tips', (SELECT COALESCE(sum(tip),0) FROM pay),
  'payment_count', (SELECT count(*) FROM pay),
  'by_method', COALESCE((SELECT jsonb_agg(x) FROM (SELECT payment_method AS method, count(*) n, sum(amount) gross, sum(net) net FROM pay GROUP BY 1) x),'[]'),
  'orders', (SELECT count(*) FROM ord),
  'delivery_orders', (SELECT count(*) FROM ord WHERE is_delivery),
  'items_sold', (SELECT COALESCE(sum(quantity),0) FROM items),
  'item_revenue', (SELECT COALESCE(sum(revenue),0) FROM items),
  'cogs', (SELECT COALESCE(sum(cost),0) FROM items),
  'costed_revenue', (SELECT COALESCE(sum(revenue) FILTER (WHERE has_cost),0) FROM items),
  'fixed_spent', (SELECT COALESCE(sum(amount) FILTER (WHERE kind='fixed'),0) FROM exp),
  'variable_spent', (SELECT COALESCE(sum(amount) FILTER (WHERE kind<>'fixed'),0) FROM exp),
  'spent_by_category', COALESCE((SELECT jsonb_agg(x ORDER BY x.amount DESC) FROM (SELECT key,label,label_en,kind,sum(amount) amount FROM exp GROUP BY 1,2,3,4) x),'[]'),
  'weekday', COALESCE((SELECT jsonb_agg(x ORDER BY x.dow) FROM (SELECT extract(isodow FROM created_at AT TIME ZONE v_tz)::int dow, sum(net) net, count(*) n, count(DISTINCT (created_at AT TIME ZONE v_tz)::date) days FROM pay GROUP BY 1) x),'[]'),
  'active_days', (SELECT count(DISTINCT (created_at AT TIME ZONE v_tz)::date) FROM pay),
  'items', COALESCE((SELECT jsonb_agg(x) FROM (SELECT i.menu_item_id AS id, mi.name, mi.name_en, sum(i.quantity) qty, sum(i.revenue) revenue, sum(i.cost) cost, bool_and(i.has_cost) has_cost
     FROM items i LEFT JOIN public.menu_items mi ON mi.id = i.menu_item_id GROUP BY 1,2,3) x),'[]'),
  'monthly', COALESCE((SELECT jsonb_agg(x ORDER BY x.month) FROM (
     SELECT m.ms AS month,
      (SELECT COALESCE(sum(net),0) FROM pay WHERE created_at >= m.ms AND created_at < m.me) net_revenue,
      (SELECT COALESCE(sum(amount),0) FROM pay WHERE created_at >= m.ms AND created_at < m.me) gross_sales,
      (SELECT COALESCE(sum(cost),0) FROM items WHERE created_at >= m.ms AND created_at < m.me) cogs,
      (SELECT count(*) FROM ord WHERE created_at >= m.ms AND created_at < m.me) orders,
      (SELECT COALESCE(sum(amount) FILTER (WHERE kind='fixed'),0) FROM exp WHERE paid_at >= m.ms AND paid_at < m.me) fixed_spent,
      (SELECT COALESCE(sum(amount) FILTER (WHERE kind<>'fixed'),0) FROM exp WHERE paid_at >= m.ms AND paid_at < m.me) variable_spent
     FROM months m) x),'[]')
 ) INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.performance_report(uuid, timestamptz, timestamptz) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.performance_report(uuid, timestamptz, timestamptz) TO authenticated;