
-- 1) Per-subscription opted-in event types
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS enabled_events text[] NOT NULL
  DEFAULT ARRAY['order_paid','order_cancelled','low_stock','out_of_stock']::text[];

-- 2) Per-item low-stock threshold
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer;

-- 3) Low-stock trigger
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://bspwykvhgqlathaovgbb.supabase.co/functions/v1/send-push-notification';
  threshold integer := COALESCE(NEW.low_stock_threshold, 5);
BEGIN
  IF NEW.inventory_count IS NOT NULL
     AND OLD.inventory_count IS NOT NULL
     AND OLD.inventory_count > threshold
     AND NEW.inventory_count <= threshold
     AND NEW.inventory_count > 0 THEN
    BEGIN
      PERFORM extensions.http_post(
        url := fn_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'type', 'low_stock',
          'business_id', NEW.business_id,
          'data', jsonb_build_object(
            'item_id', NEW.id,
            'item_name', NEW.name,
            'inventory_count', NEW.inventory_count,
            'threshold', threshold
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_low_stock failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.menu_items;
CREATE TRIGGER trg_notify_low_stock
AFTER UPDATE OF inventory_count ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_low_stock();
