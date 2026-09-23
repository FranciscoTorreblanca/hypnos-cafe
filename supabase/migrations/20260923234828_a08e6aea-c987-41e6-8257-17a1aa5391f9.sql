REVOKE EXECUTE ON FUNCTION public.ingredients_on_order_item_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ingredients_on_order_item_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ingredients_on_order_cancel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_ingredient_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restock_ingredient(uuid, numeric, numeric, text) FROM PUBLIC, anon;