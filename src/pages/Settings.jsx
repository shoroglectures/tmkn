import { useEffect, useState } from 'react';
import {
  Save,
  Plus,
  Trash2,
  Settings2,
  Mail,
  MessageSquareText,
  Stethoscope,
  UserRound,
  Gauge,
  FileWarning,
  TrendingUp,
  BrainCircuit,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

const DEFAULT_SKILLS = [
  'فهم المفاهيم',
  'حل المسائل',
  'قراءة الجداول',
  'التطبيق العملي',
  'التحليل والاستنتاج',
  'الحفظ والتذكر',
];

export default function Settings() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [threshold, setThreshold] = useState(60);
  const [caseThreshold, setCaseThreshold] = useState(12);
  const [improvementTarget, setImprovementTarget] = useState(35);
  const [skillsText, setSkillsText] = useState(DEFAULT_SKILLS.join('\n'));
  const [headerUrl, setHeaderUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState('');
  const [emailSubjectPrefix, setEmailSubjectPrefix] = useState('خطة تحسينية لمقرر');
  const [emailBody, setEmailBody] = useState('عزيزتي {student_name},\n\nهذا رابط خطة الدعم التدريبية الخاصة بك:\n{plan_link}\n\nمع تمنياتنا لك بالتوفيق،\n{trainer_name}');

  const [problems, setProblems] = useState([]);
  const [actions, setActions] = useState([]);
  const [modalProblem, setModalProblem] = useState(false);
  const [modalAction, setModalAction] = useState(false);
  const [problemForm, setProblemForm] = useState({ category: 'تدريبي', text: '' });
  const [actionForm, setActionForm] = useState({ category: 'تدريب', title: '', description: '' });

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  async function load() {
    setLoading(true);

    const { data: settings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settings) {
      setThreshold(settings.threshold ?? 60);
      setCaseThreshold(settings.case_study_threshold ?? 12);
      setImprovementTarget(settings.improvement_target ?? 35);
      setSkillsText((settings.skills || DEFAULT_SKILLS).join('\n'));
      setHeaderUrl(settings.header_url || '');
      setSignatureUrl(settings.signature_url || '');
    }

    const { data: emailTemplate } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (emailTemplate) {
      setEmailSubjectPrefix(
        (emailTemplate.subject || 'خطة تحسينية لمقرر {course_name}')
          .replaceAll('{course_name}', '')
          .trimEnd() || 'خطة تحسينية لمقرر'
      );
      setEmailBody(emailTemplate.body || 'عزيزتي {student_name},\n\nهذا رابط خطة الدعم التدريبية الخاصة بك:\n{plan_link}\n\nمع تمنياتنا لك بالتوفيق،\n{trainer_name}');
    }

    setFullName(profile?.full_name || '');

    const { data: probs } = await supabase
      .from('problem_library')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at');

    const { data: acts } = await supabase
      .from('remedial_actions')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at');

    setProblems(probs || []);
    setActions(acts || []);
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    try {
      const skills = skillsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            threshold: Number(threshold) || 60,
            case_study_threshold: Number(caseThreshold) || 12,
            improvement_target: Number(improvementTarget) || 35,
            skills,
            header_url: headerUrl || null,
            signature_url: signatureUrl || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      const { error: emailError } = await supabase
        .from('email_templates')
        .upsert(
          {
            user_id: user.id,
            subject: `${emailSubjectPrefix.trimEnd() || 'خطة تحسينية لمقرر'} {course_name}`,
            body: emailBody.trim() || 'عزيزتي {student_name},\n\nهذا رابط خطة الدعم التدريبية الخاصة بك:\n{plan_link}\n\nمع تمنياتنا لك بالتوفيق،\n{trainer_name}',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (emailError) throw emailError;

      if (fullName.trim()) {
        await supabase
          .from('profiles')
          .update({ full_name: fullName.trim() })
          .eq('id', user.id);
      }

      toast.success('تم حفظ الإعدادات');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadReportAsset(field, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('اختاري ملف صورة');
    if (file.size > 5 * 1024 * 1024) return toast.error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');

    setUploadingAsset(field);
    let uploadedPath;
    try {
      const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      uploadedPath = `${user.id}/${field}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('trainer-assets')
        .upload(uploadedPath, file, { contentType: file.type, cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from('trainer-assets').getPublicUrl(uploadedPath).data.publicUrl;
      const { error: saveError } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, [field]: publicUrl }, { onConflict: 'user_id' });
      if (saveError) throw saveError;

      if (field === 'header_url') setHeaderUrl(publicUrl);
      else setSignatureUrl(publicUrl);
      toast.success('تم رفع الصورة وحفظها');
    } catch (error) {
      if (uploadedPath) await supabase.storage.from('trainer-assets').remove([uploadedPath]);
      toast.error(error.message?.includes('Bucket not found')
        ? 'مخزن الصور غير موجود. طبّقي الهجرة 006_report_assets_bucket.sql على Supabase ثم أعيدي المحاولة.'
        : error.message?.includes('header_url') || error.message?.includes('signature_url')
          ? 'أعمدة صور التقرير غير موجودة. طبّقي الهجرة 006_report_assets_bucket.sql على Supabase ثم أعيدي المحاولة.'
        : error.message || 'تعذر رفع الصورة');
    } finally {
      setUploadingAsset('');
    }
  }

  async function removeReportAsset(field) {
    const currentUrl = field === 'header_url' ? headerUrl : signatureUrl;
    const marker = '/trainer-assets/';
    const storagePath = currentUrl.includes(marker) ? currentUrl.split(marker)[1] : null;
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, [field]: null }, { onConflict: 'user_id' });
    if (error) return toast.error(error.message);
    if (storagePath) await supabase.storage.from('trainer-assets').remove([decodeURIComponent(storagePath)]);
    if (field === 'header_url') setHeaderUrl('');
    else setSignatureUrl('');
    toast.success('تم حذف الصورة');
  }

  function isProtectedTokenEdit(field, action, key = '') {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    return [...emailBody.matchAll(/\{[a-z_]+\}/gi)].some((match) => {
      const token = match[0];
      const index = match.index ?? 0;
      const tokenEnd = index + token.length;
      if (start < tokenEnd && end > index) return true;
      if (start !== end) return false;
      if (action === 'backspace' || key === 'Backspace') return start > index && start <= tokenEnd;
      if (action === 'delete' || key === 'Delete') return start >= index && start < tokenEnd;
      return (action === 'insert' || action === 'paste') && start > index && start < tokenEnd;
    });
  }

  async function saveProblem(e) {
    e.preventDefault();
    if (!problemForm.text.trim()) return toast.error('اكتبي نص العبارة');

    const { error } = await supabase.from('problem_library').insert({
      user_id: user.id,
      category: problemForm.category,
      text: problemForm.text.trim(),
      is_default: false,
    });

    if (error) return toast.error(error.message);

    toast.success('تمت الإضافة');
    setModalProblem(false);
    setProblemForm({ category: 'تدريبي', text: '' });
    load();
  }

  async function deleteProblem(id) {
    if (!confirm('حذف العبارة؟')) return;
    await supabase.from('problem_library').delete().eq('id', id);
    toast.success('تم الحذف');
    load();
  }

  async function saveAction(e) {
    e.preventDefault();
    if (!actionForm.title.trim()) return toast.error('اكتبي عنوان الإجراء');

    const { error } = await supabase.from('remedial_actions').insert({
      user_id: user.id,
      category: actionForm.category,
      title: actionForm.title.trim(),
      description: actionForm.description.trim() || null,
      is_default: false,
    });

    if (error) return toast.error(error.message);

    toast.success('تمت الإضافة');
    setModalAction(false);
    setActionForm({ category: 'تدريب', title: '', description: '' });
    load();
  }

  async function deleteAction(id) {
    if (!confirm('حذف الإجراء؟')) return;
    await supabase.from('remedial_actions').delete().eq('id', id);
    toast.success('تم الحذف');
    load();
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="ضبط النظام والمكتبات" />

      <div className="flex gap-2 mb-5 border-b border-slate-200">
        {[
          { key: 'general', label: 'عام', hint: 'الملف والعتبات', Icon: Settings2 },
          { key: 'email', label: 'البريد', hint: 'قالب الرسالة', Icon: Mail },
          { key: 'problems', label: 'العبارات', hint: String(problems.length), Icon: MessageSquareText },
          { key: 'actions', label: 'الإجراءات', hint: String(actions.length), Icon: Stethoscope },
        ].map(({ key, label, hint, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 -mb-px font-semibold text-sm border-b-2 transition ${
              tab === key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="inline-flex items-center gap-2"><Icon size={16} strokeWidth={1.8} />{label}</span>
            <span className="text-xs text-slate-400 ml-1">{hint}</span>
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="space-y-5 max-w-2xl">
          <div className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold"><UserRound size={18} className="text-brand-600" /> الملف الشخصي</h3>
            <div className="space-y-4">
              <div>
                <label className="label">الاسم الكامل</label>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">البريد الإلكتروني</label>
                <input className="input bg-slate-50" value={user?.email || ''} disabled />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-1 font-bold">ترويسة التقرير وتوقيع المدربة</h3>
            <p className="mb-4 text-xs text-slate-500">تظهر الترويسة في نموذج المتدربة والتقرير، ويظهر التوقيع في نهاية التقرير.</p>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3">
                <label className="label">صورة الترويسة</label>
                {headerUrl && <img src={headerUrl} alt="معاينة الترويسة" className="max-h-24 max-w-full object-contain border border-slate-200 p-2" />}
                <input
                  type="file"
                  accept="image/*"
                  className="input text-sm"
                  aria-label="رفع صورة الترويسة"
                  disabled={uploadingAsset === 'header_url'}
                  onChange={(event) => uploadReportAsset('header_url', event.target.files?.[0])}
                />
                {headerUrl && <button type="button" onClick={() => removeReportAsset('header_url')} className="text-xs text-red-600 hover:underline">إزالة الترويسة</button>}
              </div>
              <div className="space-y-3">
                <label className="label">توقيع المدربة</label>
                {signatureUrl && <img src={signatureUrl} alt="معاينة التوقيع" className="max-h-20 max-w-48 object-contain border border-slate-200 p-2" />}
                <input
                  type="file"
                  accept="image/*"
                  className="input text-sm"
                  aria-label="رفع توقيع المدربة"
                  disabled={uploadingAsset === 'signature_url'}
                  onChange={(event) => uploadReportAsset('signature_url', event.target.files?.[0])}
                />
                {signatureUrl && <button type="button" onClick={() => removeReportAsset('signature_url')} className="text-xs text-red-600 hover:underline">إزالة التوقيع</button>}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-1 flex items-center gap-2 font-bold"><Gauge size={18} className="text-brand-600" /> الخطة الداعمة (%)</h3>
            <p className="text-xs text-slate-500 mb-4">
              المتدربة التي تقل درجتها عن هذه النسبة تحتاج خطة دعم فردية.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="100"
                className="input w-24"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <span className="font-bold text-slate-500">%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="flex-1 accent-brand-600"
              />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-1 flex items-center gap-2 font-bold"><FileWarning size={18} className="text-brand-600" /> دراسة الحالة (بالدرجة)</h3>
            <p className="text-xs text-slate-500 mb-4">
              المتدربة التي تقل درجتها عن هذا الرقم تحتاج دراسة حالة.
              <br />
              <span className="inline-flex items-start gap-1 text-amber-600">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                تستخدم هذه الدرجة افتراضياً لتحديد الحاجة إلى دراسة حالة.
              </span>
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="100"
                className="input w-24"
                value={caseThreshold}
                onChange={(e) => setCaseThreshold(e.target.value)}
              />
              <span className="text-slate-500 text-sm">درجة (افتراضي)</span>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-1 flex items-center gap-2 font-bold"><TrendingUp size={18} className="text-brand-600" /> هدف التحسن للمقرر (%)</h3>
            <p className="text-xs text-slate-500 mb-4">
              مؤشر قياس التحسن بين مصادر الدرجات — افتراضي 35%.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="100"
                className="input w-24"
                value={improvementTarget}
                onChange={(e) => setImprovementTarget(e.target.value)}
              />
              <span className="font-bold text-slate-500">%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={improvementTarget}
                onChange={(e) => setImprovementTarget(e.target.value)}
                className="flex-1 accent-brand-600"
              />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-1 flex items-center gap-2 font-bold"><BrainCircuit size={18} className="text-brand-600" /> قائمة المهارات</h3>
            <p className="text-xs text-slate-500 mb-4">كل سطر = مهارة</p>
            <textarea
              rows={8}
              className="input font-mono text-sm"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
            />
          </div>

          <button onClick={save} className="btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      )}

      {tab === 'email' && (
        <div className="max-w-2xl space-y-5">
          <div className="card p-6">
            <h3 className="mb-1 flex items-center gap-2 font-bold"><Mail size={18} className="text-brand-600" /> قالب البريد الإلكتروني</h3>
            <p className="text-xs text-slate-500 mb-4">
              يمكنك استخدام المتغيرات: {'{student_name}'}, {'{student_code}'}, {'{course_name}'}, {'{section_name}'}, {'{trainer_name}'}, {'{plan_link}'}
            </p>

            <div className="space-y-4">
              <div>
                <label className="label">عنوان الرسالة</label>
                <div className="input flex items-center gap-2 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
                  <input
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0"
                    value={emailSubjectPrefix}
                    onChange={(e) => setEmailSubjectPrefix(e.target.value)}
                  />
                  <span className="template-token" dir="ltr">{'{course_name}'}</span>
                </div>
              </div>

              <div>
                <label className="label">نص الرسالة</label>
                <textarea
                  rows={8}
                  className="input"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  onKeyDown={(event) => {
                    const key = event.key;
                    const modifiesValue = key === 'Backspace'
                      || key === 'Delete'
                      || key === 'Enter'
                      || (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey);
                    if (!modifiesValue) return;
                    const blocked = isProtectedTokenEdit(
                      event.currentTarget,
                      key === 'Backspace' ? 'backspace' : key === 'Delete' ? 'delete' : 'insert',
                      key
                    );
                    if (blocked) {
                      event.preventDefault();
                      toast.error('متغيرات قالب الرسالة ثابتة ولا يمكن حذفها');
                    }
                  }}
                  onCut={(event) => {
                    if (isProtectedTokenEdit(event.currentTarget, 'cut')) {
                      event.preventDefault();
                      toast.error('متغيرات قالب الرسالة ثابتة ولا يمكن حذفها');
                    }
                  }}
                  onPaste={(event) => {
                    if (isProtectedTokenEdit(event.currentTarget, 'paste')) {
                      event.preventDefault();
                      toast.error('لا يمكن استبدال متغيرات قالب الرسالة الثابتة');
                    }
                  }}
                  onBeforeInput={(event) => {
                    const field = event.currentTarget;
                    const inputType = event.nativeEvent.inputType || '';
                    const action = inputType === 'deleteContentBackward'
                      ? 'backspace'
                      : inputType.startsWith('delete')
                        ? 'delete'
                        : inputType.startsWith('insert')
                          ? 'insert'
                          : '';
                    const touchesToken = action && isProtectedTokenEdit(field, action);
                    if (touchesToken) {
                      event.preventDefault();
                      toast.error('متغيرات قالب الرسالة ثابتة ولا يمكن حذفها');
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <button onClick={save} className="btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? 'جاري الحفظ...' : 'حفظ قالب البريد'}
          </button>
        </div>
      )}

      {tab === 'problems' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold"><MessageSquareText size={18} className="text-brand-600" /> مكتبة العبارات</h3>
              <p className="text-xs text-slate-500">
                {problems.filter((p) => p.is_default).length} افتراضية ·{' '}
                {problems.filter((p) => !p.is_default).length} مخصصة
              </p>
            </div>
            <button onClick={() => setModalProblem(true)} className="btn-primary">
              <Plus size={16} /> إضافة عبارة
            </button>
          </div>

          <div className="card divide-y divide-slate-100">
            {problems.map((p) => (
              <div key={p.id} className="p-4 flex items-start gap-3">
                <span
                  className={`badge ${
                    p.is_default ? 'bg-slate-100 text-slate-600' : 'bg-brand-50 text-brand-700'
                  }`}
                >
                  {p.category}
                </span>
                <span className="flex-1 text-sm">{p.text}</span>
                {!p.is_default && (
                  <button
                    onClick={() => deleteProblem(p.id)}
                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {problems.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-sm">لا توجد عبارات</div>
            )}
          </div>
        </div>
      )}

      {tab === 'actions' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold"><Stethoscope size={18} className="text-brand-600" /> مكتبة الإجراءات التدريبية</h3>
              <p className="text-xs text-slate-500">
                {actions.filter((a) => a.is_default).length} افتراضية ·{' '}
                {actions.filter((a) => !a.is_default).length} مخصصة
              </p>
            </div>
            <button onClick={() => setModalAction(true)} className="btn-primary">
              <Plus size={16} /> إضافة إجراء
            </button>
          </div>

          <div className="card divide-y divide-slate-100">
            {actions.map((a) => (
              <div key={a.id} className="p-4 flex items-start gap-3">
                <span
                  className={`badge ${
                    a.is_default ? 'bg-slate-100 text-slate-600' : 'bg-brand-50 text-brand-700'
                  }`}
                >
                  {a.category}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{a.title}</div>
                  {a.description && (
                    <div className="text-xs text-slate-500 mt-0.5">{a.description}</div>
                  )}
                </div>
                {!a.is_default && (
                  <button
                    onClick={() => deleteAction(a.id)}
                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {actions.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-sm">لا توجد إجراءات</div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={modalProblem}
        onClose={() => setModalProblem(false)}
        title="عبارة جديدة"
        size="md"
      >
        <form onSubmit={saveProblem} className="space-y-4">
          <div>
            <label className="label">التصنيف</label>
            <select
              className="input"
              value={problemForm.category}
              onChange={(e) => setProblemForm({ ...problemForm, category: e.target.value })}
            >
              <option>تدريبي</option>
              <option>سلوكي</option>
              <option>نفسي</option>
              <option>صحي</option>
              <option>غير تدريبي</option>
            </select>
          </div>
          <div>
            <label className="label">نص العبارة</label>
            <textarea
              rows={3}
              className="input"
              value={problemForm.text}
              onChange={(e) => setProblemForm({ ...problemForm, text: e.target.value })}
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">
              حفظ
            </button>
            <button type="button" onClick={() => setModalProblem(false)} className="btn-ghost">
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modalAction}
        onClose={() => setModalAction(false)}
        title="إجراء تدريبي جديد"
        size="md"
      >
        <form onSubmit={saveAction} className="space-y-4">
          <div>
            <label className="label">التصنيف</label>
            <select
              className="input"
              value={actionForm.category}
              onChange={(e) => setActionForm({ ...actionForm, category: e.target.value })}
            >
              <option>تدريب</option>
              <option>تحفيز</option>
              <option>إرشاد</option>
              <option>متابعة</option>
            </select>
          </div>
          <div>
            <label className="label">العنوان</label>
            <input
              className="input"
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="label">الوصف (اختياري)</label>
            <textarea
              rows={2}
              className="input"
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">
              حفظ
            </button>
            <button type="button" onClick={() => setModalAction(false)} className="btn-ghost">
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}