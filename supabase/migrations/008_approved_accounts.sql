BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_access_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_access_status_check
  CHECK (access_status IN ('pending', 'approved', 'rejected'));

UPDATE public.profiles
SET
  role = CASE
    WHEN lower(btrim(email)) = 'shorog.a@tvtc.gov.sa' THEN 'admin'
    ELSE 'trainer'
  END,
  access_status = CASE
    WHEN lower(btrim(email)) = 'shorog.a@tvtc.gov.sa' THEN 'approved'
    ELSE 'pending'
  END,
  reviewed_at = CASE
    WHEN lower(btrim(email)) = 'shorog.a@tvtc.gov.sa' THEN COALESCE(reviewed_at, now())
    ELSE NULL
  END;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_is_admin boolean := lower(btrim(COALESCE(NEW.email, ''))) = 'shorog.a@tvtc.gov.sa';
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, access_status, reviewed_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    CASE WHEN v_is_admin THEN 'admin' ELSE 'trainer' END,
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END,
    CASE WHEN v_is_admin THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, threshold, case_study_threshold, improvement_target, skills)
  VALUES (
    NEW.id,
    60,
    12,
    35,
    ARRAY['فهم المفاهيم', 'حل المسائل', 'قراءة الجداول', 'التطبيق العملي', 'التحليل والاستنتاج', 'الحفظ والتذكر']::text[]
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.email_templates (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_account_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.access_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_site_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(btrim(p.email)) = 'shorog.a@tvtc.gov.sa'
      AND p.role = 'admin'
      AND p.access_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_account_approved() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_approved() TO authenticated;
REVOKE ALL ON FUNCTION public.is_site_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_site_admin() TO authenticated;

REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'user_settings',
    'courses',
    'sections',
    'students',
    'exams',
    'questions',
    'answers',
    'student_scores',
    'plans',
    'problem_library',
    'remedial_actions',
    'import_history',
    'plan_templates',
    'plan_instances',
    'email_templates'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format(
      'CREATE POLICY approved_account_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_account_approved()) WITH CHECK (public.is_account_approved())',
      v_table
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS trainer_assets_manage_own ON storage.objects;
CREATE POLICY trainer_assets_manage_own ON storage.objects
FOR ALL TO authenticated
USING (
  public.is_account_approved()
  AND bucket_id = 'trainer-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  public.is_account_approved()
  AND bucket_id = 'trainer-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE OR REPLACE FUNCTION public.admin_list_access_requests()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  requested_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'غير مصرح بعرض طلبات التسجيل'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.created_at
  FROM public.profiles p
  WHERE p.access_status = 'pending'
    AND lower(btrim(p.email)) <> 'shorog.a@tvtc.gov.sa'
  ORDER BY p.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_access_request(
  p_user_id uuid,
  p_approved boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'غير مصرح بمراجعة طلبات التسجيل'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'طلب التسجيل غير صالح'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET
    access_status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    role = 'trainer',
    reviewed_at = now()
  WHERE id = p_user_id
    AND access_status = 'pending'
    AND lower(btrim(email)) <> 'shorog.a@tvtc.gov.sa';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تمت مراجعته مسبقاً'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_access_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_access_requests() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_access_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_access_request(uuid, boolean) TO authenticated;

COMMIT;
