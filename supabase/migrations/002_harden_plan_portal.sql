BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'الخطة التحسينية',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  footer_message text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  template_id uuid NOT NULL REFERENCES public.plan_templates(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  score numeric,
  max_score numeric,
  student_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'expired')),
  submitted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, student_id, exam_id)
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT 'خطة تحسينية لمقرر {course_name}',
  body text NOT NULL DEFAULT E'عزيزتي {student_name},\n\nنرفق لك رابط الخطة\nالتحسينية الخاصة بمقرر {course_name}.\nنرجو تعبئتها خلال المدة\nالمحددة.\n\nمع تمنياتنا لك بالتوفيق،\n{trainer_name}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_templates,
  public.plan_instances, public.email_templates TO authenticated;
REVOKE ALL ON public.plan_templates, public.plan_instances,
  public.email_templates FROM anon;

DROP POLICY IF EXISTS "plan_templates_manage_own" ON public.plan_templates;
CREATE POLICY "plan_templates_manage_own" ON public.plan_templates
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.courses c
  WHERE c.id = course_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.courses c
  WHERE c.id = course_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "email_templates_manage_own" ON public.email_templates;
CREATE POLICY "email_templates_manage_own" ON public.email_templates
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- A plan instance must belong to one trainer and match its course, section,
-- student, and exam context.
CREATE OR REPLACE FUNCTION public.can_manage_plan_instance(
  p_template_id uuid,
  p_student_id uuid,
  p_exam_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.plan_templates pt
    JOIN public.courses c ON c.id = pt.course_id
    JOIN public.students st ON st.id = p_student_id
    JOIN public.sections s ON s.id = st.section_id AND s.course_id = c.id
    JOIN public.exams e ON e.id = p_exam_id AND e.section_id = s.id
    WHERE pt.id = p_template_id
      AND c.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_plan_instance(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_plan_instance(uuid, uuid, uuid)
  TO authenticated;

DROP POLICY IF EXISTS "plan_instances_manage_own" ON public.plan_instances;
CREATE POLICY "plan_instances_manage_own" ON public.plan_instances
FOR ALL TO authenticated
USING (
  public.can_manage_plan_instance(template_id, student_id, exam_id)
)
WITH CHECK (
  public.can_manage_plan_instance(template_id, student_id, exam_id)
);

-- Return only fields used by the public portal; never expose student email,
-- trainer IDs, tokens, or unrelated table columns.
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
      'section', NULL, 'exam', NULL, 'template', NULL
    );
  END IF;

  SELECT jsonb_build_object(
    'instance', jsonb_build_object(
      'id', pi.id,
      'status', pi.status,
      'expires_at', pi.expires_at,
      'student_answers', pi.student_answers,
      'submitted_at', pi.submitted_at
    ),
    'template', jsonb_build_object(
      'title', pt.title,
      'questions', pt.questions,
      'footer_message', pt.footer_message
    ),
    'student', jsonb_build_object('name', st.name, 'code', st.code),
    'course', jsonb_build_object('name', c.name),
    'section', jsonb_build_object('name', s.name),
    'exam', jsonb_build_object('name', e.name)
  )
  INTO v_result
  FROM public.plan_instances pi
  JOIN public.plan_templates pt ON pt.id = pi.template_id
  JOIN public.students st ON st.id = pi.student_id
  JOIN public.sections s ON s.id = st.section_id
  JOIN public.courses c ON c.id = s.course_id AND c.id = pt.course_id
  JOIN public.exams e ON e.id = pi.exam_id AND e.section_id = s.id
  WHERE pi.token = p_token
  LIMIT 1;

  RETURN COALESCE(
    v_result,
    jsonb_build_object(
      'instance', NULL, 'student', NULL, 'course', NULL,
      'section', NULL, 'exam', NULL, 'template', NULL
    )
  );
END;
$$;

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
  v_instance public.plan_instances%ROWTYPE;
  v_questions jsonb;
  v_entry jsonb;
  v_question jsonb;
  v_question_id text;
  v_option_id text;
  v_seen_questions text[] := ARRAY[]::text[];
  v_seen_options text[];
  v_general_seen boolean := false;
  v_status text;
  v_submitted_at timestamptz;
BEGIN
  IF p_token IS NULL OR length(p_token) > 128 THEN
    RAISE EXCEPTION 'رابط الخطة غير صالح';
  END IF;

  IF p_answers IS NULL
     OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
     OR pg_column_size(p_answers) > 65536 THEN
    RAISE EXCEPTION 'صيغة الإجابات غير صالحة';
  END IF;

  SELECT * INTO v_instance
  FROM public.plan_instances
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'خطة غير موجودة';
  END IF;

  IF v_instance.status <> 'pending' THEN
    RAISE EXCEPTION 'تم تقديم هذه الخطة مسبقاً أو لم تعد متاحة';
  END IF;

  IF v_instance.expires_at <= now() THEN
    RAISE EXCEPTION 'انتهت صلاحية الرابط';
  END IF;

  SELECT questions INTO v_questions
  FROM public.plan_templates
  WHERE id = v_instance.template_id;

  IF jsonb_typeof(v_questions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'نموذج الخطة غير صالح';
  END IF;

  FOR v_entry IN
    SELECT value FROM jsonb_array_elements(p_answers) AS answers(value)
  LOOP
    IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'صيغة الإجابة غير صالحة';
    END IF;

    IF v_entry ? 'general_answer' THEN
      IF v_entry ? 'question_id' OR v_general_seen
         OR jsonb_typeof(v_entry->'general_answer') NOT IN ('string', 'null')
         OR length(COALESCE(v_entry->>'general_answer', '')) > 5000 THEN
        RAISE EXCEPTION 'الرد العام غير صالح';
      END IF;
      v_general_seen := true;
      CONTINUE;
    END IF;

    v_question_id := v_entry->>'question_id';
    IF v_question_id IS NULL
       OR v_question_id = ANY(v_seen_questions)
       OR jsonb_typeof(v_entry->'selected') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'إجابة السؤال غير صالحة';
    END IF;

    SELECT value INTO v_question
    FROM jsonb_array_elements(v_questions) AS questions(value)
    WHERE value->>'id' = v_question_id
    LIMIT 1;

    IF v_question IS NULL
       OR jsonb_typeof(v_question->'options') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'السؤال غير موجود في هذا النموذج';
    END IF;

    v_seen_questions := array_append(v_seen_questions, v_question_id);
    v_seen_options := ARRAY[]::text[];

    FOR v_option_id IN
      SELECT value
      FROM jsonb_array_elements_text(v_entry->'selected') AS selected(value)
    LOOP
      IF v_option_id = ANY(v_seen_options) OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_question->'options') AS options(value)
        WHERE value->>'id' = v_option_id
      ) THEN
        RAISE EXCEPTION 'خيار الإجابة غير صالح';
      END IF;
      v_seen_options := array_append(v_seen_options, v_option_id);
    END LOOP;
  END LOOP;

  UPDATE public.plan_instances
  SET student_answers = p_answers,
      status = 'submitted',
      submitted_at = now()
  WHERE id = v_instance.id
  RETURNING status, submitted_at INTO v_status, v_submitted_at;

  RETURN jsonb_build_object('status', v_status, 'submitted_at', v_submitted_at);
END;
$$;

REVOKE ALL ON FUNCTION public.get_plan_instance_by_token(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_plan_instance(text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_instance_by_token(text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_plan_instance(text, jsonb)
  TO anon, authenticated;

-- Self-service registration and profile editing must never grant a privileged role.
CREATE OR REPLACE FUNCTION public.enforce_trainer_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.role := 'trainer';
  ELSIF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'لا يمكن تغيير الدور من واجهة المستخدم';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_trainer_profile_role ON public.profiles;
CREATE TRIGGER trg_enforce_trainer_profile_role
BEFORE INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_trainer_profile_role();

COMMIT;