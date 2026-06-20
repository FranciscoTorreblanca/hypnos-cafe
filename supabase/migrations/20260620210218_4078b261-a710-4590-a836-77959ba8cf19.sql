
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cooking_time_seconds integer,
  ADD COLUMN IF NOT EXISTS cooking_warning_seconds integer NOT NULL DEFAULT 60;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_order_item_cooking_times()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('in_progress','ready','completed','served','paid') AND NEW.started_at IS NULL THEN
      NEW.started_at := now();
    END IF;
    IF NEW.status IN ('ready','completed','served','paid') AND NEW.ready_at IS NULL THEN
      NEW.ready_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_order_item_cooking_times ON public.order_items;
CREATE TRIGGER trg_stamp_order_item_cooking_times
BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.stamp_order_item_cooking_times();
