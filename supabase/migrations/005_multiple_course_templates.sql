BEGIN;

DO $$
DECLARE
  unique_constraint_name text;
BEGIN
  FOR unique_constraint_name IN
    SELECT constraint_row.conname
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.plan_templates'::regclass
      AND constraint_row.contype = 'u'
      AND array_length(constraint_row.conkey, 1) = 1
      AND constraint_row.conkey[1] = (
        SELECT attribute_row.attnum
        FROM pg_attribute attribute_row
        WHERE attribute_row.attrelid = 'public.plan_templates'::regclass
          AND attribute_row.attname = 'course_id'
          AND NOT attribute_row.attisdropped
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.plan_templates DROP CONSTRAINT %I',
      unique_constraint_name
    );
  END LOOP;
END;
$$;

DROP INDEX IF EXISTS public.plan_templates_course_id_key;

CREATE INDEX IF NOT EXISTS idx_plan_templates_course_id
  ON public.plan_templates(course_id);

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