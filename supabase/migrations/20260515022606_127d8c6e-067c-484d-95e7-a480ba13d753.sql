-- Ensure pg_net is enabled for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_out_of_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text := 'https://bspwykvhgqlathaovgbb.supabase.co/functions/v1/send-push-notification';
BEGIN
  -- Only fire when inventory crossed from > 0 down to <= 0
  IF NEW.inventory_count IS NOT NULL
     AND OLD.inventory_count IS NOT NULL
     AND OLD.inventory_count > 0
     AND NEW.inventory_count <= 0 THEN
    PERFORM extensions.http_post(
      url := fn_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'type', 'out_of_stock',
        'data', jsonb_build_object(
          'item_id', NEW.id,
          'item_name', NEW.name
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_out_of_stock ON public.menu_items;
CREATE TRIGGER trg_notify_out_of_stock
AFTER UPDATE OF inventory_count ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_out_of_stock();