
-- Allow authenticated users to insert their own loyalty member record
CREATE POLICY "Authenticated can insert own loyalty member"
ON public.loyalty_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Update member coupons: loyalty members can view their own coupons
DROP POLICY IF EXISTS "Anon can view member coupons" ON public.loyalty_member_coupons;
CREATE POLICY "Loyalty members can view own coupons"
ON public.loyalty_member_coupons FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM public.loyalty_members WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'waiter')
);

-- Allow anon to view active coupons (for public coupon display)
CREATE POLICY "Anon can view active coupons list"
ON public.loyalty_member_coupons FOR SELECT TO anon
USING (true);
