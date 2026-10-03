import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, ExternalLink, FileDown, CheckCircle2, Clock3, Send, CircleAlert, Link2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { fmtDate } from '../utils/format';
import PageHeader from '../components/PageHeader';

export default function PlanDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [plan, setPlan] = useState(null);
  const [student, setStudent] = useState(null);
  const [exam, setExam] = useState(null);
  const [template, setTemplate] = useState(null);
  const [reportSettings, setReportSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const { data: p } = await supabase
        .from('plan_instances')
        .select('*')
        .eq('id', id)
        .single();

      if (!p) {
        setPlan(null);
        setLoading(false);
        return;
      }

      const [{ data: st }, { data: ex }, { data: tpl }, { data: settings }] = await Promise.all([
        supabase.from('students').select('*').eq('id', p.student_id).single(),
        supabase.from('exams').select('*').eq('id', p.exam_id).single(),
        supabase.from('plan_templates').select('*').eq('id', p.template_id).maybeSingle(),
        supabase.from('user_settings').select('header_url, signature_url').maybeSingle(),
      ]);

      setStudent(st);
      setExam(ex);
      setTemplate(tpl);
      setReportSettings(settings);
      setPlan(p);
    } catch (err) {
      console.error(err);
      toast.error('تعذر تحميل الخطة');
    } finally {
      setLoading(false);
    }
  }

  async function exportPDF() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const { exportElementAsPDF } = await import('../utils/pdf');
      const fileName = 'plan-' + (student?.name || id) + '.pdf';
      await exportElementAsPDF(cardRef.current, fileName);
      toast.success('تم تجهيز الملف');
    } catch (err) {
      toast.error('تعذر التصدير');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;
  if (!plan) return <div className="card p-6">الخطة غير موجودة</div>;

  const shareUrl = window.location.origin + '/plan/' + plan.token;
  const questions = Array.isArray(template?.questions) ? template.questions : [];
  const answers = Array.isArray(plan.student_answers) ? plan.student_answers : [];
  const generalAnswer = answers.find((item) => item.general_answer)?.general_answer || '';

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => toast.success('تم نسخ الرابط'));
  }

  const statusInfo = {
    pending: { Icon: Clock3, label: 'بانتظار المتدربة', color: '#f59e0b' },
    submitted: { Icon: Send, label: 'تم الإرسال', color: '#3b82f6' },
    expired: { Icon: CircleAlert, label: 'منتهي', color: '#ef4444' },
  }[plan.status] || { Icon: Clock3, label: 'بانتظار', color: '#f59e0b' };
  const StatusIcon = statusInfo.Icon;

  return (
    <div>
      <PageHeader
        title={'خطة: ' + (student?.name || '—')}
        subtitle={exam?.name}
        backTo="/plans"
        backLabel="العودة للخطط"
        action={
          <div className="flex gap-2">
            <span
              className="badge self-center"
              style={{ background: statusInfo.color + '20', color: statusInfo.color }}
            >
              <StatusIcon size={14} strokeWidth={2} /> {statusInfo.label}
            </span>
            <button onClick={exportPDF} className="btn-primary" disabled={exporting}>
              <FileDown size={16} />
              {exporting ? 'جاري...' : 'تصدير PDF'}
            </button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div>
          <div ref={cardRef} className="card p-7 bg-white">
            {reportSettings?.header_url && (
              <img crossOrigin="anonymous" src={reportSettings.header_url} alt="ترويسة التقرير" className="max-h-28 max-w-full object-contain mx-auto mb-5" />
            )}
            <div className="flex justify-between items-start pb-4 mb-5 border-b border-slate-200">
              <div>
                <div className="text-xs font-bold text-brand-600 mb-1">
                  تمكن بلس · مسار التمكّن التدريبي
                </div>
                <h2 className="text-2xl font-black">خطة دعم تدريبية</h2>
              </div>
              <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                <QRCodeSVG value={shareUrl} size={90} level="M" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
              <div>
                <div className="text-slate-500 text-xs">اسم المتدربة</div>
                <div className="font-bold">{student?.name || '—'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">الرقم التدريبي</div>
                <div className="font-bold">{student?.code || '—'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">مصدر الدرجة</div>
                <div className="font-bold">{exam?.name || '—'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">الدرجة</div>
                <div className="font-black text-red-500">{plan.score ?? 0} / {plan.max_score ?? exam?.max_score ?? '—'}</div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {questions.map((question, qIndex) => {
                const saved = answers.find((item) => item.question_id === question.id) || {};
                const selected = saved.selected || [];
                return (
                  <div key={question.id || qIndex} className="border border-slate-200 rounded-xl p-4">
                    <div className="font-bold mb-2">{qIndex + 1}. {question.text}</div>
                    <div className="space-y-2">
                      {(question.options || []).map((option) => (
                        <div key={option.id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span>{option.text}</span>
                            <span className="text-xs text-slate-500">{selected.includes(option.id) ? 'محددة' : 'غير محددة'}</span>
                          </div>
                          {option.response && selected.includes(option.id) && <div className="mt-2 text-sm text-slate-600">الخطة التحسينية: {option.response}</div>}
                          {option.url && selected.includes(option.id) && (
                            <a href={option.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-brand-700 underline">
                              رابط المساندة
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {template?.footer_message && (
              <div className="mb-5 rounded-lg border border-brand-100 bg-brand-50 p-4">
                <div className="mb-1 font-bold">الخطة التحسينية العامة</div>
                <div className="whitespace-pre-wrap text-sm text-slate-700">{template.footer_message}</div>
              </div>
            )}

            {generalAnswer && (
              <div className="space-y-3 text-sm bg-slate-50 p-5 rounded-xl">
                  <Field label="ملاحظات المتدربة" value={generalAnswer} />
              </div>
            )}

            {plan.submitted_at && (
              <div className="mt-5 flex items-center gap-2 bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm">
                <CheckCircle2 size={18} />
                <span>تم تقديم الخطة بتاريخ {fmtDate(plan.submitted_at)}</span>
              </div>
            )}
            {(profile?.full_name || reportSettings?.signature_url) && (
              <div className="mt-8 border-t border-slate-200 pt-4 text-sm">
                <div className="font-bold">المدربة: {profile?.full_name || '—'}</div>
                {reportSettings?.signature_url && (
                  <img crossOrigin="anonymous" src={reportSettings.signature_url} alt="توقيع المدربة" className="mt-2 max-h-20 max-w-48 object-contain" />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Link2 size={16} className="text-brand-600" /> رابط المتدربة (QR)</h3>
            <p className="text-xs text-slate-500 mb-3">
              أرسلي هذا الرابط أو الرمز للمتدربة لتعبئة خطتها واعتمادها.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                readOnly
                value={shareUrl}
                className="input text-xs"
                onFocus={(e) => e.target.select()}
              />
              <button onClick={copyLink} className="btn-ghost px-3" title="نسخ">
                <Copy size={16} />
              </button>
            </div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full text-sm"
            >
              <ExternalLink size={14} /> فتح بوابة المتدربة
            </a>
          </div>

          <div className="card p-5 bg-gradient-to-br from-brand-50 to-white">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold"><Smartphone size={16} className="text-brand-600" /> كيف تستخدم المتدربة الرمز؟</h4>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
              <li>تصوّر رمز QR بكاميرا الجوال</li>
              <li>يفتح الرابط تلقائياً في المتصفح</li>
              <li>تطّلع على تحليلها ومهاراتها الضعيفة</li>
              <li>تكتب أهدافها وخطتها وتوافق</li>
              <li>تحفظ نسخة PDF لنفسها</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-slate-500 text-xs mb-1">{label}</div>
      <div className="whitespace-pre-wrap font-medium">
        {value || <span className="text-slate-400">— بانتظار تعبئة المتدربة —</span>}
      </div>
    </div>
  );
}