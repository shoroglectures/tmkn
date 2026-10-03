import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Lock, ShieldCheck, FileDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DateTimeBar from '../components/DateTimeBar';
import { fmtDate } from '../utils/format';

export default function StudentPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [generalAnswer, setGeneralAnswer] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadPortal() {
    try {
      setLoading(true);
      setError('');

      const { data: payload, error: rpcError } = await supabase.rpc('get_plan_instance_by_token', { p_token: token });
      if (rpcError) throw rpcError;

      if (!payload?.instance) {
        setData(null);
        return;
      }

      const template = payload.template || { questions: [] };
      const questions = Array.isArray(template.questions) ? template.questions : [];
      const savedAnswers = Array.isArray(payload.instance.student_answers) ? payload.instance.student_answers : [];
      const map = new Map(savedAnswers.map((item) => [item.question_id, item]));

      setData({
        instance: payload.instance,
        student: payload.student,
        course: payload.course,
        section: payload.section,
        exam: payload.exam,
        trainer: payload.trainer,
        template,
        questions,
      });

      setAnswers(
        questions.map((question, idx) => ({
          question_id: question.id || String(idx),
          selected: map.get(question.id || String(idx))?.selected || [],
        }))
      );

      const general = savedAnswers.find((item) => item.general_answer);
      setGeneralAnswer(general?.general_answer || '');
      setConsent(Boolean(payload.instance.status === 'submitted'));
    } catch (err) {
      console.error(err);
      setData(null);
      setError(err.message || 'تعذر تحميل الرابط');
    } finally {
      setLoading(false);
    }
  }

  const isSubmitted = data?.instance?.status === 'submitted';
  const isExpired = data ? new Date(data.instance.expires_at) < new Date() : false;

  const questions = useMemo(() => data?.questions || [], [data]);

  const toggleOption = (questionIndex, optionId) => {
    setAnswers((current) =>
      current.map((entry, idx) => {
        if (idx !== questionIndex) return entry;
        const selected = entry.selected || [];
        return {
          ...entry,
          selected: selected.includes(optionId)
            ? selected.filter((value) => value !== optionId)
            : [...selected, optionId],
        };
      })
    );
  };

  async function submitPlan() {
    if (!consent) {
      toast.error('يجب الموافقة قبل التقديم');
      return;
    }

    if (isExpired || !data?.instance) {
      toast.error('انتهت صلاحية الرابط');
      return;
    }

    try {
      setSubmitting(true);
      const payload = [
        ...answers.map((entry) => ({
          question_id: entry.question_id,
          selected: entry.selected || [],
        })),
        { general_answer: generalAnswer },
      ];

      const { error: submitError } = await supabase.rpc('submit_plan_instance', {
        p_token: token,
        p_answers: payload,
      });

      if (submitError) throw submitError;

      toast.success('تم تقديم الخطة بنجاح');
      await loadPortal();
    } catch (err) {
      toast.error(err.message || 'تعذر تقديم الخطة');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <DateTimeBar className="px-4" />
        <div className="min-h-[calc(100vh-3.5rem)] grid place-items-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100">
        <DateTimeBar className="px-4" />
        <div className="min-h-[calc(100vh-3.5rem)] grid place-items-center p-4">
          <div className="card p-8 text-center max-w-md">
            <Lock className="mx-auto text-slate-400 mb-3" size={48} />
            <h1 className="text-xl font-black mb-2">الرابط غير صالح</h1>
            <p className="text-slate-500 text-sm">تأكد من الرابط أو اطلب من المدربة إعادة إرساله.</p>
          </div>
        </div>
      </div>
    );
  }

  const { student, course, section, exam, instance } = data;

  if (isSubmitted || isExpired) {
    return (
      <div className="min-h-screen bg-slate-100 p-4">
        <DateTimeBar className="max-w-4xl mx-auto mb-4" />
        <div className="max-w-4xl mx-auto">
          <div className="card p-5 mb-4 print-header no-print">
            <div className="flex justify-between items-center gap-3">
              <div>
                <div className="text-xs text-slate-500">تمكن بلس</div>
                <h1 className="font-black text-xl">تقرير خطة الدعم التدريبية</h1>
              </div>
              <button onClick={() => window.print()} className="btn-primary no-print"><FileDown size={16} /> تحميل PDF</button>
            </div>
          </div>

          <div className="card p-6">
            <ReportHeader trainer={data.trainer} />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              <InfoCell label="اسم المتدربة" value={student?.name} />
              <InfoCell label="الرقم التدريبي" value={student?.code} />
              <InfoCell label="المقرر" value={course?.name} />
              <InfoCell label="الشعبة" value={section?.name} />
              <InfoCell label="الدرجة" value={instance.score == null ? '—' : `${instance.score} / ${instance.max_score}`} />
            </div>

            {data.template.footer_message && (
              <div className="mb-5 rounded-lg border border-brand-100 bg-brand-50 p-4">
                <div className="mb-1 font-bold">الخطة التحسينية العامة</div>
                <div className="whitespace-pre-wrap text-sm text-slate-700">{data.template.footer_message}</div>
              </div>
            )}

            {questions.map((question, qIndex) => {
              const saved = (instance.student_answers || []).find((item) => item.question_id === question.id) || {};
              const selected = saved.selected || [];
              return (
                <div key={question.id || qIndex} className="border border-slate-200 rounded-xl p-4 mb-4">
                  <div className="font-bold mb-2">{qIndex + 1}. {question.text}</div>
                  <div className="space-y-2">
                    {(question.options || []).map((option) => (
                      <div key={option.id} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                        <div className="flex items-center justify-between gap-3">
                          <span>{option.text}</span>
                          <span className="text-xs text-slate-500">
                            {selected.includes(option.id) ? 'محددة' : 'غير محددة'}
                          </span>
                        </div>
                        {option.response && selected.includes(option.id) && (
                          <div className="mt-2 text-sm text-slate-600">الخطة التحسينية: {option.response}</div>
                        )}
                        {isSubmitted && option.url && selected.includes(option.id) && (
                          <a href={option.url} target="_blank" rel="noreferrer" className="link-button mt-2">رابط المساندة</a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="border border-slate-200 rounded-xl p-4 mt-5">
              <div className="font-bold mb-2">ملاحظات المتدربة</div>
              <div className="whitespace-pre-wrap text-slate-700">{generalAnswer || '—'}</div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                تاريخ التقديم: {instance.submitted_at ? fmtDate(instance.submitted_at) : '—'}
              </div>
              <ShieldCheck className="text-emerald-600" />
            </div>
            <TrainerSignature trainer={data.trainer} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <DateTimeBar className="max-w-4xl mx-auto mb-4" />
      <div className="max-w-4xl mx-auto">
        <div className="card p-5 mb-4 no-print">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div>
              {data.trainer?.header_url && (
                <img crossOrigin="anonymous" src={data.trainer.header_url} alt="ترويسة التقرير" className="max-h-24 max-w-full object-contain mb-3" />
              )}
              <div className="text-xs text-slate-500">تمكن بلس</div>
              <h1 className="font-black text-xl">خطة الدعم التدريبية</h1>
            </div>
            {data?.instance?.expires_at && (
              <div className="text-xs text-slate-500">
                ينتهي الرابط: {fmtDate(data.instance.expires_at)}
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <InfoCell label="اسم المتدربة" value={student?.name} />
            <InfoCell label="الرقم التدريبي" value={student?.code} />
            <InfoCell label="المقرر" value={course?.name} />
            <InfoCell label="الشعبة" value={section?.name} />
            <InfoCell label="الدرجة" value={instance.score == null ? '—' : `${instance.score} / ${instance.max_score}`} />
          </div>

          {data.template.footer_message && (
            <div className="mb-5 rounded-lg border border-brand-100 bg-brand-50 p-4">
              <div className="mb-1 font-bold">الخطة التحسينية العامة</div>
              <div className="whitespace-pre-wrap text-sm text-slate-700">{data.template.footer_message}</div>
            </div>
          )}

          {questions.map((question, qIndex) => (
            <div key={question.id || qIndex} className="border border-slate-200 rounded-xl p-4 mb-4">
              <div className="font-bold mb-3">{qIndex + 1}. {question.text}</div>
              <div className="space-y-2">
                {(question.options || []).map((option) => (
                  <label key={option.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={Boolean((answers[qIndex]?.selected || []).includes(option.id))}
                      onChange={() => toggleOption(qIndex, option.id)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="flex-1">{option.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-5">
            <label className="label">ملاحظات المتدربة</label>
            <textarea
              className="input min-h-[110px]"
              value={generalAnswer}
              onChange={(e) => setGeneralAnswer(e.target.value)}
              placeholder="اكتبي ردّك العام هنا"
            />
          </div>

          <label className="flex items-center gap-3 mt-5">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            <span className="text-sm text-slate-700">أقر بأنني أوافق على تعبئة الاستبيان والتزامي بالخطة</span>
          </label>

          <button
            onClick={submitPlan}
            disabled={submitting || isExpired}
            className="btn-primary w-full mt-6"
          >
            {submitting ? 'جاري التقديم...' : isExpired ? 'انتهت صلاحية الرابط' : 'تقديم'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="bg-slate-50 p-3 rounded-xl">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="font-bold text-sm">{value || '—'}</div>
    </div>
  );
}

function ReportHeader({ trainer }) {
  if (!trainer?.header_url) return null;
  return (
    <div className="mb-5">
      <img crossOrigin="anonymous" src={trainer.header_url} alt="ترويسة التقرير" className="max-h-28 max-w-full object-contain mx-auto" />
    </div>
  );
}

function TrainerSignature({ trainer }) {
  if (!trainer?.signature_url && !trainer?.name) return null;
  return (
    <div className="mt-8 border-t border-slate-200 pt-4 text-sm">
      <div className="font-bold">المدربة: {trainer.name || '—'}</div>
      {trainer.signature_url && (
        <img crossOrigin="anonymous" src={trainer.signature_url} alt="توقيع المدربة" className="mt-2 max-h-20 max-w-48 object-contain" />
      )}
    </div>
  );
}
