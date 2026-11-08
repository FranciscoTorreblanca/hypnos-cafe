CREATE INDEX IF NOT EXISTS idx_order_items_business_item_order ON public.order_items(business_id, menu_item_id, order_id);
CREATE OR REPLACE FUNCTION public.item_sales_report(_business_id uuid, _start timestamptz DEFAULT NULL, _end timestamptz DEFAULT now(), _item_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR _business_id IS DISTINCT FROM public.current_business_id()
 OR NOT (public.is_super_admin() OR (public.is_member_of(_business_id) AND
 (public.is_admin() OR public.has_business_role(auth.uid(), _business_id, 'business_admin') OR public.has_business_role(auth.uid(), _business_id, 'admin')))) THEN
 RAISE EXCEPTION 'Item history access denied' USING ERRCODE = '42501'; END IF;
 IF _end IS NULL OR (_start IS NOT NULL AND _end <= _start) THEN RAISE EXCEPTION 'Invalid range'; END IF;
 WITH sold AS (
 SELECT oi.menu_item_id, oi.order_id, oi.quantity, o.created_at,
 greatest(0, oi.quantity * oi.unit_price * (1 - coalesce(oi.discount,0)/100) - coalesce(oi.discount_amount,0)) revenue
 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
 WHERE oi.business_id = _business_id AND o.business_id = _business_id AND o.status = 'paid'
 AND (_item_id IS NULL OR oi.menu_item_id = _item_id)
 ), selected AS (
 SELECT * FROM sold WHERE (_start IS NULL OR created_at >= _start) AND created_at < _end
 ), stats AS (
 SELECT menu_item_id AS id, min(created_at) first_sale, max(created_at) last_sale FROM sold GROUP BY menu_item_id
 ), totals AS (
 SELECT menu_item_id AS id, sum(quantity) units, sum(revenue) revenue, count(DISTINCT order_id) orders,
 count(DISTINCT (created_at AT TIME ZONE (SELECT timezone FROM public.businesses WHERE id=_business_id))::date) days
 FROM selected GROUP BY menu_item_id
 ), monthly AS (
 SELECT date_trunc('month', created_at AT TIME ZONE (SELECT timezone FROM public.businesses WHERE id=_business_id))::date AS month,
 sum(quantity) units, sum(revenue) revenue FROM selected WHERE _item_id IS NOT NULL GROUP BY 1
 )
 SELECT jsonb_build_object('fetched_at', now(),
 'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'first_sale', s.first_sale, 'last_sale', s.last_sale,
 'units', coalesce(t.units,0), 'revenue', coalesce(t.revenue,0), 'orders', coalesce(t.orders,0), 'days', coalesce(t.days,0)))
 FROM stats s LEFT JOIN totals t ON t.id=s.id), '[]'::jsonb),
 'monthly', coalesce((SELECT jsonb_agg(m ORDER BY m.month) FROM monthly m), '[]'::jsonb)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.item_sales_report(uuid,timestamptz,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.item_sales_report(uuid,timestamptz,timestamptz,uuid) TO authenticated;