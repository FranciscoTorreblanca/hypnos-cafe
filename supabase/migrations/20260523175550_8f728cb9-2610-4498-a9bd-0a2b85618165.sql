
CREATE TABLE public.usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'unknown',
  event_type text NOT NULL,
  path text NOT NULL DEFAULT '',
  action_name text NOT NULL DEFAULT '',
  from_path text NOT NULL DEFAULT '',
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own usage events"
ON public.usage_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view usage events"
ON public.usage_events
FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can delete usage events"
ON public.usage_events
FOR DELETE
TO authenticated
USING (is_admin());

CREATE INDEX idx_usage_events_created_at ON public.usage_events (created_at DESC);
CREATE INDEX idx_usage_events_user_id ON public.usage_events (user_id);
CREATE INDEX idx_usage_events_path ON public.usage_events (path);
CREATE INDEX idx_usage_events_event_type ON public.usage_events (event_type);
CREATE INDEX idx_usage_events_role ON public.usage_events (role);
