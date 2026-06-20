
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_endpoint_business_key UNIQUE (user_id, endpoint, business_id);

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
          'business_id', NEW.business_id,
          'data', jsonb_build_object(
            'item_id', NEW.id,
            'item_name', NEW.name
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_out_of_stock failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;
