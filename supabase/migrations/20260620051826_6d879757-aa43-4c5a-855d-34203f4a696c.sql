ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id ON public.orders(parent_order_id);