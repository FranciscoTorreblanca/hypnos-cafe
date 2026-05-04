CREATE TABLE public.menu_item_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_menu_item_skus_item ON public.menu_item_skus(menu_item_id);
CREATE INDEX idx_menu_item_skus_code ON public.menu_item_skus(code);

ALTER TABLE public.menu_item_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view skus"
  ON public.menu_item_skus FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can delete skus"
  ON public.menu_item_skus FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "Admins can update skus"
  ON public.menu_item_skus FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "Staff can insert skus"
  ON public.menu_item_skus FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR has_role(auth.uid(), 'waiter') OR has_role(auth.uid(), 'kitchen'));