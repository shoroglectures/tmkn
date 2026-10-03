import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Plus, Eye, Save, Send, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

function buildBlankQuestions() {
  return [
    {
      id: crypto.randomUUID(),
      text: '',
      options: [
        { id: crypto.randomUUID(), text: '', response: '', url: '' },
        { id: crypto.randomUUID(), text: '', response: '', url: '' },
      ],
    },
  ];
}

export default function CoursePlan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [questions, setQuestions] = useState(buildBlankQuestions());
  const [generalResponse, setGeneralResponse] = useState('');
  const [problems, setProblems] = useState([]);
  const [remedialActions, setRemedialActions] = useState([]);
  const [headerUrl, setHeaderUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadTemplate() {
    try {
      setLoading(true);
      const [{ data: templateRows }, { data: problemRows }, { data: actionRows }, { data: settings }] = await Promise.all([
        supabase.from('plan_templates').select('*').eq('course_id', id).order('created_at'),
        supabase.from('problem_library').select('id, category, text').order('created_at'),
        supabase.from('remedial_actions').select('id, category, title, description').order('created_at'),
        supabase.from('user_settings').select('header_url').maybeSingle(),
      ]);

      setProblems(problemRows || []);
      setRemedialActions(actionRows || []);
      setHeaderUrl(settings?.header_url || '');
      setTemplates(templateRows || []);

      if (templateRows?.length) {
        loadTemplateIntoEditor(templateRows[0]);
      } else {
        setTemplateId(null);
        setSelectedTemplateId('');
        setTemplateTitle('');
        setIsPublished(false);
        setQuestions(buildBlankQuestions());
        setGeneralResponse('');
      }
    } catch (err) {
      toast.error(err.message || 'تعذر تحميل النموذج');
    } finally {
      setLoading(false);
    }
  }

  function loadTemplateIntoEditor(template) {
    setTemplateId(template.id);
    setSelectedTemplateId(template.id);
    setTemplateTitle(template.title || '');
    setIsPublished(Boolean(template.is_published));
    setQuestions(Array.isArray(template.questions) && template.questions.length ? template.questions : buildBlankQuestions());
    setGeneralResponse(template.footer_message || '');
  }

  function startNewTemplate() {
    setTemplateId(null);
    setSelectedTemplateId('');
    setTemplateTitle('');
    setIsPublished(false);
    setQuestions(buildBlankQuestions());
    setGeneralResponse('');
  }

  const addQuestion = () => {
    setQuestions((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        text: '',
        options: [
          { id: crypto.randomUUID(), text: '', response: '', url: '' },
          { id: crypto.randomUUID(), text: '', response: '', url: '' },
        ],
      },
    ]);
  };

  const addOption = (questionIndex) => {
    setQuestions((current) =>
      current.map((q, index) =>
        index === questionIndex
          ? {
              ...q,
              options: [...q.options, { id: crypto.randomUUID(), text: '', response: '', url: '' }],
            }
          : q
      )
    );
  };

  const addProblemOption = (questionIndex, problemId) => {
    const problem = problems.find((item) => item.id === problemId);
    if (!problem) return;
    setQuestions((current) => current.map((question, index) => (
      index === questionIndex
        ? { ...question, options: [...question.options, { id: crypto.randomUUID(), text: problem.text, response: '', url: '' }] }
        : question
    )));
  };

  const updateQuestion = (questionIndex, field, value) => {
    setQuestions((current) =>
      current.map((q, index) => (index === questionIndex ? { ...q, [field]: value } : q))
    );
  };

  const updateOption = (questionIndex, optionIndex, field, value) => {
    setQuestions((current) =>
      current.map((q, index) => {
        if (index !== questionIndex) return q;
        return {
          ...q,
          options: q.options.map((opt, i) =>
            i === optionIndex ? { ...opt, [field]: value } : opt
          ),
        };
      })
    );
  };

  const preview = useMemo(
    () => ({
      questionsCount: questions.length,
      optionsCount: questions.reduce((sum, q) => sum + q.options.length, 0),
      hasGeneralResponse: Boolean(generalResponse.trim()),
    }),
    [questions, generalResponse]
  );

  const handleSave = async (publish = false) => {
    if (!questions.length) {
      toast.error('أضيفي سؤالاً واحداً على الأقل');
      return;
    }
    if (!templateTitle.trim()) {
      toast.error('أدخلي اسمًا يميز نموذج الدعم');
      return;
    }
    if (!questions.every((q) => q.text.trim())) {
      toast.error('أدخلي نص كل سؤال قبل الحفظ');
      return;
    }
    if (questions.some((question) => !question.options.length || question.options.some((option) => !option.text.trim()))) {
      toast.error('أضيفي نصاً لكل خيار قبل الحفظ');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        course_id: id,
        title: templateTitle.trim(),
        questions,
        footer_message: generalResponse,
        is_published: publish || isPublished,
      };

      const query = templateId
        ? supabase.from('plan_templates').update(payload).eq('id', templateId)
        : supabase.from('plan_templates').insert([payload]);

      const { data, error } = await query.select().single();
      if (error) throw error;

      setTemplateId(data.id);
      setSelectedTemplateId(data.id);
      setTemplates((current) => [
        ...current.filter((template) => template.id !== data.id),
        data,
      ].sort((first, second) => new Date(first.created_at) - new Date(second.created_at)));
      setIsPublished(Boolean(data.is_published));
      toast.success(publish ? 'تم حفظ النموذج ونشره' : 'تم حفظ النموذج');
    } catch (err) {
      toast.error(err.code === '23505' || err.message?.includes('plan_templates_course_id_key')
        ? 'قاعدة البيانات ما زالت تمنع أكثر من نموذج للمقرر. طبّقي الهجرة 005_multiple_course_templates.sql ثم أعيدي المحاولة.'
        : err.message || 'تعذر حفظ النموذج');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="نموذج الدعم التدريبي"
        subtitle="مشترك بين جميع شعب المقرر"
        backTo={returnTo || '/courses'}
        backLabel="العودة للمقررات"
      />

      <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="label">نماذج هذا المقرر</label>
          <select
            className="input"
            value={selectedTemplateId}
            onChange={(event) => {
              if (!event.target.value) return startNewTemplate();
              const selected = templates.find((template) => template.id === event.target.value);
              if (selected) loadTemplateIntoEditor(selected);
            }}
            disabled={loading || saving}
          >
            <option value="">نموذج دعم جديد</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}{template.is_published ? '' : ' · مسودة'}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={startNewTemplate} className="btn-ghost" disabled={loading || saving}>
          <Plus size={14} /> نموذج جديد
        </button>
        <div className="min-w-56 flex-1">
          <label className="label">اسم نموذج الدعم</label>
          <input
            className="input"
            value={templateTitle}
            onChange={(event) => setTemplateTitle(event.target.value)}
            placeholder="مثال: دعم الاختبار الفصلي الثاني"
            disabled={loading || saving}
          />
        </div>
        <div className="pb-2 text-xs text-slate-500">
          {isPublished ? 'منشور' : 'مسودة'}
        </div>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex flex-wrap justify-between gap-3 items-center">
          <div>
            <div className="text-xs text-slate-500">ملخص النموذج</div>
            <div className="font-bold text-lg">{preview.questionsCount} سؤال</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(-1)} className="btn-ghost text-sm">
              <ArrowLeft size={14} /> رجوع
            </button>
            <button onClick={() => handleSave(false)} className="btn-primary text-sm" disabled={saving || loading}>
              <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setPreviewOpen(true)} className="btn-ghost text-sm" disabled={loading}>
              <Eye size={14} /> معاينة
            </button>
            <button onClick={() => handleSave(true)} className="btn-gold text-sm" disabled={saving || loading || isPublished}>
              <Send size={14} /> {isPublished ? 'منشور' : 'نشر'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {questions.map((question, qIndex) => (
          <div key={question.id} className="card p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-bold">السؤال {qIndex + 1}</div>
              <button
                type="button"
                onClick={() => setQuestions((current) => current.filter((_, i) => i !== qIndex))}
                className="text-red-500 text-xs hover:underline"
              >
                حذف السؤال
              </button>
            </div>

            <div className="mb-4">
              <label className="label">نص السؤال</label>
              <textarea
                className="input min-h-[90px]"
                value={question.text}
                onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                placeholder="اكتبي نص السؤال هنا"
              />
            </div>

            <div className="space-y-3">
              {question.options.map((option, optIndex) => (
                <div key={option.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <div className="font-semibold text-xs text-slate-500 mb-2">الخيار {optIndex + 1}</div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <label className="label">عنوان الخيار</label>
                      <input
                        className="input"
                        value={option.text}
                        onChange={(e) => updateOption(qIndex, optIndex, 'text', e.target.value)}
                        placeholder="مثال: نعم"
                      />
                    </div>
                    <div>
                      <label className="label">الخطة التحسينية</label>
                      <input
                        className="input"
                        value={option.response}
                        onChange={(e) => updateOption(qIndex, optIndex, 'response', e.target.value)}
                        placeholder="الإجراء المناسب لهذه العبارة"
                      />
                      {remedialActions.length > 0 && (
                        <select
                          className="input mt-2 text-sm"
                          value=""
                          onChange={(event) => {
                            const action = remedialActions.find((item) => item.id === event.target.value);
                            if (!action) return;
                            const response = [action.title, action.description].filter(Boolean).join(': ');
                            updateOption(qIndex, optIndex, 'response', response);
                          }}
                        >
                          <option value="">إضافة إجراء محفوظ من الإعدادات</option>
                          {remedialActions.map((action) => (
                            <option key={action.id} value={action.id}>
                              {action.category ? `${action.category} · ` : ''}{action.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="label">رابط</label>
                      <input
                        className="input"
                        value={option.url}
                        onChange={(e) => updateOption(qIndex, optIndex, 'url', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <div className="flex flex-wrap justify-end gap-2">
                {problems.length > 0 && (
                  <select
                    className="input max-w-xs text-sm"
                    value=""
                    onChange={(event) => addProblemOption(qIndex, event.target.value)}
                  >
                    <option value="">إضافة عبارة محفوظة من الإعدادات</option>
                    {problems.map((problem) => (
                      <option key={problem.id} value={problem.id}>
                        {problem.category ? `${problem.category} · ` : ''}{problem.text}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" onClick={() => addOption(qIndex)} className="btn-ghost text-sm">
                  <Plus size={14} /> إضافة خيار
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="card p-5">
          <div className="flex justify-between items-center mb-3">
            <div className="font-bold">الخطة التحسينية العامة</div>
          </div>
          <textarea
            className="input min-h-[100px]"
            value={generalResponse}
            onChange={(e) => setGeneralResponse(e.target.value)}
            placeholder="اكتبي ردّاً عاماً في نهاية النموذج"
          />
        </div>

        <div className="flex justify-between gap-3 flex-wrap">
          <button type="button" onClick={addQuestion} className="btn-primary">
            <Plus size={16} /> إضافة سؤال
          </button>
          <div className="text-xs text-slate-500">
            أسئلة: {preview.questionsCount} · خيارات: {preview.optionsCount}
          </div>
        </div>
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="معاينة نموذج المتدربة" size="lg">
        <div className="space-y-5">
          {headerUrl && <img src={headerUrl} alt="ترويسة التقرير" className="max-h-24 max-w-full object-contain mx-auto" />}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">اسم المتدربة</div><div className="font-bold">مثال: سارة أحمد</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">الرقم التدريبي</div><div className="font-bold">مثال: 10001</div></div>
          </div>
          {questions.map((question, questionIndex) => (
            <div key={question.id} className="border-t border-slate-200 pt-4">
              <h3 className="mb-3 font-bold">{questionIndex + 1}. {question.text || 'سؤال جديد'}</h3>
              <div className="space-y-2">
                {question.options.map((option) => (
                  <div key={option.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <input type="checkbox" disabled className="h-4 w-4" />
                    <span>{option.text || 'خيار جديد'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {generalResponse && <div className="border-t border-slate-200 pt-4"><div className="font-bold">الخطة التحسينية العامة</div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{generalResponse}</p></div>}
        </div>
      </Modal>
    </div>
  );
}

