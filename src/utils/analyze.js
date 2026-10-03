// محرّك تحليل الاختبار — قلب النظام

const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * يحلل اختباراً كاملاً ويعيد نتائج كل متدربة.
 *
 * @param {Object} args
 * @param {'questions'|'direct'} args.mode
 * @param {Array}  args.questions  - الأسئلة (id, skill, correct_answer, points)
 * @param {Array}  args.students   - المتدربات (id, name, code)
 * @param {Array}  args.answers    - الإجابات (student_id, question_id, answer)
 * @param {Array}  args.scores     - الدرجات المباشرة (student_id, score, max_score)
 * @param {number} args.threshold  - العتبة (%)
 * @param {number} args.caseStudyThreshold - عتبة المتعثرة في الوضع المباشر
 * @returns {Array}
 */
export function analyzeExam({
  mode = 'questions',
  questions = [],
  students = [],
  answers = [],
  scores = [],
  threshold = 60,
  caseStudyThreshold = 12,
} = {}) {
  const effectiveMode = mode === 'direct' ? 'direct' : 'questions';

  if (effectiveMode === 'direct') {
    if (!students.length) return [];

    const directThreshold = Number(caseStudyThreshold) || 0;

    return students
      .map((st) => {
        const scoreEntry = scores.find((s) => s.student_id === st.id);
        const score = Number(scoreEntry?.score ?? 0);
        const total = Number(scoreEntry?.max_score ?? 0);
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;

        return {
          student: st,
          score,
          total,
          pct,
          weakSkills: [],
          wrongQuestionIds: [],
          needsPlan: score < directThreshold,
        };
      })
      .sort((a, b) => a.pct - b.pct);
  }

  if (!questions.length || !students.length) return [];

  return students
    .map((st) => {
      const stAnswers = answers.filter((a) => a.student_id === st.id);
      let score = 0;
      let total = 0;
      const skillStats = {};
      const wrongQuestionIds = [];

      questions.forEach((q) => {
        const pts = Number(q.points) || 1;
        total += pts;

        const ans = stAnswers.find((a) => a.question_id === q.id);
        const ok = ans && normalize(ans.answer) === normalize(q.correct_answer);

        if (ok) score += pts;
        else wrongQuestionIds.push(q.id);

        const sk = q.skill || 'عام';
        if (!skillStats[sk]) skillStats[sk] = { correct: 0, total: 0 };
        skillStats[sk].total += pts;
        if (ok) skillStats[sk].correct += pts;
      });

      const pct = total ? Math.round((score / total) * 100) : 0;

      const weakSkills = Object.entries(skillStats)
        .filter(([, v]) => v.total > 0 && v.correct / v.total < 0.7)
        .map(([skill, v]) => ({
          skill,
          pct: Math.round((v.correct / v.total) * 100),
        }))
        .sort((a, b) => a.pct - b.pct);

      return {
        student: st,
        score,
        total,
        pct,
        weakSkills,
        wrongQuestionIds,
        needsPlan: pct < threshold,
      };
    })
    .sort((a, b) => a.pct - b.pct);
}

/** يحوّل النسبة إلى مستوى + لون */
export function levelOf(pct, threshold = 60) {
  if (pct >= threshold + 20) return { emoji: '🟢', label: 'ممتاز', color: '#10b981' };
  if (pct >= threshold)      return { emoji: '🟡', label: 'جيد',   color: '#f59e0b' };
  return                       { emoji: '🔴', label: 'يحتاج دعم', color: '#ef4444' };
}