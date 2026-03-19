
-- Tighten loyalty_members update to only staff with waiter/admin roles
DROP POLICY "Authenticated can update loyalty members" ON public.loyalty_members;
CREATE POLICY "Staff can update loyalty members" ON public.loyalty_members FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));

-- Tighten loyalty_visits insert to waiter/admin
DROP POLICY "Authenticated can insert loyalty visits" ON public.loyalty_visits;
CREATE POLICY "Staff can insert loyalty visits" ON public.loyalty_visits FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));

-- Tighten loyalty_member_coupons update to waiter/admin (for redeeming)
DROP POLICY "Authenticated can update member coupons" ON public.loyalty_member_coupons;
CREATE POLICY "Staff can update member coupons" ON public.loyalty_member_coupons FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));

-- Allow staff to also insert member coupons (for auto-granting after visits)
DROP POLICY "Admins can insert member coupons" ON public.loyalty_member_coupons;
CREATE POLICY "Staff can insert member coupons" ON public.loyalty_member_coupons FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));
