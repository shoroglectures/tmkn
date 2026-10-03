BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================================
-- Public profile + user settings
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  role text NOT NULL DEFAULT 'trainer',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  threshold numeric NOT NULL DEFAULT 60,
  case_study_threshold numeric NOT NULL DEFAULT 12,
  improvement_target numeric NOT NULL DEFAULT 35,
  skills text[] NOT NULL DEFAULT '{}'::text[],
  signature_url text,
  header_url text,
  footer_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==========================================================
-- Core course structure
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  name text NOT NULL,
  exam_date timestamptz,
  max_score numeric NOT NULL DEFAULT 20,
  case_study_threshold numeric NOT NULL DEFAULT 12,
  score_type text NOT NULL DEFAULT 'questions'
    CHECK (score_type IN ('questions', 'direct')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  number integer NOT NULL,
  text text NOT NULL,
  skill text,
  topic text,
  correct_answer text NOT NULL,
  points numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.student_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  score numeric,
  weak_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  student_goals text,
  student_plan text,
  timeline text,
  commitment text,
  approved_at timestamptz,
  problem_description text,
  problem_category text,
  remedial_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvement_rate numeric,
  improvement_target numeric,
  is_case_study boolean NOT NULL DEFAULT false,
  feedback_message text,
  student_notes text,
  student_strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.problem_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text,
  text text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.remedial_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text,
  title text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.sections(id) ON DELETE CASCADE,
  file_name text,
  source text,
  students_count integer NOT NULL DEFAULT 0,
  columns_detected jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==========================================================
-- New tables required by the plan workflow
-- ==========================================================
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
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
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

-- ==========================================================
-- Shared timestamp trigger
-- ==========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_profiles ON public.profiles;
DROP TRIGGER IF EXISTS trg_set_updated_at_user_settings ON public.user_settings;
DROP TRIGGER IF EXISTS trg_set_updated_at_plans ON public.plans;
DROP TRIGGER IF EXISTS trg_set_updated_at_plan_templates ON public.plan_templates;
DROP TRIGGER IF EXISTS trg_set_updated_at_email_templates ON public.email_templates;

CREATE TRIGGER trg_set_updated_at_user_settings
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at_plans
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at_plan_templates
BEFORE UPDATE ON public.plan_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at_email_templates
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================================
-- Auth profile auto-create trigger
-- ==========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'trainer')
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================================
-- Helpers for ownership checks
-- ==========================================================
CREATE OR REPLACE FUNCTION public.user_owns_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = p_course_id
      AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_section(p_section_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sections s
    JOIN public.courses c ON c.id = s.course_id
    WHERE s.id = p_section_id
      AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students st
    JOIN public.sections s ON s.id = st.section_id
    JOIN public.courses c ON c.id = s.course_id
    WHERE st.id = p_student_id
      AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_exam(p_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exams e
    JOIN public.sections s ON s.id = e.section_id
    JOIN public.courses c ON c.id = s.course_id
    WHERE e.id = p_exam_id
      AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_template(p_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.plan_templates pt
    JOIN public.courses c ON c.id = pt.course_id
    WHERE pt.id = p_template_id
      AND c.user_id = auth.uid()
  );
$$;

-- ==========================================================
-- Row Level Security
-- ==========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remedial_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "user_settings_select_own" ON public.user_settings;
CREATE POLICY "user_settings_select_own" ON public.user_settings
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_settings_manage_own" ON public.user_settings;
CREATE POLICY "user_settings_manage_own" ON public.user_settings
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "courses_manage_own" ON public.courses;
CREATE POLICY "courses_manage_own" ON public.courses
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "sections_manage_own" ON public.sections;
CREATE POLICY "sections_manage_own" ON public.sections
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.courses c
  WHERE c.id = public.sections.course_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.courses c
  WHERE c.id = public.sections.course_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "students_manage_own" ON public.students;
CREATE POLICY "students_manage_own" ON public.students
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.sections s
  JOIN public.courses c ON c.id = s.course_id
  WHERE s.id = public.students.section_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.sections s
  JOIN public.courses c ON c.id = s.course_id
  WHERE s.id = public.students.section_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "exams_manage_own" ON public.exams;
CREATE POLICY "exams_manage_own" ON public.exams
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.sections s
  JOIN public.courses c ON c.id = s.course_id
  WHERE s.id = public.exams.section_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.sections s
  JOIN public.courses c ON c.id = s.course_id
  WHERE s.id = public.exams.section_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "questions_manage_own" ON public.questions;
CREATE POLICY "questions_manage_own" ON public.questions
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.exams e
  JOIN public.sections s ON s.id = e.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE e.id = public.questions.exam_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.exams e
  JOIN public.sections s ON s.id = e.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE e.id = public.questions.exam_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "answers_manage_own" ON public.answers;
CREATE POLICY "answers_manage_own" ON public.answers
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.exams e
  JOIN public.sections s ON s.id = e.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE e.id = public.answers.exam_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.exams e
  JOIN public.sections s ON s.id = e.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE e.id = public.answers.exam_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "student_scores_manage_own" ON public.student_scores;
CREATE POLICY "student_scores_manage_own" ON public.student_scores
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.exams e
  JOIN public.sections s ON s.id = e.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE e.id = public.student_scores.exam_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.exams e
  JOIN public.sections s ON s.id = e.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE e.id = public.student_scores.exam_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "plans_manage_own" ON public.plans;
CREATE POLICY "plans_manage_own" ON public.plans
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.students st
  JOIN public.sections s ON s.id = st.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE st.id = public.plans.student_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.students st
  JOIN public.sections s ON s.id = st.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE st.id = public.plans.student_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "problem_library_manage_own" ON public.problem_library;
CREATE POLICY "problem_library_manage_own" ON public.problem_library
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "remedial_actions_manage_own" ON public.remedial_actions;
CREATE POLICY "remedial_actions_manage_own" ON public.remedial_actions
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "import_history_manage_own" ON public.import_history;
CREATE POLICY "import_history_manage_own" ON public.import_history
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "plan_templates_manage_own" ON public.plan_templates;
CREATE POLICY "plan_templates_manage_own" ON public.plan_templates
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.courses c
  WHERE c.id = public.plan_templates.course_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.courses c
  WHERE c.id = public.plan_templates.course_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "plan_instances_manage_own" ON public.plan_instances;
CREATE POLICY "plan_instances_manage_own" ON public.plan_instances
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.plan_templates pt
  JOIN public.courses c ON c.id = pt.course_id
  WHERE pt.id = public.plan_instances.template_id AND c.user_id = auth.uid()
) OR EXISTS (
  SELECT 1
  FROM public.students st
  JOIN public.sections s ON s.id = st.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE st.id = public.plan_instances.student_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.plan_templates pt
  JOIN public.courses c ON c.id = pt.course_id
  WHERE pt.id = public.plan_instances.template_id AND c.user_id = auth.uid()
) OR EXISTS (
  SELECT 1
  FROM public.students st
  JOIN public.sections s ON s.id = st.section_id
  JOIN public.courses c ON c.id = s.course_id
  WHERE st.id = public.plan_instances.student_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "email_templates_manage_own" ON public.email_templates;
CREATE POLICY "email_templates_manage_own" ON public.email_templates
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ==========================================================
-- Public RPC portal functions
-- ==========================================================
CREATE OR REPLACE FUNCTION public.get_plan_instance_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance public.plan_instances%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_course public.courses%ROWTYPE;
  v_section public.sections%ROWTYPE;
  v_exam public.exams%ROWTYPE;
  v_template public.plan_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_instance
  FROM public.plan_instances
  WHERE token = p_token
  LIMIT 1;

  IF v_instance.id IS NULL THEN
    RETURN jsonb_build_object('instance', NULL, 'student', NULL, 'course', NULL, 'section', NULL, 'exam', NULL, 'template', NULL);
  END IF;

  SELECT * INTO v_template
  FROM public.plan_templates
  WHERE id = v_instance.template_id
  LIMIT 1;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = v_instance.student_id
  LIMIT 1;

  SELECT * INTO v_exam
  FROM public.exams
  WHERE id = v_instance.exam_id
  LIMIT 1;

  SELECT * INTO v_section
  FROM public.sections
  WHERE id = v_exam.section_id
  LIMIT 1;

  SELECT * INTO v_course
  FROM public.courses
  WHERE id = v_section.course_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'instance', to_jsonb(v_instance),
    'template', to_jsonb(v_template),
    'student', to_jsonb(v_student),
    'course', to_jsonb(v_course),
    'section', to_jsonb(v_section),
    'exam', to_jsonb(v_exam)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_plan_instance(p_token text, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance public.plan_instances%ROWTYPE;
BEGIN
  SELECT * INTO v_instance
  FROM public.plan_instances
  WHERE token = p_token
  LIMIT 1;

  IF v_instance.id IS NULL THEN
    RAISE EXCEPTION 'خطة غير موجودة';
  END IF;

  IF v_instance.expires_at < now() THEN
    UPDATE public.plan_instances
    SET status = 'expired'
    WHERE id = v_instance.id;
    RAISE EXCEPTION 'انتهت صلاحية الرابط';
  END IF;

  UPDATE public.plan_instances
  SET student_answers = p_answers,
      status = 'submitted',
      submitted_at = now()
  WHERE id = v_instance.id
  RETURNING * INTO v_instance;

  RETURN to_jsonb(v_instance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_plan_instance_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_plan_instance(text, jsonb) TO anon, authenticated;

COMMIT;
