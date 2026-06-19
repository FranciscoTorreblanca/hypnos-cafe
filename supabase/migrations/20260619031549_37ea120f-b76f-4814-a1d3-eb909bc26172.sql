
-- 1. Feature flag
ALTER TABLE public.business_features
  ADD COLUMN IF NOT EXISTS cash_closing boolean NOT NULL DEFAULT false;

-- 2. till_sessions table
CREATE TABLE IF NOT EXISTS public.till_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_float numeric NOT NULL DEFAULT 0,
  opening_notes text,
  closed_by uuid,
  closed_at timestamptz,
  closing_counted numeric,
  closing_expected numeric,
  closing_difference numeric,
  closing_denominations jsonb,
  closing_notes text,
  z_report jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS till_sessions_one_open_per_business
  ON public.till_sessions(business_id) WHERE status = 'open';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.till_sessions TO authenticated;
GRANT ALL ON public.till_sessions TO service_role;

ALTER TABLE public.till_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY till_sessions_select ON public.till_sessions
  FOR SELECT TO authenticated
  USING (public.is_member_of(business_id));

CREATE POLICY till_sessions_modify ON public.till_sessions
  FOR ALL TO authenticated
  USING (public.is_member_of(business_id) AND (
    public.has_business_role(auth.uid(), business_id, 'admin')
    OR public.has_business_role(auth.uid(), business_id, 'billing')
  ))
  WITH CHECK (public.is_member_of(business_id) AND (
    public.has_business_role(auth.uid(), business_id, 'admin')
    OR public.has_business_role(auth.uid(), business_id, 'billing')
  ));

CREATE TRIGGER till_sessions_updated_at
  BEFORE UPDATE ON public.till_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Link till_transactions to a session
ALTER TABLE public.till_transactions
  ADD COLUMN IF NOT EXISTS till_session_id uuid REFERENCES public.till_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS till_transactions_session_idx
  ON public.till_transactions(till_session_id);

-- 4. Trigger: auto-attach incoming till transactions to the open session
CREATE OR REPLACE FUNCTION public.attach_till_transaction_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.till_session_id IS NULL THEN
    SELECT id INTO NEW.till_session_id
    FROM public.till_sessions
    WHERE business_id = NEW.business_id AND status = 'open'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attach_till_transaction_to_session_trg ON public.till_transactions;
CREATE TRIGGER attach_till_transaction_to_session_trg
  BEFORE INSERT ON public.till_transactions
  FOR EACH ROW EXECUTE FUNCTION public.attach_till_transaction_to_session();

-- 5. Helper: signed amount per transaction type
CREATE OR REPLACE FUNCTION public.till_tx_signed(_type text, _amount numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN _type = 'adjustment_out' THEN -_amount ELSE _amount END;
$$;

-- 6. Open till session
CREATE OR REPLACE FUNCTION public.open_till_session(_opening_float numeric, _notes text DEFAULT NULL)
RETURNS public.till_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  biz uuid := public.current_business_id();
  row public.till_sessions;
BEGIN
  IF biz IS NULL THEN RAISE EXCEPTION 'no_business'; END IF;
  IF NOT (public.has_business_role(auth.uid(), biz, 'admin')
          OR public.has_business_role(auth.uid(), biz, 'billing')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.till_sessions WHERE business_id = biz AND status = 'open') THEN
    RAISE EXCEPTION 'session_already_open';
  END IF;

  INSERT INTO public.till_sessions(business_id, opened_by, opening_float, opening_notes)
  VALUES (biz, auth.uid(), COALESCE(_opening_float, 0), _notes)
  RETURNING * INTO row;
  RETURN row;
END;
$$;

-- 7. X report (live snapshot of an open session)
CREATE OR REPLACE FUNCTION public.till_x_report(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.till_sessions;
  payments_sum numeric := 0;
  cash_in numeric := 0;
  cash_out numeric := 0;
  tx_count integer := 0;
  payments_breakdown jsonb;
  expected numeric;
BEGIN
  SELECT * INTO s FROM public.till_sessions WHERE id = _session_id;
  IF s.id IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF NOT public.is_member_of(s.business_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE type = 'payment'), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'adjustment_in'), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'adjustment_out'), 0),
    COUNT(*)
  INTO payments_sum, cash_in, cash_out, tx_count
  FROM public.till_transactions
  WHERE till_session_id = s.id;

  -- Per payment-method breakdown for ALL payments created during the session window
  SELECT COALESCE(jsonb_object_agg(payment_method, totals), '{}'::jsonb)
  INTO payments_breakdown
  FROM (
    SELECT p.payment_method,
           jsonb_build_object(
             'count', COUNT(*),
             'amount', COALESCE(SUM(p.amount), 0),
             'tip', COALESCE(SUM(p.tip), 0)
           ) AS totals
    FROM public.payments p
    WHERE p.business_id = s.business_id
      AND p.created_at >= s.opened_at
      AND (s.closed_at IS NULL OR p.created_at <= s.closed_at)
    GROUP BY p.payment_method
  ) q;

  expected := s.opening_float + payments_sum + cash_in - cash_out;

  RETURN jsonb_build_object(
    'session_id', s.id,
    'business_id', s.business_id,
    'status', s.status,
    'opened_at', s.opened_at,
    'opened_by', s.opened_by,
    'opening_float', s.opening_float,
    'closed_at', s.closed_at,
    'cash_payments_total', payments_sum,
    'cash_in_total', cash_in,
    'cash_out_total', cash_out,
    'transactions_count', tx_count,
    'expected_cash', expected,
    'payments_breakdown', payments_breakdown,
    'generated_at', now()
  );
END;
$$;

-- 8. Close till session (Z report)
CREATE OR REPLACE FUNCTION public.close_till_session(
  _session_id uuid,
  _counted numeric,
  _denominations jsonb DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS public.till_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.till_sessions;
  report jsonb;
  expected numeric;
  diff numeric;
BEGIN
  SELECT * INTO s FROM public.till_sessions WHERE id = _session_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF NOT (public.has_business_role(auth.uid(), s.business_id, 'admin')
          OR public.has_business_role(auth.uid(), s.business_id, 'billing')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF s.status <> 'open' THEN RAISE EXCEPTION 'session_not_open'; END IF;

  report := public.till_x_report(_session_id);
  expected := (report->>'expected_cash')::numeric;
  diff := COALESCE(_counted, 0) - expected;

  UPDATE public.till_sessions SET
    status = 'closed',
    closed_by = auth.uid(),
    closed_at = now(),
    closing_counted = COALESCE(_counted, 0),
    closing_expected = expected,
    closing_difference = diff,
    closing_denominations = _denominations,
    closing_notes = _notes,
    z_report = report || jsonb_build_object(
      'counted', COALESCE(_counted, 0),
      'difference', diff,
      'denominations', _denominations,
      'closed_at', now()
    )
  WHERE id = _session_id
  RETURNING * INTO s;

  RETURN s;
END;
$$;

-- 9. Current open session for the active business
CREATE OR REPLACE FUNCTION public.current_till_session()
RETURNS public.till_sessions
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.till_sessions
  WHERE business_id = public.current_business_id() AND status = 'open'
  LIMIT 1;
$$;

-- 10. Backfill: leave existing till_transactions with NULL session_id (historical).
