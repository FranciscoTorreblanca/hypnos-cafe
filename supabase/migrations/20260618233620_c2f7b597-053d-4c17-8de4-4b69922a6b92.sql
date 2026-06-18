
-- 1. Add feature flag
ALTER TABLE public.business_features
  ADD COLUMN IF NOT EXISTS time_attendance boolean NOT NULL DEFAULT false;

-- 2. Attendance devices
CREATE TABLE public.attendance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  label text NOT NULL,
  device_token_hash text NOT NULL UNIQUE,
  is_time_clock boolean NOT NULL DEFAULT false,
  allow_pin_fallback boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  fingerprint_bridge_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_devices TO authenticated;
GRANT ALL ON public.attendance_devices TO service_role;
ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read devices" ON public.attendance_devices
  FOR SELECT TO authenticated USING (public.is_member_of(business_id));
CREATE POLICY "Admins manage devices" ON public.attendance_devices
  FOR ALL TO authenticated
  USING (public.is_member_of(business_id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_member_of(business_id) AND public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_attendance_devices_updated_at
  BEFORE UPDATE ON public.attendance_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. User shift schedules (one row per user+weekday; weekday 0-6 Mon-Sun, NULL = default fallback)
CREATE TABLE public.user_shift_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  weekday smallint,
  check_in_time time NOT NULL DEFAULT '09:00',
  check_out_time time NOT NULL DEFAULT '18:00',
  early_window_minutes integer NOT NULL DEFAULT 15,
  late_window_minutes integer NOT NULL DEFAULT 30,
  auto_logout_offset_minutes integer NOT NULL DEFAULT 60,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_shift_schedules TO authenticated;
GRANT ALL ON public.user_shift_schedules TO service_role;
ALTER TABLE public.user_shift_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own schedules" ON public.user_shift_schedules
  FOR SELECT TO authenticated
  USING (public.is_member_of(business_id) AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admins manage schedules" ON public.user_shift_schedules
  FOR ALL TO authenticated
  USING (public.is_member_of(business_id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_member_of(business_id) AND public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_user_shift_schedules_updated_at
  BEFORE UPDATE ON public.user_shift_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Attendance sessions
CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  device_id uuid REFERENCES public.attendance_devices(id) ON DELETE SET NULL,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_out_at timestamptz,
  scheduled_check_in timestamptz,
  scheduled_check_out timestamptz,
  late boolean NOT NULL DEFAULT false,
  check_in_method text NOT NULL DEFAULT 'fingerprint',
  check_out_method text,
  fingerprint_hash text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions TO authenticated;
GRANT ALL ON public.attendance_sessions TO service_role;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own sessions" ON public.attendance_sessions
  FOR SELECT TO authenticated
  USING (public.is_member_of(business_id) AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admins manage sessions" ON public.attendance_sessions
  FOR ALL TO authenticated
  USING (public.is_member_of(business_id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_member_of(business_id) AND public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_attendance_sessions_open
  ON public.attendance_sessions (business_id, user_id)
  WHERE check_out_at IS NULL;
CREATE TRIGGER trg_attendance_sessions_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Fingerprint enrollments (template hashes only)
CREATE TABLE public.user_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  template_hash text NOT NULL,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, template_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_fingerprints TO authenticated;
GRANT ALL ON public.user_fingerprints TO service_role;
ALTER TABLE public.user_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fingerprints" ON public.user_fingerprints
  FOR ALL TO authenticated
  USING (public.is_member_of(business_id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_member_of(business_id) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members see own fingerprints" ON public.user_fingerprints
  FOR SELECT TO authenticated
  USING (public.is_member_of(business_id) AND user_id = auth.uid());

-- 6. RPCs
CREATE OR REPLACE FUNCTION public.get_user_schedule_for(_user_id uuid, _at timestamptz)
RETURNS public.user_shift_schedules
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.user_shift_schedules
  WHERE business_id = public.current_business_id()
    AND user_id = _user_id
    AND active
    AND (weekday = EXTRACT(ISODOW FROM _at)::smallint - 1 OR weekday IS NULL)
  ORDER BY weekday NULLS LAST
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.attempt_check_in(
  _user_id uuid,
  _device_id uuid,
  _fingerprint_hash text,
  _method text DEFAULT 'fingerprint'
) RETURNS public.attendance_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
BEGIN
  IF biz IS NULL THEN RAISE EXCEPTION 'no_business'; END IF;

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

  -- Validate fingerprint hash if method = fingerprint
  IF _method = 'fingerprint' THEN
    IF _fingerprint_hash IS NULL THEN RAISE EXCEPTION 'missing_fingerprint'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.user_fingerprints
      WHERE business_id = biz AND user_id = _user_id AND template_hash = _fingerprint_hash
    ) THEN RAISE EXCEPTION 'fingerprint_mismatch'; END IF;
  END IF;

  INSERT INTO public.attendance_sessions (
    business_id, user_id, device_id, check_in_at, scheduled_check_in,
    scheduled_check_out, late, check_in_method, fingerprint_hash
  ) VALUES (
    biz, _user_id, _device_id, now_ts, sched_in, sched_out, is_late, _method, _fingerprint_hash
  ) RETURNING * INTO new_row;

  RETURN new_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.attempt_check_out(
  _user_id uuid,
  _device_id uuid,
  _fingerprint_hash text,
  _method text DEFAULT 'fingerprint'
) RETURNS public.attendance_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  biz uuid := public.current_business_id();
  sess public.attendance_sessions;
BEGIN
  IF biz IS NULL THEN RAISE EXCEPTION 'no_business'; END IF;

  SELECT * INTO sess FROM public.attendance_sessions
    WHERE business_id = biz AND user_id = _user_id AND check_out_at IS NULL
    ORDER BY check_in_at DESC LIMIT 1;
  IF sess.id IS NULL THEN RAISE EXCEPTION 'no_open_session'; END IF;

  IF _method = 'fingerprint' THEN
    IF _fingerprint_hash IS NULL THEN RAISE EXCEPTION 'missing_fingerprint'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.user_fingerprints
      WHERE business_id = biz AND user_id = _user_id AND template_hash = _fingerprint_hash
    ) THEN RAISE EXCEPTION 'fingerprint_mismatch'; END IF;
  END IF;

  UPDATE public.attendance_sessions
    SET check_out_at = now(),
        check_out_method = _method,
        device_id = COALESCE(_device_id, device_id)
    WHERE id = sess.id
    RETURNING * INTO sess;
  RETURN sess;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_expired_sessions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH expired AS (
    SELECT s.id
    FROM public.attendance_sessions s
    LEFT JOIN public.user_shift_schedules sch
      ON sch.business_id = s.business_id
     AND sch.user_id = s.user_id
     AND sch.active
     AND (sch.weekday = EXTRACT(ISODOW FROM s.check_in_at)::smallint - 1 OR sch.weekday IS NULL)
    WHERE s.check_out_at IS NULL
      AND s.scheduled_check_out IS NOT NULL
      AND now() > s.scheduled_check_out + make_interval(mins => COALESCE(sch.auto_logout_offset_minutes, 60))
  )
  UPDATE public.attendance_sessions
     SET check_out_at = now(), check_out_method = 'auto'
   WHERE id IN (SELECT id FROM expired);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_open_attendance_session()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance_sessions
    WHERE business_id = public.current_business_id()
      AND user_id = auth.uid()
      AND check_out_at IS NULL
  )
$$;
