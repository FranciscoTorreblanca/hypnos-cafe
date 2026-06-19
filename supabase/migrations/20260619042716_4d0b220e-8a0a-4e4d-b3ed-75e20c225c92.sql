
-- open_till_session: accept optional client-generated id
CREATE OR REPLACE FUNCTION public.open_till_session(_opening_float numeric, _notes text DEFAULT NULL::text, _id uuid DEFAULT NULL)
 RETURNS till_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  biz uuid := public.current_business_id();
  row public.till_sessions;
  new_id uuid := COALESCE(_id, gen_random_uuid());
BEGIN
  IF biz IS NULL THEN RAISE EXCEPTION 'no_business'; END IF;
  IF NOT (public.has_business_role(auth.uid(), biz, 'admin')
          OR public.has_business_role(auth.uid(), biz, 'billing')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.till_sessions WHERE business_id = biz AND status = 'open') THEN
    RAISE EXCEPTION 'session_already_open';
  END IF;
  IF _id IS NOT NULL AND EXISTS (SELECT 1 FROM public.till_sessions WHERE id = _id) THEN
    RETURN (SELECT t FROM public.till_sessions t WHERE id = _id);
  END IF;

  INSERT INTO public.till_sessions(id, business_id, opened_by, opening_float, opening_notes)
  VALUES (new_id, biz, auth.uid(), COALESCE(_opening_float, 0), _notes)
  RETURNING * INTO row;
  RETURN row;
END;
$function$;

-- close_till_session: idempotent on already-closed sessions
CREATE OR REPLACE FUNCTION public.close_till_session(_session_id uuid, _counted numeric, _denominations jsonb DEFAULT NULL::jsonb, _notes text DEFAULT NULL::text)
 RETURNS till_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF s.status = 'closed' THEN
    RETURN s;
  END IF;

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
$function$;

-- attempt_check_in: accept optional client-generated id
CREATE OR REPLACE FUNCTION public.attempt_check_in(_user_id uuid, _device_id uuid, _fingerprint_hash text, _method text DEFAULT 'fingerprint'::text, _id uuid DEFAULT NULL)
 RETURNS attendance_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  biz uuid := public.current_business_id();
  sch public.user_shift_schedules;
  now_ts timestamptz := now();
  sched_in timestamptz;
  sched_out timestamptz;
  earliest timestamptz;
  is_late boolean := false;
  existing uuid;
  new_row public.attendance_sessions;
  new_id uuid := COALESCE(_id, gen_random_uuid());
BEGIN
  IF biz IS NULL THEN RAISE EXCEPTION 'no_business'; END IF;

  IF _id IS NOT NULL THEN
    SELECT * INTO new_row FROM public.attendance_sessions WHERE id = _id;
    IF new_row.id IS NOT NULL THEN RETURN new_row; END IF;
  END IF;

  SELECT id INTO existing FROM public.attendance_sessions
    WHERE business_id = biz AND user_id = _user_id AND check_out_at IS NULL
    LIMIT 1;
  IF existing IS NOT NULL THEN RAISE EXCEPTION 'already_checked_in'; END IF;

  SELECT * INTO sch FROM public.get_user_schedule_for(_user_id, now_ts);
  IF sch.id IS NULL THEN RAISE EXCEPTION 'no_schedule'; END IF;

  sched_in := (date_trunc('day', now_ts) + sch.check_in_time)::timestamptz;
  sched_out := (date_trunc('day', now_ts) + sch.check_out_time)::timestamptz;
  IF sched_out <= sched_in THEN sched_out := sched_out + interval '1 day'; END IF;
  earliest := sched_in - make_interval(mins => sch.early_window_minutes);

  IF now_ts < earliest THEN RAISE EXCEPTION 'too_early'; END IF;
  IF now_ts > sched_out THEN RAISE EXCEPTION 'shift_ended'; END IF;
  IF now_ts > sched_in + make_interval(mins => sch.late_window_minutes) THEN is_late := true; END IF;

  IF _method = 'fingerprint' THEN
    IF _fingerprint_hash IS NULL THEN RAISE EXCEPTION 'missing_fingerprint'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.user_fingerprints
      WHERE business_id = biz AND user_id = _user_id AND template_hash = _fingerprint_hash
    ) THEN RAISE EXCEPTION 'fingerprint_mismatch'; END IF;
  END IF;

  INSERT INTO public.attendance_sessions (
    id, business_id, user_id, device_id, check_in_at, scheduled_check_in,
    scheduled_check_out, late, check_in_method, fingerprint_hash
  ) VALUES (
    new_id, biz, _user_id, _device_id, now_ts, sched_in, sched_out, is_late, _method, _fingerprint_hash
  ) RETURNING * INTO new_row;

  RETURN new_row;
END;
$function$;

-- attempt_check_out: unchanged signature, but make idempotent if already checked out via id lookup is N/A;
-- keep existing behavior.
