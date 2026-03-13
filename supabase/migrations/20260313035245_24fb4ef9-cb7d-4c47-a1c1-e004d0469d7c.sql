
CREATE TABLE public.till_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'payment',
  amount numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.till_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view till transactions" ON public.till_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert till transactions" ON public.till_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update till transactions" ON public.till_transactions
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "Admins can delete till transactions" ON public.till_transactions
  FOR DELETE TO authenticated USING (is_admin());
