ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS stock_qty numeric,
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric;

CREATE TABLE public.ingredient_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  delta numeric NOT NULL,
  kind text NOT NULL,
  packs numeric,
  order_item_id uuid,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ingredient_stock_movements TO authenticated;
GRANT ALL ON public.ingredient_stock_movements TO service_role;
ALTER TABLE public.ingredient_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view ingredient movements" ON public.ingredient_stock_movements
  FOR SELECT TO authenticated USING (public.is_member_of(business_id));
CREATE POLICY "Admins insert ingredient movements" ON public.ingredient_stock_movements
  FOR INSERT TO authenticated WITH CHECK (public.is_member_of(business_id) AND public.is_admin());
CREATE INDEX idx_ing_mov_ing ON public.ingredient_stock_movements(ingredient_id, created_at DESC);

-- Apply recipe usage (with 5% waste) for a menu item, expanding sub-recipes
CREATE OR REPLACE FUNCTION public.apply_ingredient_usage(_menu_item_id uuid, _qty numeric, _kind text, _order_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  sign numeric := CASE WHEN _kind = 'sale' THEN -1 ELSE 1 END;
BEGIN
  FOR r IN
    WITH RECURSIVE tree(item_id, mult, depth) AS (
      SELECT _menu_item_id, _qty::numeric, 0
      UNION ALL
      SELECT mii.source_menu_item_id, t.mult * mii.quantity, t.depth + 1
      FROM tree t JOIN public.menu_item_ingredients mii ON mii.menu_item_id = t.item_id
      WHERE mii.source_menu_item_id IS NOT NULL AND t.depth < 5
    )
    SELECT mii.ingredient_id, SUM(t.mult * mii.quantity * 1.05) AS used
    FROM tree t JOIN public.menu_item_ingredients mii ON mii.menu_item_id = t.item_id
    JOIN public.ingredients i ON i.id = mii.ingredient_id
    WHERE mii.ingredient_id IS NOT NULL AND i.stock_qty IS NOT NULL
    GROUP BY mii.ingredient_id
  LOOP
    UPDATE public.ingredients SET stock_qty = stock_qty + sign * r.used WHERE id = r.ingredient_id;
    INSERT INTO public.ingredient_stock_movements(business_id, ingredient_id, delta, kind, order_item_id)
    SELECT business_id, id, sign * r.used, _kind, _order_item_id FROM public.ingredients WHERE id = r.ingredient_id;
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION public.apply_ingredient_usage(uuid, numeric, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ingredients_on_order_item_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.apply_ingredient_usage(NEW.menu_item_id, NEW.quantity, 'sale', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ingredient usage failed: %', SQLERRM; RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.ingredients_on_order_item_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = OLD.order_id AND status = 'cancelled') THEN
    PERFORM public.apply_ingredient_usage(OLD.menu_item_id, OLD.quantity, 'return', OLD.id);
  END IF;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ingredient restore failed: %', SQLERRM; RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.ingredients_on_order_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oi record;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    FOR oi IN SELECT id, menu_item_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      PERFORM public.apply_ingredient_usage(oi.menu_item_id, oi.quantity, 'cancel', oi.id);
    END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ingredient cancel restore failed: %', SQLERRM; RETURN NEW;
END; $$;

CREATE TRIGGER trg_ingredients_on_order_item_insert AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.ingredients_on_order_item_insert();
CREATE TRIGGER trg_ingredients_on_order_item_delete AFTER DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.ingredients_on_order_item_delete();
CREATE TRIGGER trg_ingredients_on_order_cancel AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.ingredients_on_order_cancel();

-- Restock by packs (presentation) or raw quantity
CREATE OR REPLACE FUNCTION public.restock_ingredient(_ingredient_id uuid, _packs numeric, _qty numeric, _note text DEFAULT '')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ing public.ingredients; add_qty numeric;
BEGIN
  SELECT * INTO ing FROM public.ingredients WHERE id = _ingredient_id;
  IF ing.id IS NULL OR NOT public.is_member_of(ing.business_id) OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  add_qty := COALESCE(_packs, 0) * COALESCE(ing.presentation_qty, 0) + COALESCE(_qty, 0);
  UPDATE public.ingredients SET stock_qty = COALESCE(stock_qty, 0) + add_qty WHERE id = ing.id;
  INSERT INTO public.ingredient_stock_movements(business_id, ingredient_id, delta, kind, packs, note, created_by)
  VALUES (ing.business_id, ing.id, add_qty, 'restock', _packs, COALESCE(_note, ''), auth.uid());
  RETURN COALESCE(ing.stock_qty, 0) + add_qty;
END; $$;
GRANT EXECUTE ON FUNCTION public.restock_ingredient(uuid, numeric, numeric, text) TO authenticated;

-- Low / out of stock notifications for ingredients
CREATE OR REPLACE FUNCTION public.notify_ingredient_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fn_url text := 'https://bspwykvhgqlathaovgbb.supabase.co/functions/v1/send-push-notification';
  thr numeric := COALESCE(NEW.low_stock_threshold, NEW.presentation_qty, 0);
  evt text := NULL;
BEGIN
  IF NEW.stock_qty IS NULL OR OLD.stock_qty IS NULL OR NEW.stock_qty >= OLD.stock_qty THEN RETURN NEW; END IF;
  IF OLD.stock_qty > 0 AND NEW.stock_qty <= 0 THEN evt := 'out_of_stock';
  ELSIF thr > 0 AND OLD.stock_qty > thr AND NEW.stock_qty <= thr THEN evt := 'low_stock';
  END IF;
  IF evt IS NOT NULL THEN
    BEGIN
      PERFORM extensions.http_post(
        url := fn_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object('type', evt, 'business_id', NEW.business_id,
          'data', jsonb_build_object('item_id', NEW.id, 'item_name', NEW.name, 'kind', 'ingredient',
            'unit', NEW.unit, 'inventory_count', round(NEW.stock_qty, 2), 'threshold', round(thr, 2))));
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'notify_ingredient_stock failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_ingredient_stock AFTER UPDATE OF stock_qty ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.notify_ingredient_stock();