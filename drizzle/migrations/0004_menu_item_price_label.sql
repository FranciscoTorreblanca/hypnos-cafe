ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS price_label text;
COMMENT ON COLUMN public.menu_items.price_label IS 'Optional label for the main price (e.g. Pinta). Extra labelled prices live in menu_item_presentations.';
UPDATE public.menu_items mi SET price_label = p.label
FROM public.menu_item_presentations p
WHERE p.menu_item_id = mi.id AND p.display_order = 0 AND p.price = mi.price
  AND p.promo_price IS NOT DISTINCT FROM mi.promo_price AND mi.price_label IS NULL;