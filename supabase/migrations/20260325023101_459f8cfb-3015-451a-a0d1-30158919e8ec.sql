
-- Trigger function: auto-insert till_transaction for cash payments
CREATE OR REPLACE FUNCTION public.auto_till_on_cash_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.payment_method = 'cash' THEN
    INSERT INTO public.till_transactions (type, amount, note, payment_id, created_by)
    VALUES ('payment', NEW.amount + NEW.tip, '', NEW.id, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to payments table
CREATE TRIGGER trg_auto_till_cash_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_till_on_cash_payment();

-- Backfill missing cash payments into till
INSERT INTO public.till_transactions (type, amount, note, payment_id, created_by)
SELECT 'payment', p.amount + p.tip, '', p.id, p.created_by
FROM public.payments p
WHERE p.payment_method = 'cash'
  AND NOT EXISTS (
    SELECT 1 FROM public.till_transactions t WHERE t.payment_id = p.id
  );
