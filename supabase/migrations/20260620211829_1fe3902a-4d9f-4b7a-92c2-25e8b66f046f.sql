
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS requires_kitchen boolean NOT NULL DEFAULT true;

-- When an order_item is inserted for a menu_item that doesn't require kitchen prep,
-- auto-mark it as ready immediately so it skips the kitchen queue but still
-- appears in the waiter's "to serve" flow.
CREATE OR REPLACE FUNCTION public.auto_ready_no_kitchen_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  needs_kitchen boolean;
BEGIN
  IF NEW.menu_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT requires_kitchen INTO needs_kitchen
  FROM public.menu_items WHERE id = NEW.menu_item_id;
  IF needs_kitchen IS FALSE AND (NEW.status IS NULL OR NEW.status = 'pending') THEN
    NEW.status := 'ready';
    IF NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
    IF NEW.ready_at IS NULL THEN NEW.ready_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_ready_no_kitchen_item ON public.order_items;
CREATE TRIGGER trg_auto_ready_no_kitchen_item
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.auto_ready_no_kitchen_item();
