CREATE TABLE public.supplier_debts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  issued_at date NOT NULL DEFAULT current_date,
  due_date date,
  payment_source text NOT NULL DEFAULT 'cash',
  notes text NOT NULL DEFAULT '',
  is_settled boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_debts TO authenticated;
GRANT ALL ON public.supplier_debts TO service_role;

ALTER TABLE public.supplier_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view debts" ON public.supplier_debts
FOR SELECT TO authenticated USING (public.is_member_of(business_id) OR public.is_super_admin());

CREATE POLICY "Members can insert debts" ON public.supplier_debts
FOR INSERT TO authenticated WITH CHECK (public.is_member_of(business_id) OR public.is_super_admin());

CREATE POLICY "Members can update debts" ON public.supplier_debts
FOR UPDATE TO authenticated USING (public.is_member_of(business_id) OR public.is_super_admin())
WITH CHECK (public.is_member_of(business_id) OR public.is_super_admin());

CREATE POLICY "Members can delete debts" ON public.supplier_debts
FOR DELETE TO authenticated USING (public.is_member_of(business_id) OR public.is_super_admin());

CREATE INDEX idx_supplier_debts_business ON public.supplier_debts(business_id, is_settled, due_date);

CREATE TRIGGER supplier_debts_updated_at
BEFORE UPDATE ON public.supplier_debts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();