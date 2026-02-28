
-- Allow menu items to be used as sub-recipe ingredients
ALTER TABLE public.menu_item_ingredients
  ADD COLUMN source_menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE;

-- Make ingredient_id nullable (either ingredient or menu item, not both)
ALTER TABLE public.menu_item_ingredients
  ALTER COLUMN ingredient_id DROP NOT NULL;

-- Ensure exactly one source is set
ALTER TABLE public.menu_item_ingredients
  ADD CONSTRAINT chk_one_source CHECK (
    (ingredient_id IS NOT NULL AND source_menu_item_id IS NULL) OR
    (ingredient_id IS NULL AND source_menu_item_id IS NOT NULL)
  );
