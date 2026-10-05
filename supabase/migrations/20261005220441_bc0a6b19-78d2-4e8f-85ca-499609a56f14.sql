CREATE OR REPLACE FUNCTION public.budget_row_delete_till()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.till_transaction_id IS NOT NULL THEN
    DELETE FROM public.till_transactions WHERE id = OLD.till_transaction_id;
  END IF;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.budget_row_delete_till() FROM PUBLIC, anon, authenticated;