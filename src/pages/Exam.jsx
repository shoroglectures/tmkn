import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Sparkles, HeartPulse, ClipboardList, BarChart3, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { analyzeExam, levelOf } from '../utils/analyze';
import { parseQuestionsFile, parseAnswersFile, downloadQuestionsTemplate } from '../utils/excel';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import FileUploadButton from '../components/FileUploadButton';
import EmptyState from '../components/EmptyState';
import StatCard from '../components/StatCard';

export default function Exam() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [section, setSection] = useState(null);
  const [course, setCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [scores, setScores] = useState([]);
  const [plans, setPlans] = useState([]);
  const [threshold, setThreshold] = useState(60);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalQ, setModalQ] = useState(false);
  const [modalA, setModalA] = useState(false);
  const [qForm, setQForm] = useState({ text: '', skill: '', topic: '', correct_answer: '', points: 1 });

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    setLoading(true);

    const { data: ex } = await supabase.from('exams').select('*').eq('id', id).single();
    if (!ex) { setLoading(false); return; }

    const { data: sec } = await supabase.from('sections').select('*').eq('id', ex.section_id).single();
    if (sec) {
      const { data: c } = await supabase.from('courses').select('*').eq('id', sec.course_id).single();
      setCourse(c);
    }

    const { data: qs } = await supabase.from('questions').select('*').eq('exam_id', id).order('number');
    const { data: sts } = await supabase.from('students').select('*').eq('section_id', ex.section_id).order('name');
    const { data: ans } = await supabase.from('answers').select('*').eq('exam_id', id);
    const { data: directScores } = await supabase.from('student_scores').select('*').eq('exam_id', id);
    const { data: pl } = await supabase.from('plan_instances').select('id, student_id, token, status').eq('exam_id', id);
    const { data: st } = await supabase.from('user_settings').select('*').maybeSingle();

    setExam(ex);
    setSection(sec);
    setQuestions(qs || []);
    setStudents(sts || []);
    setAnswers(ans || []);
    setScores(directScores || []);
    setPlans(pl || []);
    setThreshold(st?.threshold ?? 60);
    setSkills(st?.skills || []);

    setLoading(false);
  }

  const analysis = useMemo(() => {
    if (!exam) return [];

    if (exam.score_type === 'direct') {
      return analyzeExam({
        mode: 'direct',
        students,
        scores,
        threshold,
        caseStudyThreshold: exam.case_study_threshold ?? 12,
      });
    }

    return analyzeExam({
      mode: 'questions',
      questions,
      students,
      answers,
      threshold,
      caseStudyThreshold: exam.case_study_threshold ?? 12,
    });
  }, [exam, questions, students, answers, scores, threshold]);

  const avg = analysis.length
    ? (analysis.reduce((sum, item) => sum + item.score, 0) / analysis.length).toFixed(1)
    : '0';
  const below = analysis.filter((a) => a.needsPlan).length;

  // -------- استيراد أسئلة --------
  async function importQuestions(file) {
    try {
      const parsed = await parseQuestionsFile(file);
      if (!parsed.length) return toast.error('لم يتم العثور على أسئلة');

      const startNumber = questions.length;
      const rows = parsed.map((q, i) => ({
        exam_id: id,
        number: startNumber + i + 1,
        text: q.text,
        skill: q.skill,
        topic: q.topic,
        correct_answer: q.correct_answer,
        points: q.points,
      }));

      const { error } = await supabase.from('questions').insert(rows);
      if (error) throw error;

      toast.success(`تم استيراد ${rows.length} سؤال`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // -------- إضافة سؤال يدوي --------
  async function saveQuestion(e) {
    e.preventDefault();
    if (!qForm.text.trim() || !qForm.correct_answer.trim())
      return toast.error('أدخلي نص السؤال والإجابة الصحيحة');

    const { error } = await supabase.from('questions').insert({
      exam_id: id,
      number: questions.length + 1,
      text: qForm.text.trim(),
      skill: qForm.skill || skills[0] || 'عام',
      topic: qForm.topic.trim(),
      correct_answer: qForm.correct_answer.trim(),
      points: parseInt(qForm.points) || 1,
    });
    if (error) return toast.error(error.message);

    toast.success('تمت الإضافة');
    setQForm({ text: '', skill: '', topic: '', correct_answer: '', points: 1 });
    setModalQ(false);
    load();
  }

  async function deleteQuestion(qid) {
    if (!confirm('حذف السؤال؟')) return;
    await supabase.from('questions').delete().eq('id', qid);
    load();
  }

  // -------- استيراد إجابات --------
  async function importAnswers(file) {
    try {
      const rows = await parseAnswersFile(file);
      if (rows.length < 2) return toast.error('الملف فارغ');

      const questionsSorted = [...questions].sort((a, b) => a.number - b.number);
      const studentByCode = Object.fromEntries(students.map((s) => [s.code, s]));
      const studentByName = Object.fromEntries(students.map((s) => [s.name.trim(), s]));

      const toInsert = [];
      rows.slice(1).forEach((r, idx) => {
        const identifier = String(r[0] || '').trim();
        const st = studentByCode[identifier] || studentByName[identifier] || students[idx];
        if (!st) return;

        questionsSorted.forEach((q, qi) => {
          const val = String(r[qi + 1] ?? '').trim();
          if (!val) return;
          toInsert.push({
            exam_id: id,
            student_id: st.id,
            question_id: q.id,
            answer: val,
          });
        });
      });

      if (!toInsert.length) return toast.error('لا توجد إجابات صالحة');

      // حذف الإجابات القديمة لهذا الاختبار فقط بعد التأكد من صحة البيانات الجديدة
      await supabase.from('answers').delete().eq('exam_id', id);

      // إدخال على دفعات
      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500);
        const { error } = await supabase.from('answers').insert(chunk);
        if (error) throw error;
      }

      toast.success(`تم استيراد ${toInsert.length} إجابة`);
      setModalA(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // -------- توليد إجابات تجريبية --------
  async function genDemoAnswers() {
    if (!questions.length || !students.length) return toast.error('أضيفي أسئلة ومتدربات أولاً');

    await supabase.from('answers').delete().eq('exam_id', id);

    const opts = ['أ', 'ب', 'ج', 'د'];
    const rows = [];
    students.forEach((st, si) => {
      const prob = si < students.length / 2 ? 0.5 : 0.85;
      questions.forEach((q) => {
        const ok = Math.random() < prob;
        const ans = ok
          ? q.correct_answer
          : opts.filter((x) => x !== q.correct_answer)[Math.floor(Math.random() * 3)] || 'أ';
        rows.push({ exam_id: id, student_id: st.id, question_id: q.id, answer: ans });
      });
    });

    const { error } = await supabase.from('answers').insert(rows);
    if (error) return toast.error(error.message);

    toast.success('تم توليد إجابات تجريبية');
    setModalA(false);
    load();
  }

  // -------- إنشاء خطة --------
  async function createPlan(studentId) {
    const row = analysis.find((a) => a.student.id === studentId);
    if (!row) return;

    const existingPlan = plans.find((plan) => plan.student_id === studentId);
    if (existingPlan) {
      navigate(`/plans/${existingPlan.id}`);
      return;
    }

    if (!course?.id) return toast.error('تعذر تحديد المقرر لهذا الاختبار');
    const { data: template, error: templateError } = await supabase
      .from('plan_templates')
      .select('id, questions, is_published')
      .eq('course_id', course.id)
      .maybeSingle();
    if (templateError) return toast.error(templateError.message);
    if (!template?.is_published || !Array.isArray(template.questions) || !template.questions.length) {
      return toast.error('احفظي وانشري نموذج الدعم للمقرر أولاً');
    }

    const { data, error } = await supabase
      .from('plan_instances')
      .insert({
        template_id: template.id,
        student_id: studentId,
        exam_id: id,
        score: row.score,
        max_score: row.total || exam.max_score,
        status: 'pending',
      })
      .select()
      .single();

    if (error?.code === '23505') {
      const { data: duplicate } = await supabase
        .from('plan_instances')
        .select('id, student_id, token, status')
        .eq('template_id', template.id)
        .eq('student_id', studentId)
        .eq('exam_id', id)
        .single();
      if (duplicate) {
        setPlans((current) => [...current, duplicate]);
        navigate(`/plans/${duplicate.id}`);
        return;
      }
    }
    if (error) return toast.error(error.message);
    setPlans((current) => [...current, data]);
    toast.success('تم إنشاء الخطة');
    navigate(`/plans/${data.id}`);
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;
  if (!exam) return <div className="card p-6">الاختبار غير موجود</div>;

  return (
    <div>
      <PageHeader
        title={exam.name}
        subtitle={`${course?.name || ''} · ${section?.name || ''}`}
        backTo={`/section/${exam.section_id}`}
        backLabel="العودة للشعبة"
        action={
          exam.score_type === 'direct' ? null : (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setModalQ(true)} className="btn-ghost text-sm">
                <Plus size={14} /> الأسئلة ({questions.length})
              </button>
              <button onClick={() => setModalA(true)} className="btn-ghost text-sm">
                استيراد الإجابات
              </button>
            </div>
          )
        }
      />

      {exam.score_type !== 'direct' && questions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="أضيفي أسئلة الاختبار أولاً"
          description="كل سؤال يحتاج: النص، المهارة، الإجابة الصحيحة، والدرجة."
          action={
            <button onClick={() => setModalQ(true)} className="btn-primary">
              <Plus size={16} /> إضافة أسئلة
            </button>
          }
        />
      ) : (
        <>
          {/* إحصاءات */}
          <div className={`grid grid-cols-2 ${exam.score_type === 'direct' ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-3 mb-6`}>
            <StatCard value={analysis.length} label="عدد المتدربات" />
            <StatCard value={below} label="بحاجة دعم" color="red" />
            <StatCard value={`${avg} / ${exam.max_score}`} label="متوسط الدرجات" color="green" />
            {exam.score_type !== 'direct' && <StatCard value={questions.length} label="عدد الأسئلة" />}
          </div>

          {/* الجدول */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="flex items-center gap-2 font-bold"><BarChart3 size={18} className="text-brand-600" /> نتائج التحليل</h3>
              {exam.score_type !== 'direct' && answers.length === 0 && (
                <button onClick={() => setModalA(true)} className="btn-gold text-xs">
                  <Sparkles size={14} /> استيراد الإجابات للتحليل
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>اسم المتدربة</th>
                    <th>الدرجة</th>
                    <th>المستوى</th>
                    {exam.score_type !== 'direct' && <th>المهارات الضعيفة</th>}
                    <th>الخطة</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.map((r) => {
                    const lvl = levelOf(r.pct, threshold);
                    const plan = r.needsPlan ? plans.find((p) => p.student_id === r.student.id) : null;

                    return (
                      <tr key={r.student.id}>
                        <td>
                          <div className="font-semibold">{r.student.name}</div>
                          {r.student.code && (
                            <div className="text-xs text-slate-400">{r.student.code}</div>
                          )}
                        </td>
                        <td>
                          <span className="font-black" style={{ color: lvl.color }}>
                            {r.score} / {r.total}
                          </span>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{ background: `${lvl.color}20`, color: lvl.color }}
                          >
                            {lvl.emoji} {lvl.label}
                          </span>
                        </td>
                        {exam.score_type !== 'direct' && <td>
                          {r.weakSkills.length ? (
                            <div className="flex flex-wrap gap-1">
                              {r.weakSkills.map((w) => (
                                <span key={w.skill} className="badge bg-red-50 text-red-600">
                                  {w.skill} {w.pct}%
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-emerald-600 text-sm font-semibold">— قوية</span>
                          )}
                        </td>}
                        <td>
                          {plan ? (
                            <button
                              onClick={() => navigate(`/plans/${plan.id}`)}
                              className="badge bg-brand-50 text-brand-700 hover:bg-brand-100"
                            >
                              <HeartPulse size={12} /> فتح الخطة
                            </button>
                          ) : r.needsPlan ? (
                            <button
                              onClick={() => createPlan(r.student.id)}
                              className="btn-gold text-xs"
                            >
                              <HeartPulse size={14} /> إنشاء خطة
                            </button>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal: الأسئلة */}
      <Modal
        open={modalQ}
        onClose={() => setModalQ(false)}
        title="أسئلة الاختبار"
        size="lg"
      >
        <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-500">
            صيغة الملف: <b>الرقم · النص · المهارة · الموضوع · الإجابة · الدرجة</b>
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadQuestionsTemplate}
              className="text-brand-600 hover:underline text-xs font-semibold"
            >
              <span className="inline-flex items-center gap-1"><Download size={14} /> تحميل القالب</span>
            </button>
            <FileUploadButton
              onFile={importQuestions}
              label="استيراد Excel"
              className="btn-ghost text-xs"
            />
          </div>
        </div>

        <form onSubmit={saveQuestion} className="grid md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl mb-5">
          <div className="md:col-span-2">
            <label className="label">نص السؤال</label>
            <input
              className="input"
              value={qForm.text}
              onChange={(e) => setQForm({ ...qForm, text: e.target.value })}
              placeholder="اكتبي نص السؤال"
            />
          </div>
          <div>
            <label className="label">المهارة</label>
            <select
              className="input"
              value={qForm.skill}
              onChange={(e) => setQForm({ ...qForm, skill: e.target.value })}
            >
              <option value="">— اختاري —</option>
              {skills.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">الموضوع</label>
            <input
              className="input"
              value={qForm.topic}
              onChange={(e) => setQForm({ ...qForm, topic: e.target.value })}
              placeholder="مثال: الجبر"
            />
          </div>
          <div>
            <label className="label">الإجابة الصحيحة</label>
            <input
              className="input"
              value={qForm.correct_answer}
              onChange={(e) => setQForm({ ...qForm, correct_answer: e.target.value })}
              placeholder="مثال: أ"
            />
          </div>
          <div>
            <label className="label">الدرجة</label>
            <input
              type="number"
              min="1"
              className="input"
              value={qForm.points}
              onChange={(e) => setQForm({ ...qForm, points: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary w-full">
              <Plus size={14} /> إضافة السؤال
            </button>
          </div>
        </form>

        <div className="max-h-64 overflow-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>#</th>
                <th>السؤال</th>
                <th>المهارة</th>
                <th>الإجابة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>{q.number}</td>
                  <td className="text-sm max-w-xs truncate">{q.text}</td>
                  <td className="text-xs">{q.skill}</td>
                  <td className="text-xs">{q.correct_answer}</td>
                  <td className="text-left">
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="text-red-500 text-xs hover:bg-red-50 px-2 py-1 rounded"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Modal: الإجابات */}
      <Modal
        open={modalA}
        onClose={() => setModalA(false)}
        title="استيراد إجابات المتدربات"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm">
            <p className="font-semibold text-brand-800 mb-2">صيغة الملف المطلوبة:</p>
            <p className="text-brand-700 text-xs leading-relaxed">
              العمود الأول = <b>رقم/اسم المتدربة</b>، ثم عمود لكل سؤال (بترتيب رقم السؤال) ويحوي
              إجابة المتدربة.
            </p>
            <div className="text-[11px] text-brand-600 mt-2 dir-ltr font-mono">
              | code | Q1 | Q2 | Q3 | ... |
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <FileUploadButton
              onFile={importAnswers}
              label="اختاري ملف Excel / CSV"
              className="btn-primary"
            />
            <button onClick={genDemoAnswers} className="btn-ghost">
              <Sparkles size={14} /> توليد إجابات تجريبية
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}