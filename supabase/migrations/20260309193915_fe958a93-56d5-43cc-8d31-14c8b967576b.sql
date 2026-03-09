
-- Create combos table
CREATE TABLE public.combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create combo_items junction table
CREATE TABLE public.combo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1
);

-- Enable RLS
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;

-- RLS for combos
CREATE POLICY "Anyone authenticated can view combos" ON public.combos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert combos" ON public.combos FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update combos" ON public.combos FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete combos" ON public.combos FOR DELETE TO authenticated USING (is_admin());

-- RLS for combo_items
CREATE POLICY "Anyone authenticated can view combo items" ON public.combo_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert combo items" ON public.combo_items FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update combo items" ON public.combo_items FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete combo items" ON public.combo_items FOR DELETE TO authenticated USING (is_admin());

-- Updated_at trigger for combos
CREATE TRIGGER update_combos_updated_at BEFORE UPDATE ON public.combos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
