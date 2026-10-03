BEGIN;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS header_url text,
  ADD COLUMN IF NOT EXISTS signature_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('trainer-assets', 'trainer-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "trainer_assets_manage_own" ON storage.objects;
CREATE POLICY "trainer_assets_manage_own" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'trainer-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'trainer-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;