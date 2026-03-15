
-- Menu type enum
CREATE TYPE public.menu_type AS ENUM ('main', 'seasonal', 'event');
CREATE TYPE public.menu_status AS ENUM ('draft', 'published', 'archived');

-- Menus table
CREATE TABLE public.menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  type menu_type NOT NULL DEFAULT 'main',
  status menu_status NOT NULL DEFAULT 'draft',
  is_online BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  parent_menu_id UUID REFERENCES public.menus(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Menu entries (items or combos in a menu)
CREATE TABLE public.menu_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
  combo_id UUID REFERENCES public.combos(id) ON DELETE CASCADE,
  section_label TEXT NOT NULL DEFAULT '',
  section_label_en TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entry_has_item_or_combo CHECK (
    (menu_item_id IS NOT NULL AND combo_id IS NULL) OR
    (menu_item_id IS NULL AND combo_id IS NOT NULL)
  )
);

-- RLS
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_entries ENABLE ROW LEVEL SECURITY;

-- Menus policies
CREATE POLICY "Anyone authenticated can view menus" ON public.menus FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert menus" ON public.menus FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update menus" ON public.menus FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete menus" ON public.menus FOR DELETE TO authenticated USING (is_admin());

-- Menu entries policies
CREATE POLICY "Anyone authenticated can view menu entries" ON public.menu_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert menu entries" ON public.menu_entries FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update menu entries" ON public.menu_entries FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete menu entries" ON public.menu_entries FOR DELETE TO authenticated USING (is_admin());

-- Public access for online menus (no auth required)
CREATE POLICY "Anyone can view published online menus" ON public.menus FOR SELECT TO anon USING (is_online = true AND status = 'published');
CREATE POLICY "Anyone can view entries of published online menus" ON public.menu_entries FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.menus WHERE menus.id = menu_entries.menu_id AND menus.is_online = true AND menus.status = 'published')
);

-- Updated_at trigger
CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION update_updated_at();
