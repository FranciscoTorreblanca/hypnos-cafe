
-- Add status to order_items for per-item kitchen tracking
ALTER TABLE public.order_items ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- Allow kitchen staff to update order items (mark individual items ready)
CREATE POLICY "Kitchen and admin can update order items"
ON public.order_items
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'kitchen') OR public.is_admin()
);
