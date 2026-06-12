
-- Fix restaurant_settings unique constraint to allow same key per different business
ALTER TABLE public.restaurant_settings DROP CONSTRAINT IF EXISTS restaurant_settings_key_key;
ALTER TABLE public.restaurant_settings DROP CONSTRAINT IF EXISTS restaurant_settings_key_unique;
ALTER TABLE public.restaurant_settings
  ADD CONSTRAINT restaurant_settings_business_key_unique UNIQUE (business_id, key);

-- Add role to business_members (scoped role per business)
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'waiter';
ALTER TABLE public.business_members DROP CONSTRAINT IF EXISTS business_members_user_business_unique;
ALTER TABLE public.business_members
  ADD CONSTRAINT business_members_user_business_role_unique UNIQUE (user_id, business_id, role);

-- Backfill business_members.role from user_roles for existing Hypnos Cafe members
UPDATE public.business_members bm
SET role = ur.role::text
FROM public.user_roles ur
WHERE ur.user_id = bm.user_id
  AND ur.role::text IN ('admin','waiter','billing','kitchen','business_admin')
  AND bm.role = 'waiter';

-- Helper: check role of user in a business
CREATE OR REPLACE FUNCTION public.has_business_role(_user_id uuid, _business_id uuid, _role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = _user_id AND business_id = _business_id AND role = _role
  )
$$;
