import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ClipboardList,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Copy,
  Users,
  AlertTriangle,
  BarChart3,
  FileText,
  Mail,
  Info,
  Download,
  Clock3,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { parseStudentsFile, downloadStudentsTemplate } from '../utils/excel';
import { parseBlackboardFile, suggestColumnMapping } from '../utils/blackboard-parser';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import FileUploadButton from '../components/FileUploadButton';
const scoreTypeLabels = {
  exam1: 'مصدر 1',
  exam2: 'مصدر 2',
  final: 'درجة نهائية',
  total_100: 'المجموع من 100',
  total_60: 'المجموع من 60',
  project: 'مشروع',
  assignment: 'واجب',
  practice: 'تدريب',
  other: 'درجة أخرى',
};

export default function Section() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const [section, setSection] = useState(null);
  const [course, setCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [scoreSources, setScoreSources] = useState([]);
  const [allScoreEntries, setAllScoreEntries] = useState([]);
  const [selectedScoreSourceId, setSelectedScoreSourceId] = useState('');
  const [scoreEntries, setScoreEntries] = useState([]);
  const [supportThreshold, setSupportThreshold] = useState(60);
  const [activeTab, setActiveTab] = useState('students');
  const [loading, setLoading] = useState(true);

  const [modalStudent, setModalStudent] = useState(false);
  const [modalBB, setModalBB] = useState(false);
  const [modalExam, setModalExam] = useState(false);

  const [studentForm, setStudentForm] = useState({ name: '', code: '', email: '' });
  const [examForm, setExamForm] = useState({ name: '', maxScore: '20' });
  const [supportRows, setSupportRows] = useState([]);
  const [supportGenerating, setSupportGenerating] = useState(false);
  const [supportRowsLoading, setSupportRowsLoading] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedSupportTemplateId, setSelectedSupportTemplateId] = useState('');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templatePickerSelection, setTemplatePickerSelection] = useState('');
  const [generatedTemplateCounts, setGeneratedTemplateCounts] = useState({});

  // استيراد Blackboard
  const [bbData, setBbData] = useState(null); // { students, scoreColumns, metadata }
  const [bbSelected, setBbSelected] = useState({}); // { colName: true/false }
  const [bbImporting, setBbImporting] = useState(false);

  const selectedScoreSource = scoreSources.find((source) => source.id === selectedScoreSourceId)
    || scoreSources[0]
    || null;

  const strugglingStudents = useMemo(() => students.filter((student) => {
    const entry = scoreEntries.find((score) => score.student_id === student.id);
    return entry && Number(entry.max_score) > 0
      && (Number(entry.score || 0) / Number(entry.max_score)) * 100 < supportThreshold;
  }), [students, scoreEntries, supportThreshold]);

  useEffect(() => {
    if (!selectedScoreSource?.id) {
      setScoreEntries([]);
      return;
    }

    let cancelled = false;
    supabase
      .from('student_scores')
      .select('student_id, score, max_score')
      .eq('exam_id', selectedScoreSource.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
          setScoreEntries([]);
          return;
        }
        setScoreEntries(data || []);
      });

    return () => { cancelled = true; };
  }, [selectedScoreSource?.id]);

  useEffect(() => {
    if (!course?.id || !selectedScoreSource?.id) {
      setAvailableTemplates([]);
      setSelectedSupportTemplateId('');
      setGeneratedTemplateCounts({});
      setSupportRows([]);
      return;
    }

    let cancelled = false;
    async function loadTemplatesForExam() {
      const [{ data: templates, error: templateError }, { data: instances, error: instancesError }] = await Promise.all([
        supabase
        .from('plan_templates')
        .select('id, title, is_published')
        .eq('course_id', course.id)
        .eq('is_published', true)
        .order('created_at'),
        supabase
          .from('plan_instances')
          .select('template_id')
          .eq('exam_id', selectedScoreSource.id),
      ]);

      if (templateError) {
        if (!cancelled) toast.error(templateError.message);
        return;
      }
      if (instancesError) {
        if (!cancelled) toast.error(instancesError.message);
        return;
      }

      if (!cancelled) {
        const counts = (instances || []).reduce((result, instance) => {
          if (!strugglingStudents.some((student) => student.id === instance.student_id)) return result;
          result[instance.template_id] = (result[instance.template_id] || 0) + 1;
          return result;
        }, {});
        setAvailableTemplates(templates || []);
        setGeneratedTemplateCounts(counts);
        setSelectedSupportTemplateId((current) => (
          templates?.some((template) => template.id === current)
            ? current
            : templates?.find((template) => counts[template.id])?.id || templates?.[0]?.id || ''
        ));
      }
    }

    loadTemplatesForExam();
    return () => { cancelled = true; };
  }, [course?.id, selectedScoreSource?.id, strugglingStudents]);

  useEffect(() => {
    if (!selectedSupportTemplateId || !selectedScoreSource?.id || !scoreEntries.length) {
      setSupportRows([]);
      setSupportRowsLoading(false);
      return;
    }

    let cancelled = false;
    async function loadExistingSupportRows() {
      setSupportRowsLoading(true);
      const { data: instances, error } = await supabase
        .from('plan_instances')
        .select('*')
        .eq('template_id', selectedSupportTemplateId)
        .eq('exam_id', selectedScoreSource.id);

      if (error) {
        if (!cancelled) toast.error(error.message);
        setSupportRowsLoading(false);
        return;
      }

      if (!cancelled) {
        const atRiskIds = new Set(strugglingStudents.map((student) => student.id));
        const studentMap = new Map(students.map((student) => [student.id, student]));
        setSupportRows((instances || [])
          .filter((instance) => atRiskIds.has(instance.student_id))
          .map((instance) => {
            const student = studentMap.get(instance.student_id);
            return {
              id: instance.id,
              student_id: instance.student_id,
              token: instance.token,
              student_name: student?.name || 'المتدربة',
              student_code: student?.code || '—',
              student_email: student?.email || '',
              score: instance.score,
              max_score: instance.max_score,
              status: instance.status,
              url: `${window.location.origin}/plan/${instance.token}`,
            };
          }));
      }
      setSupportRowsLoading(false);
    }

    loadExistingSupportRows();
    return () => { cancelled = true; };
  }, [selectedSupportTemplateId, selectedScoreSource?.id, scoreEntries, students, strugglingStudents]);

  const summaryStats = useMemo(() => {
    const scored = scoreEntries.filter((entry) => Number(entry.max_score) > 0);
    const percentages = scored.map((entry) =>
      Math.max(0, Math.min(100, Math.round((Number(entry.score || 0) / Number(entry.max_score)) * 100)))
    );
    const total = students.length;
    const avgScore = scored.length
      ? (scored.reduce((sum, entry) => sum + Number(entry.score || 0), 0) / scored.length).toFixed(1)
      : '0';
    const atRisk = percentages.filter((percentage) => percentage < supportThreshold).length;
    return {
      total,
      avgScore,
      atRisk,
      rate: percentages.length ? Math.round((atRisk / percentages.length) * 100) : 0,
    };
  }, [students, scoreEntries, supportThreshold]);

  const scoreDistribution = useMemo(() => {
    const rows = scoreEntries
      .filter((entry) => Number(entry.max_score) > 0)
      .map((entry) => Math.max(0, Math.min(100, Math.round((Number(entry.score || 0) / Number(entry.max_score)) * 100))));
    return [
      { name: 'متقدم', value: rows.filter((score) => score >= 90).length },
      { name: 'متقن', value: rows.filter((score) => score >= 80 && score < 90).length },
      { name: 'محقق', value: rows.filter((score) => score >= supportThreshold && score < 80).length },
      { name: 'بحاجة دعم', value: rows.filter((score) => score < supportThreshold).length },
    ];
  }, [scoreEntries, supportThreshold]);

  const tabs = [
    { key: 'students', label: 'المتدربات', icon: Users },
    { key: 'strugglers', label: 'المتعثرات', icon: AlertTriangle },
    { key: 'stats', label: 'الإحصائيات', icon: BarChart3 },
  ];

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  async function load() {
    setLoading(true);
    const { data: sec } = await supabase.from('sections').select('*').eq('id', id).single();
    if (sec) {
      const { data: c } = await supabase.from('courses').select('*').eq('id', sec.course_id).single();
      setCourse(c);
    }
    const { data: sts } = await supabase.from('students').select('*').eq('section_id', id).order('name');
    const { data: sources } = await supabase
      .from('exams')
      .select('*')
      .eq('section_id', id)
      .eq('score_type', 'direct')
      .order('created_at', { ascending: false });
    const sourceIds = (sources || []).map((source) => source.id);
    const { data: allScores } = sourceIds.length
      ? await supabase
        .from('student_scores')
        .select('exam_id, student_id, score, max_score')
        .in('exam_id', sourceIds)
      : { data: [] };
    const { data: settings } = await supabase
      .from('user_settings')
      .select('threshold')
      .maybeSingle();
    setSection(sec);
    setStudents(sts || []);
    setScoreSources(sources || []);
    setAllScoreEntries(allScores || []);
    setSelectedScoreSourceId((current) =>
      sources?.some((source) => source.id === current) ? current : sources?.[0]?.id || ''
    );
    setSupportThreshold(Number(settings?.threshold) || 60);
    setLoading(false);
  }

  // ─── الاستيراد اليدوي (قديم — يبقى للاستخدام البسيط) ───
  async function importStudentsManual(file) {
    try {
      const parsed = await parseStudentsFile(file);
      if (!parsed.length) return toast.error('الملف فارغ');
      const rows = parsed.map((s) => ({
        section_id: id,
        name: s.name,
        code: s.code || null,
        email: s.email || null,
      }));
      const { error } = await supabase.from('students').insert(rows);
      if (error) throw error;
      toast.success(`تم استيراد ${rows.length} متدربة`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // ─── استيراد Blackboard ───
  async function handleBlackboardFile(file) {
    try {
      const data = await parseBlackboardFile(file);
      if (!data.students.length) return toast.error('لم يتم العثور على متدربات');

      const suggested = suggestColumnMapping(data.scoreColumns);
      const selected = {};
      data.scoreColumns.forEach((col) => {
        // نُفعّل الأعمدة التي تعرّف عليها النظام فقط
        selected[col.name] = ['exam1', 'exam2', 'final', 'total_100'].includes(col.type);
      });

      setBbData({ ...data, suggested });
      setBbSelected(selected);
      setModalBB(true);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'تعذر قراءة الملف');
    }
  }

  async function confirmBlackboardImport() {
    if (!bbData) return;
    const selectedCols = bbData.scoreColumns.filter((c) => bbSelected[c.name]);

    if (!selectedCols.length) {
      return toast.error('اختاري عموداً واحداً على الأقل');
    }

    setBbImporting(true);
    try {
      // 1) أنشئ أو اربط المتدربات
      const existingByCode = Object.fromEntries(
        students.filter((s) => s.code).map((s) => [s.code, s])
      );

      const toInsert = [];
      const studentMap = {}; // code → id (قديم أو جديد)

      bbData.students.forEach((st) => {
        if (existingByCode[st.code]) {
          studentMap[st.code] = existingByCode[st.code].id;
        } else {
          toInsert.push({
            section_id: id,
            name: st.name,
            code: st.code,
            email: null,
          });
          studentMap[st.code] = null; // سيُعبّأ بعد الإدراج
        }
      });

      if (toInsert.length) {
        const { data: inserted, error } = await supabase
          .from('students')
          .insert(toInsert)
          .select();
        if (error) throw error;
        inserted.forEach((s) => {
          if (s.code) studentMap[s.code] = s.id;
        });
      }

      // 2) أنشئ اختباراً لكل عمود مختار
      for (const col of selectedCols) {
        // تحقّق: هل يوجد اختبار بنفس الاسم؟
        let examId;
        const existing = scoreSources.find((source) => source.name === col.name);

        if (existing) {
          examId = existing.id;
        } else {
          const { data: newExam, error } = await supabase
            .from('exams')
            .insert({
              section_id: id,
              name: col.name,
              max_score: Number(col.maxPoints || 20),
              case_study_threshold: 12,
              score_type: 'direct',
            })
            .select()
            .single();
          if (error) throw error;
          examId = newExam.id;
        }

        const examMaxScore = Number(existing?.max_score || col.maxPoints || 20);
        // Upsert only the selected exam so scores from other exams remain untouched.
        const scoreRows = bbData.students
          .map((st) => {
            const studentId = studentMap[st.code];
            if (!studentId) return null;
            const score = st.scores[col.name] ?? 0;
            return {
              exam_id: examId,
              student_id: studentId,
              score: score,
              max_score: examMaxScore,
            };
          })
          .filter(Boolean);

        if (scoreRows.length) {
          const { error } = await supabase
            .from('student_scores')
            .upsert(scoreRows, { onConflict: 'exam_id,student_id' });
          if (error) throw error;
        }
      }

      // 5) سجّل عملية الاستيراد
      await supabase.from('import_history').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        section_id: id,
        file_name: 'blackboard-import',
        source: 'blackboard',
        students_count: bbData.students.length,
        columns_detected: bbData.scoreColumns,
      });

      toast.success(`تم استيراد ${bbData.students.length} متدربة و ${selectedCols.length} مصدر درجة`);

      setModalBB(false);
      setBbData(null);
      setBbSelected({});
      load();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'فشل الاستيراد');
    } finally {
      setBbImporting(false);
    }
  }

  // ─── إضافة يدوية ───
  async function saveStudent(e) {
    e.preventDefault();
    if (!studentForm.name.trim()) return toast.error('أدخلي اسم المتدربة');
    const { error } = await supabase.from('students').insert({
      section_id: id,
      name: studentForm.name.trim(),
      code: studentForm.code.trim() || null,
      email: studentForm.email.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success('تمت الإضافة');
    setModalStudent(false);
    setStudentForm({ name: '', code: '', email: '' });
    load();
  }

  async function saveExamSource(e) {
    e.preventDefault();
    const name = examForm.name.trim();
    const maxScore = Number(examForm.maxScore);
    if (!name) return toast.error('أدخلي اسم الاختبار');
    if (!Number.isFinite(maxScore) || maxScore <= 0) return toast.error('أدخلي درجة قصوى صحيحة');
    if (scoreSources.some((source) => source.name.trim().toLowerCase() === name.toLowerCase())) {
      return toast.error('يوجد اختبار بهذا الاسم في الشعبة');
    }

    const { data: newExam, error } = await supabase.from('exams').insert({
      section_id: id,
      name,
      max_score: maxScore,
      case_study_threshold: 12,
      score_type: 'direct',
    }).select('id').single();
    if (error) return toast.error(error.message);
    setSelectedScoreSourceId(newExam.id);
    toast.success('تم إنشاء الاختبار');
    setModalExam(false);
    setExamForm({ name: '', maxScore: '20' });
    await load();
  }

  async function deleteStudent(sid) {
    if (!confirm('حذف المتدربة؟')) return;
    await supabase.from('students').delete().eq('id', sid);
    toast.success('تم الحذف');
    load();
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;
  if (!section) return <div className="card p-6">الشعبة غير موجودة</div>;

  async function buildSupportEmail(row, fallbackCourseName = course?.name || 'المقرر') {
    const { data: templateRow } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user?.id)
      .maybeSingle();

    const trainerName = profile?.full_name || 'المدربة';
    const subject = (templateRow?.subject || 'خطة تحسينية لمقرر {course_name}')
      .replace('{student_name}', row.student_name || 'المتدربة')
      .replace('{student_code}', row.student_code || '')
      .replace('{course_name}', fallbackCourseName)
      .replace('{section_name}', section?.name || '')
      .replace('{trainer_name}', trainerName)
      .replace('{plan_link}', row.url || '');

    const body = (templateRow?.body || 'عزيزتي {student_name},\n\nهذا رابط خطة الدعم التدريبية الخاصة بك:\n{plan_link}\n\nمع تمنياتنا لك بالتوفيق،\n{trainer_name}')
      .replace('{student_name}', row.student_name || 'المتدربة')
      .replace('{student_code}', row.student_code || '')
      .replace('{course_name}', fallbackCourseName)
      .replace('{section_name}', section?.name || '')
      .replace('{trainer_name}', trainerName)
      .replace('{plan_link}', row.url || '');

    return {
      subject,
      body,
      mailto: `mailto:${encodeURIComponent(row.student_email || `${row.student_code}@tvtc.gov.sa`)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    };
  }

  async function copySupportLinks(rows) {
    const links = rows.map((row) => row.url).join('\n');
    try {
      await navigator.clipboard.writeText(links);
      toast.success(rows.length === 1 ? 'تم نسخ الرابط' : 'تم نسخ روابط الخطط');
    } catch {
      toast.error('تعذر النسخ؛ تحققي من صلاحية الحافظة في المتصفح');
    }
  }

  function openTemplatePicker() {
    if (!availableTemplates.length) {
      toast.error('أنشئي نموذج دعم وانشريه من صفحة المقرر أولاً');
      return;
    }
    setTemplatePickerSelection(selectedSupportTemplateId || availableTemplates[0].id);
    setTemplatePickerOpen(true);
  }

  async function generateSupportInstances(templateId) {
    if (!course || !students.length) {
      toast.error('أضفِ المتدربات أولاً');
      return;
    }

    const activeExam = selectedScoreSource;
    if (!activeExam || !scoreEntries.length) {
      toast.error('استوردي درجات Blackboard لهذه الشعبة أولاً');
      return;
    }

    setSupportGenerating(true);
    try {
      const { data: template, error: templateError } = await supabase
        .from('plan_templates')
        .select('*')
        .eq('id', templateId)
        .eq('course_id', course.id)
        .maybeSingle();
      if (templateError) throw templateError;
      if (!template || !Array.isArray(template.questions) || template.questions.length === 0) {
        toast.error('أنشئي واحفظي نموذج الدعم من بطاقة المقرر أولاً');
        return;
      }
      if (!template.is_published) {
        toast.error('انشري نموذج الدعم قبل إنشاء الخطط');
        return;
      }

      const { data: scoreRows, error: scoreError } = await supabase
        .from('student_scores')
        .select('student_id, score, max_score')
        .eq('exam_id', activeExam.id);
      if (scoreError) throw scoreError;

      const scoreMap = new Map((scoreRows || []).map((row) => [row.student_id, row]));

      const atRiskStudents = students.filter((student) => {
        const scoreEntry = scoreMap.get(student.id);
        return scoreEntry && Number(scoreEntry.max_score) > 0
          && (Number(scoreEntry.score || 0) / Number(scoreEntry.max_score)) * 100 < supportThreshold;
      });
      if (!atRiskStudents.length) {
        toast.error('لا توجد متدربات متعثرات في هذا الاختبار');
        return;
      }

      const { data: storedInstances, error: storedInstancesError } = await supabase
        .from('plan_instances')
        .select('*')
        .eq('template_id', template.id)
        .eq('exam_id', activeExam.id);
      if (storedInstancesError) throw storedInstancesError;
      const existingByStudent = new Map((storedInstances || []).map((instance) => [instance.student_id, instance]));
      const nextRows = [];
      let createdCount = 0;

      for (const student of atRiskStudents) {
        const scoreEntry = scoreMap.get(student.id);
        const score = Number(scoreEntry?.score || 0);
        const maxScore = Number(scoreEntry?.max_score || activeExam.max_score || 20);
        const existing = existingByStudent.get(student.id);

        if (existing) {
          nextRows.push({
            id: existing.id,
            student_id: student.id,
            token: existing.token,
            student_name: student.name,
            student_code: student.code || '—',
            student_email: student.email || '',
            score: existing.score,
            max_score: existing.max_score,
            status: existing.status,
            url: `${window.location.origin}/plan/${existing.token}`,
          });
          continue;
        }

        const { data: inserted, error } = await supabase
          .from('plan_instances')
          .insert({
            template_id: template.id,
            student_id: student.id,
            exam_id: activeExam.id,
            score,
            max_score: maxScore,
            status: 'pending',
          })
          .select()
          .single();

        if (error?.code === '23505') {
          const { data: duplicate } = await supabase
            .from('plan_instances')
            .select('*')
            .eq('template_id', template.id)
            .eq('student_id', student.id)
            .eq('exam_id', activeExam.id)
            .single();
          if (!duplicate) throw error;
          existingByStudent.set(student.id, duplicate);
          nextRows.push({
            id: duplicate.id,
            student_id: student.id,
            token: duplicate.token,
            student_name: student.name,
            student_code: student.code || '—',
            student_email: student.email || '',
            score: duplicate.score,
            max_score: duplicate.max_score,
            status: duplicate.status,
            url: `${window.location.origin}/plan/${duplicate.token}`,
          });
          continue;
        }
        if (error) throw error;

        createdCount += 1;
        existingByStudent.set(student.id, inserted);
        nextRows.push({
          id: inserted.id,
          token: inserted.token,
          student_name: student.name,
          student_id: student.id,
          student_code: student.code || '—',
          student_email: student.email || '',
          score: inserted.score,
          max_score: inserted.max_score,
          status: inserted.status,
          url: `${window.location.origin}/plan/${inserted.token}`,
        });
      }

      setSupportRows(nextRows);
      setSelectedSupportTemplateId(template.id);
      setGeneratedTemplateCounts((current) => ({
        ...current,
        [template.id]: Math.max(current[template.id] || 0, nextRows.length),
      }));
      toast.success(createdCount
        ? `تم إنشاء ${createdCount} خطة للمتعثرات`
        : 'خطط المتعثرات موجودة مسبقاً');
    } catch (err) {
      toast.error(err.message || 'تعذر إنشاء الخطط');
    } finally {
      setSupportGenerating(false);
    }
  }

  const bbSelectedCount = Object.values(bbSelected).filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title={`${course?.name || ''} · ${section.name}`}
        subtitle="أديري المتدربات واستوردي درجاتهن"
        backTo="/courses"
        backLabel="العودة للمقررات"
      />

      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-bold transition ${
              activeTab === key
                ? 'bg-brand-50 text-brand-700 border border-brand-200 border-b-transparent'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Icon size={16} />
              {label}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'students' && (
        <div className="max-w-5xl">
          <div className="card p-5">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h3 className="font-bold">
                <span className="inline-flex items-center gap-2"><Users size={18} className="text-brand-600" /> المتدربات <span className="text-slate-400">({students.length})</span></span>
              </h3>
              <div className="flex gap-2 flex-wrap">
                <FileUploadButton
                  onFile={handleBlackboardFile}
                  accept=".xlsx,.xls,.csv"
                  label="استيراد Blackboard"
                  className="btn-primary text-sm"
                />
                <FileUploadButton
                  onFile={importStudentsManual}
                  accept=".xlsx,.xls,.csv"
                  label="استيراد بسيط"
                  className="btn-ghost text-sm"
                />
                <button onClick={() => setModalStudent(true)} className="btn-ghost text-sm">
                  <Plus size={14} /> يدوي
                </button>
                <button onClick={() => setModalExam(true)} className="btn-ghost text-sm">
                  <ClipboardList size={14} /> اختبار جديد
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
              <span className="inline-flex items-center gap-1"><Info size={14} className="text-brand-600" /> استيراد Blackboard يجلب الأسماء والدرجات معاً</span>
              <button
                onClick={downloadStudentsTemplate}
                className="text-brand-600 hover:underline font-semibold"
              >
                <span className="inline-flex items-center gap-1"><Download size={14} /> قالب بسيط</span>
              </button>
            </div>

            <div className="max-h-96 overflow-auto">
              {students.length === 0 ? (
                <div className="text-center text-slate-400 py-10 text-sm">
                  لا توجد متدربات بعد — ابدئي باستيراد Blackboard
                </div>
              ) : (
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>اسم المتدربة</th>
                      <th>الرقم التدريبي</th>
                      {scoreSources.map((source) => (
                        <th key={source.id} className="text-center">{source.name}</th>
                      ))}
                      <th className="text-center">المجموع</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td className="font-semibold">{s.name}</td>
                        <td className="text-slate-500 font-mono text-xs">{s.code || '—'}</td>
                        {scoreSources.map((source) => {
                          const entry = allScoreEntries.find((score) =>
                            score.exam_id === source.id && score.student_id === s.id
                          );
                          return (
                            <td key={source.id} className="text-center tabular-nums">
                              {entry ? `${entry.score} / ${entry.max_score}` : '—'}
                            </td>
                          );
                        })}
                        <td className="text-center font-bold tabular-nums">
                          {(() => {
                            const studentScores = allScoreEntries.filter((score) => score.student_id === s.id);
                            if (!studentScores.length) return '—';
                            const totalScore = studentScores.reduce((sum, entry) => sum + Number(entry.score || 0), 0);
                            const totalMax = studentScores.reduce((sum, entry) => sum + Number(entry.max_score || 0), 0);
                            return `${totalScore} / ${totalMax}`;
                          })()}
                        </td>
                        <td className="text-left">
                          <button
                            onClick={() => deleteStudent(s.id)}
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'strugglers' && (
        <div className="card p-5">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold"><AlertTriangle size={18} className="text-amber-600" /> المتدربات المتعثرات</h3>
              <div className="text-xs text-slate-500">اختاري مصدر الدرجات المستورد لتحديد من تحتاج إلى دعم.</div>
                  <div className="text-xs text-slate-500">
                    {selectedScoreSource ? `مصدر الدرجات: ${selectedScoreSource.name}` : 'استوردي الدرجات من Blackboard لتحديد من تحتاج إلى دعم.'}
                  </div>
            </div>
            {scoreSources.length > 1 && (
              <select
                className="input max-w-[260px]"
                value={selectedScoreSource?.id || ''}
                onChange={(event) => {
                  setSelectedScoreSourceId(event.target.value);
                  setSupportRows([]);
                }}
              >
                {scoreSources.map((source) => (
                  <option key={source.id} value={source.id}>{source.name}</option>
                ))}
              </select>
            )}
          </div>

          {!selectedScoreSource ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
              <FileSpreadsheet className="mx-auto mb-2 text-brand-600" size={24} />
              <p className="font-semibold">لا توجد درجات مستوردة لهذه الشعبة</p>
              <p className="mt-1 text-sm text-slate-500">استوردي ملف Blackboard من تبويب المتدربات لعرض الدرجات وإنشاء خطط الدعم.</p>
              <button onClick={() => setActiveTab('students')} className="btn-primary mt-4">
                استيراد درجات Blackboard
              </button>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>اسم المتدربة</th>
                  <th>الرقم التدريبي</th>
                  <th>الدرجة</th>
                  <th>خطة الدعم</th>
                </tr>
              </thead>
              <tbody>
                {students.filter((student) => {
                  const entry = scoreEntries.find((score) => score.student_id === student.id);
                  if (!entry) return false;
                  const percentage = Number(entry.max_score) > 0
                    ? (Number(entry.score || 0) / Number(entry.max_score)) * 100
                    : 0;
                  return percentage < supportThreshold;
                }).map((student) => {
                  const entry = scoreEntries.find((score) => score.student_id === student.id);
                  const plan = supportRows.find((row) => row.student_id === student.id);
                  return (
                    <tr key={student.id}>
                      <td className="font-semibold">{student.name}</td>
                      <td className="text-slate-500 font-mono text-xs">{student.code || '—'}</td>
                      <td className="font-bold text-red-600">{entry.score} / {entry.max_score}</td>
                      <td>
                        {plan ? (
                          <span className="badge bg-emerald-50 text-emerald-700"><CheckCircle2 size={13} /> {plan.status === 'submitted' ? 'تم الإرسال' : 'تم الإنشاء'}</span>
                        ) : (
                          <span className="text-xs text-slate-400">لم تُنشأ بعد</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {scoreEntries.length > 0 && !students.some((student) => {
                  const entry = scoreEntries.find((score) => score.student_id === student.id);
                  return entry && Number(entry.max_score) > 0
                    && (Number(entry.score || 0) / Number(entry.max_score)) * 100 < supportThreshold;
                }) && (
                  <tr><td colSpan="4" className="py-8 text-center text-slate-400">لا توجد متدربات متعثرات في هذا الاختبار.</td></tr>
                )}
                {scoreEntries.length === 0 && (
                  <tr><td colSpan="4" className="py-8 text-center text-slate-400">لا توجد درجات في مصدر البيانات هذا.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          )}

          {selectedScoreSource && scoreEntries.length > 0 && <div className="mt-5 space-y-4">
            <div className="flex justify-end">
              <button
                onClick={openTemplatePicker}
                className="btn-primary"
                disabled={supportGenerating || supportRowsLoading || !strugglingStudents.length}
              >
                <FileText size={16} />
                {!strugglingStudents.length ? 'لا توجد متعثرات' : generatedTemplateCounts[selectedSupportTemplateId] ? 'اختيار نموذج / عرض الخطط' : 'إنشاء خطط بنموذج'}
              </button>
            </div>

            {supportRowsLoading && <div className="py-3 text-center text-sm text-slate-500">جاري تحميل الخطط الموجودة...</div>}
            {supportRows.length > 0 && (
              <div className="space-y-3">
                {supportRows.map((row) => (
                  <div key={row.id} className="border border-slate-200 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <div className="font-semibold">{row.student_name}</div>
                      <div className="text-xs text-slate-500">{row.student_code}</div>
                    </div>
                    <div className="font-bold text-red-600">{row.score} / {row.max_score}</div>
                    <button onClick={() => copySupportLinks([row])} className="btn-ghost text-xs inline-flex items-center gap-1">
                      <Copy size={14} /> نسخ الرابط
                    </button>
                    <button
                      onClick={async () => {
                        const payload = await buildSupportEmail(row, course?.name || 'المقرر');
                        window.location.href = payload.mailto;
                      }}
                      className="btn-gold text-xs"
                    >
                      <Mail size={14} /> إرسال
                    </button>
                  </div>
                ))}
                <div className="flex justify-end">
                  <button onClick={() => copySupportLinks(supportRows)} className="btn-primary inline-flex items-center gap-2">
                    <Copy size={16} /> نسخ روابط الكل
                  </button>
                </div>
              </div>
            )}
          </div>}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-5">
          {scoreSources.length > 1 && (
            <div className="flex items-center justify-end gap-3">
              <label htmlFor="stats-score-source" className="text-sm text-slate-600">الاختبار المحتسب</label>
              <select
                id="stats-score-source"
                className="input max-w-[260px]"
                value={selectedScoreSource?.id || ''}
                onChange={(event) => setSelectedScoreSourceId(event.target.value)}
              >
                {scoreSources.map((source) => (
                  <option key={source.id} value={source.id}>{source.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid md:grid-cols-4 gap-3">
            <div className="card p-4 text-center">
              <div className="text-2xl font-black text-brand-700">{summaryStats.total}</div>
              <div className="text-xs text-slate-500">عدد المتدربات</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-black text-green-600">{summaryStats.avgScore}</div>
              <div className="text-xs text-slate-500">متوسط الدرجات</div>
              <div className="text-[11px] text-slate-400">من {scoreEntries[0]?.max_score || selectedScoreSource?.max_score || '—'}</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-black text-red-600">{summaryStats.atRisk}</div>
              <div className="text-xs text-slate-500">عدد المتعثرات</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-black text-amber-600">{summaryStats.rate}%</div>
              <div className="text-xs text-slate-500">نسبة التعثر</div>
            </div>
          </div>

          <div className="grid xl:grid-cols-2 gap-5">
            <div className="card p-5">
              <h4 className="font-bold mb-4">توزيع الدرجات المستوردة</h4>
              <div className="space-y-4">
                {scoreDistribution.map((group) => {
                  const percentage = scoreEntries.length
                    ? Math.round((group.value / scoreEntries.length) * 100)
                    : 0;
                  return (
                    <div key={group.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{group.name}</span>
                        <span className="font-semibold text-slate-600">{group.value} · {percentage}%</span>
                      </div>
                      <div className="progress">
                        <div style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h4 className="font-bold mb-4">مصدر البيانات</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">المصدر المحدد</span>
                  <span className="font-semibold">{selectedScoreSource?.name || 'لا يوجد مصدر'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">درجات مستوردة</span>
                  <span className="font-semibold">{scoreEntries.length}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">حدّ الدعم</span>
                  <span className="font-semibold">{supportThreshold}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: معاينة استيراد Blackboard ─── */}
      <Modal
        open={modalBB}
        onClose={() => !bbImporting && setModalBB(false)}
        title="استيراد من Blackboard"
        size="xl"
      >
        {bbData && (
          <div className="space-y-5">
            {/* ملخص */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-brand-50 p-3 rounded-xl text-center">
                <div className="text-2xl font-black text-brand-700">{bbData.students.length}</div>
                <div className="text-xs text-brand-600">متدربة</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl text-center">
                <div className="text-2xl font-black text-slate-700">
                  {bbData.scoreColumns.length}
                </div>
                <div className="text-xs text-slate-600">عمود درجة</div>
              </div>
              <div className="bg-gold-500/10 p-3 rounded-xl text-center">
                <div className="text-2xl font-black text-gold-600">{bbSelectedCount}</div>
                <div className="text-xs text-gold-600">سيُستورد</div>
              </div>
            </div>

            {/* الأعمدة */}
            <div>
              <h4 className="font-bold text-sm mb-3">
                <span className="inline-flex items-center gap-2"><FileSpreadsheet size={16} className="text-brand-600" /> اختاري أعمدة الدرجات التي تريدين استيرادها:</span>
              </h4>
              <div className="space-y-2 max-h-80 overflow-auto">
                {bbData.scoreColumns.map((col) => {
                  const isSuggested = ['exam1', 'exam2', 'final', 'total_100'].includes(col.type);
                  const isSelected = bbSelected[col.name];
                  return (
                    <label
                      key={col.name}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition border-2 ${
                        isSelected
                          ? 'bg-brand-50 border-brand-500'
                          : 'bg-slate-50 border-transparent hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={(e) =>
                          setBbSelected({ ...bbSelected, [col.name]: e.target.checked })
                        }
                        className="w-5 h-5 accent-brand-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{col.name}</div>
                        <div className="text-xs text-slate-500">
                          الدرجة القصوى: {col.maxPoints} · النوع: {scoreTypeLabels[col.type] || 'درجة'}
                        </div>
                      </div>
                      {isSuggested && (
                        <span className="badge bg-gold-500/20 text-gold-600 text-[10px]">
                          مقترح
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* معاينة أول 3 متدربات */}
            <div>
              <h4 className="font-bold text-sm mb-2">معاينة أول 3 متدربات:</h4>
              <div className="overflow-x-auto text-xs">
                <table className="table-base">
                  <thead>
                    <tr>
                        <th>اسم المتدربة</th>
                        <th>الرقم التدريبي</th>
                      {bbData.scoreColumns
                        .filter((c) => bbSelected[c.name])
                        .slice(0, 3)
                        .map((c) => (
                          <th key={c.name} className="text-center text-[10px]">
                            {c.name.slice(0, 20)}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bbData.students.slice(0, 3).map((st, i) => (
                      <tr key={i}>
                        <td className="text-xs">{st.name}</td>
                        <td className="text-xs font-mono">{st.code}</td>
                        {bbData.scoreColumns
                          .filter((c) => bbSelected[c.name])
                          .slice(0, 3)
                          .map((c) => (
                            <td key={c.name} className="text-center text-xs font-bold">
                              {st.scores[c.name]}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* أزرار */}
            <div className="flex gap-2 pt-3 border-t">
              <button
                onClick={confirmBlackboardImport}
                disabled={bbImporting || bbSelectedCount === 0}
                className="btn-primary flex-1"
              >
                {bbImporting ? 'جاري الاستيراد...' : `استيراد (${bbSelectedCount} مصدر درجة)`}
              </button>
              <button
                onClick={() => !bbImporting && setModalBB(false)}
                className="btn-ghost"
                disabled={bbImporting}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Modal: متدربة يدوية ─── */}
      <Modal open={modalStudent} onClose={() => setModalStudent(false)} title="إضافة متدربة" size="sm">
        <form onSubmit={saveStudent} className="space-y-4">
          <div>
            <label className="label">الاسم</label>
            <input
              className="input"
              value={studentForm.name}
              onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="label">الرقم</label>
            <input
              className="input"
              value={studentForm.code}
              onChange={(e) => setStudentForm({ ...studentForm, code: e.target.value })}
            />
          </div>
          <div>
            <label className="label">البريد (اختياري)</label>
            <input
              type="email"
              className="input"
              value={studentForm.email}
              onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">حفظ</button>
            <button type="button" onClick={() => setModalStudent(false)} className="btn-ghost">
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modalExam} onClose={() => setModalExam(false)} title="إضافة اختبار للشعبة" size="sm">
        <form onSubmit={saveExamSource} className="space-y-4">
          <div>
            <label className="label">اسم الاختبار</label>
            <input className="input" value={examForm.name} onChange={(event) => setExamForm({ ...examForm, name: event.target.value })} autoFocus />
          </div>
          <div>
            <label className="label">الدرجة القصوى</label>
            <input type="number" min="0.01" step="any" className="input" value={examForm.maxScore} onChange={(event) => setExamForm({ ...examForm, maxScore: event.target.value })} />
          </div>
          <p className="text-xs text-slate-500">يمكن استيراد درجاته لاحقاً من عمود Blackboard يحمل الاسم نفسه.</p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">حفظ الاختبار</button>
            <button type="button" onClick={() => setModalExam(false)} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      </Modal>

      <Modal open={templatePickerOpen} onClose={() => !supportGenerating && setTemplatePickerOpen(false)} title="اختيار نموذج الدعم" size="md">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">اختاري النموذج الذي سيُستخدم لاختبار «{selectedScoreSource?.name}».</p>
          {availableTemplates.map((template) => (
            <label key={template.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${templatePickerSelection === template.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
              <input
                type="radio"
                name="support-template"
                value={template.id}
                checked={templatePickerSelection === template.id}
                onChange={() => setTemplatePickerSelection(template.id)}
                className="h-4 w-4 accent-brand-600"
              />
              <span className="flex-1 font-semibold">{template.title}</span>
              {generatedTemplateCounts[template.id] > 0 && (
                <span className="text-xs text-emerald-700">{generatedTemplateCounts[template.id]} خطة محفوظة</span>
              )}
            </label>
          ))}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setTemplatePickerOpen(false)} className="btn-ghost" disabled={supportGenerating}>إلغاء</button>
            <button
              type="button"
              onClick={async () => {
                setTemplatePickerOpen(false);
                setSelectedSupportTemplateId(templatePickerSelection);
                await generateSupportInstances(templatePickerSelection);
              }}
              className="btn-primary"
              disabled={!templatePickerSelection || supportGenerating}
            >
              {supportGenerating ? 'جاري التوليد...' : 'اختيار النموذج'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}