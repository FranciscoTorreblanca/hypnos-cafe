
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all subscriptions (needed for sending notifications)
CREATE POLICY "Admins can view all push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (is_admin());
