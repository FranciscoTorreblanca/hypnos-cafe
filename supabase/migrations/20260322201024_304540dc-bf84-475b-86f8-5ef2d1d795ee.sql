
-- Allow waiters to insert into restaurant_settings (for table_names)
CREATE POLICY "Waiters can insert settings"
ON public.restaurant_settings
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'waiter'::app_role)
);

-- Allow waiters to update restaurant_settings (for table_names)
CREATE POLICY "Waiters can update settings"
ON public.restaurant_settings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'waiter'::app_role)
);
