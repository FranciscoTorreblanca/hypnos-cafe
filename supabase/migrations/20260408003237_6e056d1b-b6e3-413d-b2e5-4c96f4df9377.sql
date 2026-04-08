
-- Function to deduct stock when order item is inserted
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.menu_items
  SET inventory_count = inventory_count - NEW.quantity
  WHERE id = NEW.menu_item_id
    AND inventory_count IS NOT NULL;
  RETURN NEW;
END;
$$;

-- Function to restore stock when order item is deleted
CREATE OR REPLACE FUNCTION public.restore_inventory_on_order_item_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.menu_items
  SET inventory_count = inventory_count + OLD.quantity
  WHERE id = OLD.menu_item_id
    AND inventory_count IS NOT NULL;
  RETURN OLD;
END;
$$;

-- Function to restore stock when order is cancelled
CREATE OR REPLACE FUNCTION public.restore_inventory_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE public.menu_items mi
    SET inventory_count = mi.inventory_count + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND mi.id = oi.menu_item_id
      AND mi.inventory_count IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: deduct on insert
CREATE TRIGGER trg_deduct_inventory_on_order_item_insert
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_on_order_item_insert();

-- Trigger: restore on delete
CREATE TRIGGER trg_restore_inventory_on_order_item_delete
AFTER DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.restore_inventory_on_order_item_delete();

-- Trigger: restore on order cancel
CREATE TRIGGER trg_restore_inventory_on_order_cancel
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_inventory_on_order_cancel();
