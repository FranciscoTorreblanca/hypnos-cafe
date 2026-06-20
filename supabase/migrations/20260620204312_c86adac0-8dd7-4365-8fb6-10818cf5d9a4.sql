
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS evidence_reference text;

DROP POLICY IF EXISTS "payment_evidence_select" ON storage.objects;
CREATE POLICY "payment_evidence_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-evidence'
    AND public.is_member_of((split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS "payment_evidence_insert" ON storage.objects;
CREATE POLICY "payment_evidence_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-evidence'
    AND public.is_member_of((split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS "payment_evidence_delete" ON storage.objects;
CREATE POLICY "payment_evidence_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-evidence'
    AND public.is_member_of((split_part(name, '/', 1))::uuid)
  );
