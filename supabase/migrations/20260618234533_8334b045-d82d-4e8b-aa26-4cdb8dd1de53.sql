
DROP POLICY IF EXISTS active_business_scope ON public.business_features;
CREATE POLICY active_business_scope ON public.business_features
  AS RESTRICTIVE
  FOR ALL
  USING (auth.uid() IS NULL OR public.is_super_admin() OR business_id = public.current_business_id())
  WITH CHECK (auth.uid() IS NULL OR public.is_super_admin() OR business_id = public.current_business_id());
