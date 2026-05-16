CREATE OR REPLACE FUNCTION public.notify_out_of_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://bspwykvhgqlathaovgbb.supabase.co/functions/v1/send-push-notification';
BEGIN
  IF NEW.inventory_count IS NOT NULL
     AND OLD.inventory_count IS NOT NULL
     AND OLD.inventory_count > 0
     AND NEW.inventory_count <= 0 THEN
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      -- Never block inventory updates if the push notification fails
      RAISE WARNING 'notify_out_of_stock failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;