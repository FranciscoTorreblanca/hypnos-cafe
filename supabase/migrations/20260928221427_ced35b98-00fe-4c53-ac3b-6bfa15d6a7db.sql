CREATE OR REPLACE FUNCTION public.can_manage_schedule(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin()
    OR (public.is_member_of(_business_id) AND (
      public.is_admin()
      OR public.has_business_role(auth.uid(), _business_id, 'admin')
      OR public.has_business_role(auth.uid(), _business_id, 'business_admin')))
$$;

CREATE TABLE public.schedule_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#8b5cf6',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_employees TO authenticated;
GRANT ALL ON public.schedule_employees TO service_role;
ALTER TABLE public.schedule_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view schedule employees" ON public.schedule_employees FOR SELECT TO authenticated USING (public.is_member_of(business_id) OR public.is_super_admin());
CREATE POLICY "Admins insert schedule employees" ON public.schedule_employees FOR INSERT TO authenticated WITH CHECK (public.can_manage_schedule(business_id));
CREATE POLICY "Admins update schedule employees" ON public.schedule_employees FOR UPDATE TO authenticated USING (public.can_manage_schedule(business_id)) WITH CHECK (public.can_manage_schedule(business_id));
CREATE POLICY "Admins delete schedule employees" ON public.schedule_employees FOR DELETE TO authenticated USING (public.can_manage_schedule(business_id));

CREATE TABLE public.schedule_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.schedule_employees(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_shifts TO authenticated;
GRANT ALL ON public.schedule_shifts TO service_role;
ALTER TABLE public.schedule_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view shifts" ON public.schedule_shifts FOR SELECT TO authenticated USING (public.is_member_of(business_id) OR public.is_super_admin());
CREATE POLICY "Admins insert shifts" ON public.schedule_shifts FOR INSERT TO authenticated WITH CHECK (public.can_manage_schedule(business_id));
CREATE POLICY "Admins update shifts" ON public.schedule_shifts FOR UPDATE TO authenticated USING (public.can_manage_schedule(business_id)) WITH CHECK (public.can_manage_schedule(business_id));
CREATE POLICY "Admins delete shifts" ON public.schedule_shifts FOR DELETE TO authenticated USING (public.can_manage_schedule(business_id));

CREATE TABLE public.schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.schedule_employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('off','shift')),
  start_time time,
  end_time time,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_exceptions TO authenticated;
GRANT ALL ON public.schedule_exceptions TO service_role;
ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view exceptions" ON public.schedule_exceptions FOR SELECT TO authenticated USING (public.is_member_of(business_id) OR public.is_super_admin());
CREATE POLICY "Admins insert exceptions" ON public.schedule_exceptions FOR INSERT TO authenticated WITH CHECK (public.can_manage_schedule(business_id));
CREATE POLICY "Admins update exceptions" ON public.schedule_exceptions FOR UPDATE TO authenticated USING (public.can_manage_schedule(business_id)) WITH CHECK (public.can_manage_schedule(business_id));
CREATE POLICY "Admins delete exceptions" ON public.schedule_exceptions FOR DELETE TO authenticated USING (public.can_manage_schedule(business_id));

CREATE INDEX ON public.schedule_shifts (business_id, weekday);
CREATE INDEX ON public.schedule_exceptions (business_id, date);

CREATE TRIGGER t_sched_emp_upd BEFORE UPDATE ON public.schedule_employees FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_sched_shift_upd BEFORE UPDATE ON public.schedule_shifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_sched_exc_upd BEFORE UPDATE ON public.schedule_exceptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();