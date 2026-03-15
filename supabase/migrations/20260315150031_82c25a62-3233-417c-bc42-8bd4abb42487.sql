
-- Allow anon users to view menu_items (needed for public menu)
CREATE POLICY "Anon can view menu items" ON public.menu_items FOR SELECT TO anon USING (true);

-- Allow anon users to view combos (needed for public menu)
CREATE POLICY "Anon can view combos" ON public.combos FOR SELECT TO anon USING (true);
