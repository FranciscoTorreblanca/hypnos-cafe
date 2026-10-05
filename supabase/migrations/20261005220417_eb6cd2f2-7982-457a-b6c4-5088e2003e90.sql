ALTER TABLE public.till_transactions
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.budget_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'till';
ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS till_transaction_id uuid REFERENCES public.till_transactions(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS expense_entries_till_tx_uniq ON public.expense_entries(till_transaction_id) WHERE till_transaction_id IS NOT NULL;

-- Till -> Budget
CREATE OR REPLACE FUNCTION public.sync_till_tx_to_budget()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _signed numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.balance_adjustments WHERE till_transaction_id = OLD.id;
    DELETE FROM public.expense_entries WHERE till_transaction_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Movements created from Budget already have their budget row.
  IF NEW.origin = 'budget' THEN RETURN NEW; END IF;

  IF NEW.type NOT IN ('adjustment_in', 'adjustment_out') THEN
    DELETE FROM public.balance_adjustments WHERE till_transaction_id = NEW.id;
    DELETE FROM public.expense_entries WHERE till_transaction_id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.type = 'adjustment_out' AND NEW.category_id IS NOT NULL THEN
    DELETE FROM public.balance_adjustments WHERE till_transaction_id = NEW.id;
    INSERT INTO public.expense_entries (category_id, amount, payment_source, paid_at, note, created_by, business_id, till_transaction_id)
    VALUES (NEW.category_id, abs(NEW.amount), 'cash', NEW.created_at, COALESCE(NEW.note, ''), NEW.created_by, NEW.business_id, NEW.id)
    ON CONFLICT (till_transaction_id) WHERE till_transaction_id IS NOT NULL
    DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note, category_id = EXCLUDED.category_id;
    RETURN NEW;
  END IF;

  DELETE FROM public.expense_entries WHERE till_transaction_id = NEW.id;
  _signed := CASE WHEN NEW.type = 'adjustment_out' THEN -abs(NEW.amount) ELSE abs(NEW.amount) END;
  INSERT INTO public.balance_adjustments (source, amount, kind, note, created_by, business_id, till_transaction_id)
  VALUES ('cash', _signed, 'till', COALESCE(NULLIF(NEW.note, ''), 'Till'), NEW.created_by, NEW.business_id, NEW.id)
  ON CONFLICT (till_transaction_id) WHERE till_transaction_id IS NOT NULL
  DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note, business_id = EXCLUDED.business_id;
  RETURN NEW;
END $$;

-- Budget cash expense -> Till
CREATE OR REPLACE FUNCTION public.expense_cash_to_till()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NEW.payment_source = 'cash' AND NEW.till_transaction_id IS NULL THEN
    INSERT INTO public.till_transactions (type, amount, note, created_by, business_id, category_id, origin)
    VALUES ('adjustment_out', abs(NEW.amount), COALESCE(NULLIF(NEW.note,''), 'Presupuesto'), NEW.created_by, NEW.business_id, NEW.category_id, 'budget')
    RETURNING id INTO _id;
    NEW.till_transaction_id := _id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expense_cash_to_till BEFORE INSERT ON public.expense_entries
FOR EACH ROW EXECUTE FUNCTION public.expense_cash_to_till();

-- Budget cash adjustment -> Till
CREATE OR REPLACE FUNCTION public.adjustment_cash_to_till()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NEW.source = 'cash' AND NEW.till_transaction_id IS NULL AND NEW.kind NOT IN ('till','reconcile') AND NEW.amount <> 0 THEN
    INSERT INTO public.till_transactions (type, amount, note, created_by, business_id, origin)
    VALUES (CASE WHEN NEW.amount < 0 THEN 'adjustment_out' ELSE 'adjustment_in' END, abs(NEW.amount),
            COALESCE(NULLIF(NEW.note,''), 'Presupuesto'), NEW.created_by, NEW.business_id, 'budget')
    RETURNING id INTO _id;
    NEW.till_transaction_id := _id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER adjustment_cash_to_till BEFORE INSERT ON public.balance_adjustments
FOR EACH ROW EXECUTE FUNCTION public.adjustment_cash_to_till();

-- Deleting the budget side removes its till movement
CREATE OR REPLACE FUNCTION public.budget_row_delete_till()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.till_transaction_id IS NOT NULL THEN
    DELETE FROM public.till_transactions WHERE id = OLD.till_transaction_id AND origin = 'budget';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER expense_delete_till AFTER DELETE ON public.expense_entries
FOR EACH ROW EXECUTE FUNCTION public.budget_row_delete_till();
CREATE TRIGGER adjustment_delete_till AFTER DELETE ON public.balance_adjustments
FOR EACH ROW EXECUTE FUNCTION public.budget_row_delete_till();

REVOKE EXECUTE ON FUNCTION public.expense_cash_to_till(), public.adjustment_cash_to_till(), public.budget_row_delete_till() FROM PUBLIC, anon, authenticated;