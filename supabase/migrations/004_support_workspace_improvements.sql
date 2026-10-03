BEGIN;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS header_url text,
  ADD COLUMN IF NOT EXISTS signature_url text;

-- Convert only values that cannot be raw scores because they exceed the
-- imported maximum. Ambiguous values at or below the maximum are preserved.
UPDATE public.plan_instances
SET score = round((score * max_score) / 100.0, 2)
WHERE score IS NOT NULL
  AND max_score IS NOT NULL
  AND max_score > 0
  AND score > max_score;

UPDATE public.plans p
SET score = round((p.score * e.max_score) / 100.0, 2)
FROM public.exams e
WHERE e.id = p.exam_id
  AND p.score IS NOT NULL
  AND e.max_score > 0
  AND p.score > e.max_score;

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

CREATE OR REPLACE FUNCTION public.get_plan_instance_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) > 128 THEN
    RETURN jsonb_build_object(
      'instance', NULL, 'student', NULL, 'course', NULL,
      'section', NULL, 'exam', NULL, 'template', NULL, 'trainer', NULL
    );
  END IF;

  SELECT jsonb_build_object(
    'instance', jsonb_build_object(
      'id', pi.id,
      'status', pi.status,
      'expires_at', pi.expires_at,
      'student_answers', pi.student_answers,
      'submitted_at', pi.submitted_at,
      'score', pi.score,
      'max_score', pi.max_score
    ),
    'template', jsonb_build_object(
      'title', pt.title,
      'questions', pt.questions,
      'footer_message', pt.footer_message
    ),
    'student', jsonb_build_object('name', st.name, 'code', st.code),
    'course', jsonb_build_object('name', c.name),
    'section', jsonb_build_object('name', s.name),
    'exam', jsonb_build_object('name', e.name),
    'trainer', jsonb_build_object(
      'name', pr.full_name,
      'header_url', us.header_url,
      'signature_url', us.signature_url
    )
  )
  INTO v_result
  FROM public.plan_instances pi
  JOIN public.plan_templates pt ON pt.id = pi.template_id
  JOIN public.students st ON st.id = pi.student_id
  JOIN public.sections s ON s.id = st.section_id
  JOIN public.courses c ON c.id = s.course_id AND c.id = pt.course_id
  JOIN public.exams e ON e.id = pi.exam_id AND e.section_id = s.id
  LEFT JOIN public.profiles pr ON pr.id = c.user_id
  LEFT JOIN public.user_settings us ON us.user_id = c.user_id
  WHERE pi.token = p_token
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- Legacy plans use their UUID as the bearer token; expose only report fields.
  SELECT jsonb_build_object(
    'instance', jsonb_build_object(
      'id', p.id,
      'status', CASE
        WHEN p.approved_at IS NOT NULL OR p.status IN ('submitted', 'approved') THEN 'submitted'
        WHEN p.created_at + interval '30 days' <= now() THEN 'expired'
        ELSE 'pending'
      END,
      'expires_at', p.created_at + interval '30 days',
      'student_answers', jsonb_build_array(jsonb_build_object(
        'general_answer', COALESCE(p.student_plan, p.student_goals, '')
      )),
      'submitted_at', p.approved_at,
      'score', p.score,
      'max_score', e.max_score
    ),
    'template', jsonb_build_object(
      'title', 'الخطة التحسينية',
      'questions', '[]'::jsonb,
      'footer_message', p.feedback_message
    ),
    'student', jsonb_build_object('name', st.name, 'code', st.code),
    'course', jsonb_build_object('name', c.name),
    'section', jsonb_build_object('name', s.name),
    'exam', jsonb_build_object('name', e.name),
    'trainer', jsonb_build_object(
      'name', pr.full_name,
      'header_url', us.header_url,
      'signature_url', us.signature_url
    )
  )
  INTO v_result
  FROM public.plans p
  JOIN public.students st ON st.id = p.student_id
  JOIN public.exams e ON e.id = p.exam_id
  JOIN public.sections s ON s.id = st.section_id AND s.id = e.section_id
  JOIN public.courses c ON c.id = s.course_id
  LEFT JOIN public.profiles pr ON pr.id = c.user_id
  LEFT JOIN public.user_settings us ON us.user_id = c.user_id
  WHERE p.id::text = p_token OR p.token = p_token
  LIMIT 1;

  RETURN COALESCE(v_result, jsonb_build_object(
    'instance', NULL, 'student', NULL, 'course', NULL,
    'section', NULL, 'exam', NULL, 'template', NULL, 'trainer', NULL
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_plan_instance_by_token(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_instance_by_token(text)
  TO anon, authenticated;

ALTER FUNCTION public.submit_plan_instance(text, jsonb)
  RENAME TO submit_plan_instance_secure;
REVOKE ALL ON FUNCTION public.submit_plan_instance_secure(text, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_plan_instance(
  p_token text,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_general_answer text;
  v_submitted_at timestamptz;
BEGIN
  IF p_token IS NULL OR length(p_token) > 128 THEN
    RAISE EXCEPTION 'رابط الخطة غير صالح';
  END IF;

  IF EXISTS (SELECT 1 FROM public.plan_instances WHERE token = p_token) THEN
    RETURN public.submit_plan_instance_secure(p_token, p_answers);
  END IF;

  IF p_answers IS NULL
     OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
     OR jsonb_array_length(CASE
       WHEN jsonb_typeof(p_answers) = 'array' THEN p_answers
       ELSE '[]'::jsonb
     END) <> 1
     OR jsonb_typeof(p_answers->0) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_answers->0->'general_answer') IS DISTINCT FROM 'string'
     OR length(p_answers->0->>'general_answer') > 5000
     OR pg_column_size(p_answers) > 65536 THEN
    RAISE EXCEPTION 'صيغة الإجابة غير صالحة';
  END IF;

  v_general_answer := p_answers->0->>'general_answer';

  SELECT * INTO v_plan
  FROM public.plans
  WHERE id::text = p_token OR token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'خطة غير موجودة';
  END IF;

  IF v_plan.approved_at IS NOT NULL OR v_plan.status IN ('submitted', 'approved') THEN
    RAISE EXCEPTION 'تم تقديم هذه الخطة مسبقاً';
  END IF;

  IF v_plan.created_at + interval '30 days' <= now() THEN
    RAISE EXCEPTION 'انتهت صلاحية الرابط';
  END IF;

  UPDATE public.plans
  SET student_plan = v_general_answer,
      status = 'submitted',
      approved_at = now()
  WHERE id = v_plan.id
  RETURNING approved_at INTO v_submitted_at;

  RETURN jsonb_build_object('status', 'submitted', 'submitted_at', v_submitted_at);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_plan_instance(text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_plan_instance(text, jsonb)
  TO anon, authenticated;

COMMIT;