ALTER TABLE public.balance_adjustments
  ADD COLUMN IF NOT EXISTS till_transaction_id uuid REFERENCES public.till_transactions(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS balance_adjustments_till_tx_uidx
  ON public.balance_adjustments(till_transaction_id)
  WHERE till_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_till_tx_to_budget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _signed numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.balance_adjustments WHERE till_transaction_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Only manual cash in/out movements are mirrored; order payments already
  -- reach the Budget through the payments table.
  IF NEW.type NOT IN ('adjustment_in', 'adjustment_out') THEN
    DELETE FROM public.balance_adjustments WHERE till_transaction_id = NEW.id;
    RETURN NEW;
  END IF;

  _signed := CASE WHEN NEW.type = 'adjustment_out' THEN -abs(NEW.amount) ELSE abs(NEW.amount) END;

  INSERT INTO public.balance_adjustments (source, amount, kind, note, created_by, business_id, till_transaction_id)
  VALUES ('cash', _signed, 'till', COALESCE(NULLIF(NEW.note, ''), 'Till'), NEW.created_by, NEW.business_id, NEW.id)
  ON CONFLICT (till_transaction_id) WHERE till_transaction_id IS NOT NULL
  DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note, business_id = EXCLUDED.business_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS till_tx_budget_sync ON public.till_transactions;
CREATE TRIGGER till_tx_budget_sync
AFTER INSERT OR UPDATE OR DELETE ON public.till_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_till_tx_to_budget();

INSERT INTO public.balance_adjustments (source, amount, kind, note, created_by, business_id, till_transaction_id)
SELECT 'cash',
       CASE WHEN t.type = 'adjustment_out' THEN -abs(t.amount) ELSE abs(t.amount) END,
       'till',
       COALESCE(NULLIF(t.note, ''), 'Till'),
       t.created_by,
       t.business_id,
       t.id
FROM public.till_transactions t
WHERE t.type IN ('adjustment_in', 'adjustment_out')
ON CONFLICT DO NOTHING;