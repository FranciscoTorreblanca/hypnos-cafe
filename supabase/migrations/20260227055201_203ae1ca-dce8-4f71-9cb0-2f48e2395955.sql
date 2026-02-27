
-- Tighten order update: only creator or admin can update
DROP POLICY "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR is_admin());

-- Tighten order_items: only if user created the parent order or is admin
DROP POLICY "Staff can insert order items" ON public.order_items;
CREATE POLICY "Staff can insert order items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (created_by = auth.uid() OR is_admin())));

DROP POLICY "Staff can update order items" ON public.order_items;
CREATE POLICY "Staff can update order items" ON public.order_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (created_by = auth.uid() OR is_admin())));

DROP POLICY "Staff can delete order items" ON public.order_items;
CREATE POLICY "Staff can delete order items" ON public.order_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (created_by = auth.uid() OR is_admin())));
