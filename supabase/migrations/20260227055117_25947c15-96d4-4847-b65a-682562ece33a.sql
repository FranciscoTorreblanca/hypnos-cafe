
-- Order status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number INTEGER NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order items
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Timestamps trigger
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Orders: all authenticated can view, waiters/admin can insert/update
CREATE POLICY "Authenticated can view orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO authenticated USING (is_admin());

-- Order items: all authenticated can view, staff can manage
CREATE POLICY "Authenticated can view order items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update order items" ON public.order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete order items" ON public.order_items FOR DELETE TO authenticated USING (true);
