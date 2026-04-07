
ALTER TABLE public.order_items
  ADD COLUMN combo_id uuid REFERENCES public.combos(id) ON DELETE SET NULL,
  ADD COLUMN combo_group_id uuid;
