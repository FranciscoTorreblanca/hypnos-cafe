
CREATE POLICY "Waiters and kitchen can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'waiter'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)
);
