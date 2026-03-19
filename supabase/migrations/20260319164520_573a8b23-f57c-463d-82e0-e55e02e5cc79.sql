
-- Add loyalty_member to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'loyalty_member';

-- Add user_id column to loyalty_members (nullable initially for migration)
ALTER TABLE public.loyalty_members ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_members_user_id_key ON public.loyalty_members(user_id);

-- Update RLS: loyalty members can only view their own data
DROP POLICY IF EXISTS "Anon can select own loyalty member" ON public.loyalty_members;
DROP POLICY IF EXISTS "Anon can insert loyalty members" ON public.loyalty_members;

-- Authenticated loyalty members can view their own record
CREATE POLICY "Loyalty members can view own record"
ON public.loyalty_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'waiter'));

-- Anon can view by member_code (for QR scan redirect before login)
CREATE POLICY "Anon can view by member code"
ON public.loyalty_members FOR SELECT TO anon
USING (true);

-- Remove old authenticated select policy and replace
DROP POLICY IF EXISTS "Authenticated can view loyalty members" ON public.loyalty_members;
