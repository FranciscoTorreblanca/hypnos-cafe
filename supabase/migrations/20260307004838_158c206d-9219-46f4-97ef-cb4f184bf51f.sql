
DROP POLICY "Kitchen and admin can update order items" ON public.order_items;

CREATE POLICY "Kitchen waiter and admin can update order items"
ON public.order_items
FOR UPDATE
USING (
  has_role(auth.uid(), 'kitchen'::app_role)
  OR has_role(auth.uid(), 'waiter'::app_role)
  OR is_admin()
);
