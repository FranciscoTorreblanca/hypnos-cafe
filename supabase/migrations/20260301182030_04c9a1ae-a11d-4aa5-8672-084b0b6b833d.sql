
-- Add new order statuses for full flow
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'served';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'paid';

-- Create payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  amount numeric NOT NULL DEFAULT 0,
  tip numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payments"
  ON public.payments FOR SELECT USING (true);

CREATE POLICY "Staff can insert payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE USING (is_admin());
