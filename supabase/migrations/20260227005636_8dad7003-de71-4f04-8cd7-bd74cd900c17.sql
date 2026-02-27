
-- Menu categories
CREATE TABLE public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view categories" ON public.menu_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert categories" ON public.menu_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update categories" ON public.menu_categories FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete categories" ON public.menu_categories FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON public.menu_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Menu items
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  inventory_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view items" ON public.menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update items" ON public.menu_items FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete items" ON public.menu_items FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Ingredients for cost calculator
CREATE TABLE public.ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view ingredients" ON public.ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert ingredients" ON public.ingredients FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update ingredients" ON public.ingredients FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete ingredients" ON public.ingredients FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Menu item ingredients (junction)
CREATE TABLE public.menu_item_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(10,4) NOT NULL DEFAULT 0,
  UNIQUE(menu_item_id, ingredient_id)
);

ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view item ingredients" ON public.menu_item_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert item ingredients" ON public.menu_item_ingredients FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update item ingredients" ON public.menu_item_ingredients FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete item ingredients" ON public.menu_item_ingredients FOR DELETE TO authenticated USING (public.is_admin());
