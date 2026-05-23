
-- Categories
CREATE TABLE public.budget_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  label_en text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'fixed',
  color text NOT NULL DEFAULT '#6366f1',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can view budget categories" ON public.budget_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage budget categories - insert" ON public.budget_categories
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins manage budget categories - update" ON public.budget_categories
  FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins manage budget categories - delete" ON public.budget_categories
  FOR DELETE TO authenticated USING (is_admin());

-- Recurring expenses (fixed spends with frequency)
CREATE TABLE public.recurring_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid REFERENCES public.budget_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',
  next_due_date date,
  payment_source text NOT NULL DEFAULT 'card',
  is_active boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can view recurring expenses" ON public.recurring_expenses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage recurring - insert" ON public.recurring_expenses
  FOR INSERT TO authenticated WITH CHECK (is_admin() AND created_by = auth.uid());
CREATE POLICY "Admins manage recurring - update" ON public.recurring_expenses
  FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins manage recurring - delete" ON public.recurring_expenses
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER update_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Expense entries (the actual ledger)
CREATE TABLE public.expense_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid REFERENCES public.budget_categories(id) ON DELETE SET NULL,
  recurring_id uuid REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_source text NOT NULL DEFAULT 'card',
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can view expense entries" ON public.expense_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage expenses - insert" ON public.expense_entries
  FOR INSERT TO authenticated WITH CHECK (is_admin() AND created_by = auth.uid());
CREATE POLICY "Admins manage expenses - update" ON public.expense_entries
  FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins manage expenses - delete" ON public.expense_entries
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX idx_expense_entries_paid_at ON public.expense_entries (paid_at DESC);
CREATE INDEX idx_expense_entries_category ON public.expense_entries (category_id);

-- Balance adjustments (manual corrections to cash/card available money)
CREATE TABLE public.balance_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'cash',
  amount numeric NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'adjustment',
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can view balance adjustments" ON public.balance_adjustments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage balance - insert" ON public.balance_adjustments
  FOR INSERT TO authenticated WITH CHECK (is_admin() AND created_by = auth.uid());
CREATE POLICY "Admins manage balance - update" ON public.balance_adjustments
  FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins manage balance - delete" ON public.balance_adjustments
  FOR DELETE TO authenticated USING (is_admin());

-- Seed default categories
INSERT INTO public.budget_categories (key, label, label_en, color, display_order, kind) VALUES
  ('rent',         'Renta',           'Rent',                  '#ef4444', 1,  'fixed'),
  ('utilities',    'Luz',             'Utilities',             '#f59e0b', 2,  'fixed'),
  ('gas',          'Gas',             'Gas',                   '#f97316', 3,  'fixed'),
  ('payroll',      'Colaboradores',   'Payroll',               '#8b5cf6', 4,  'fixed'),
  ('internet',     'Internet',        'Internet',              '#06b6d4', 5,  'fixed'),
  ('insurance',    'Seguros',         'Insurance',             '#10b981', 6,  'fixed'),
  ('maintenance',  'Mantenimiento',   'Maintenance',           '#84cc16', 7,  'fixed'),
  ('subscriptions','Suscripciones',   'Software/Subscriptions','#a855f7', 8,  'fixed'),
  ('bank_fees',    'Comisiones',      'Bank fees',             '#64748b', 9,  'fixed'),
  ('supplies',     'Insumos',         'Supplies',              '#22c55e', 10, 'variable'),
  ('other',        'Otros',           'Other',                 '#94a3b8', 99, 'variable');
