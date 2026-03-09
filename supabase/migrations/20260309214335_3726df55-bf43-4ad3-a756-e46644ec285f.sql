
-- Choice groups: each combo can have multiple "slots" where customer picks an option
CREATE TABLE public.combo_choice_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  label text NOT NULL,
  label_en text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0
);

-- Options within each choice group
CREATE TABLE public.combo_choice_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  choice_group_id uuid NOT NULL REFERENCES public.combo_choice_groups(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE
);

-- RLS for combo_choice_groups
ALTER TABLE public.combo_choice_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view choice groups" ON public.combo_choice_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert choice groups" ON public.combo_choice_groups
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update choice groups" ON public.combo_choice_groups
  FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete choice groups" ON public.combo_choice_groups
  FOR DELETE TO authenticated USING (is_admin());

-- RLS for combo_choice_options
ALTER TABLE public.combo_choice_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view choice options" ON public.combo_choice_options
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert choice options" ON public.combo_choice_options
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update choice options" ON public.combo_choice_options
  FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete choice options" ON public.combo_choice_options
  FOR DELETE TO authenticated USING (is_admin());
