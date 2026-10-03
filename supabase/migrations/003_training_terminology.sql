BEGIN;

UPDATE public.problem_library
SET category = CASE category
  WHEN 'أكاديمي' THEN 'تدريبي'
  WHEN 'تحصيلي' THEN 'تدريبي'
  WHEN 'غير أكاديمي' THEN 'غير تدريبي'
  ELSE category
END
WHERE category IN ('أكاديمي', 'تحصيلي', 'غير أكاديمي');

UPDATE public.remedial_actions
SET category = 'تدريب'
WHERE category = 'تدريس';

COMMIT;
