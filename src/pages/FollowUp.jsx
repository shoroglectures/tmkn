import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Activity, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

function scorePercent(score) {
  return score.maxScore > 0 ? (score.score / score.maxScore) * 100 : 0;
}

function scoreDate(exam) {
  return new Date(exam.examDate || exam.exam_date || exam.created_at).getTime();
}

function formatReportDate(value) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getTrend(history) {
  if (history.length < 2) return { label: 'لا تتوفر مقارنة سابقة', delta: null };
  const previous = history[history.length - 2];
  const latest = history[history.length - 1];
  const delta = scorePercent(latest) - scorePercent(previous);
  if (delta > 0) return { label: 'تحسن', delta };
  if (delta < 0) return { label: 'تراجع', delta };
  return { label: 'ثبات', delta: 0 };
}

export default function FollowUp() {
  const { studentId } = useParams();
  const location = useLocation();
  const { profile } = useAuth();
  const reportPageRefs = useRef([]);
  const autoDownloadStarted = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followUpRows, setFollowUpRows] = useState([]);
  const [threshold, setThreshold] = useState(60);
  const [reportSettings, setReportSettings] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowUpData() {
      setLoading(true);
      setError('');
      try {
        const [{ data: sections, error: sectionError }, { data: settings, error: settingsError }] = await Promise.all([
          supabase.from('sections').select('id, name, course_id'),
          supabase.from('user_settings').select('*').maybeSingle(),
        ]);
        if (sectionError) throw sectionError;
        if (settingsError) throw settingsError;

        const sectionRows = sections || [];
        const sectionIds = sectionRows.map((section) => section.id);
        const courseIds = [...new Set(sectionRows.map((section) => section.course_id))];
        const [{ data: courses }, { data: students }] = await Promise.all([
          courseIds.length
            ? supabase.from('courses').select('id, name').in('id', courseIds)
            : Promise.resolve({ data: [] }),
          sectionIds.length
            ? supabase.from('students').select('id, name, code, section_id').in('section_id', sectionIds)
            : Promise.resolve({ data: [] }),
        ]);

        const { data: exams, error: examError } = sectionIds.length
          ? await supabase
            .from('exams')
            .select('id, name, section_id, exam_date, created_at, max_score, score_type')
            .eq('score_type', 'direct')
            .in('section_id', sectionIds)
          : { data: [], error: null };
        if (examError) throw examError;

        const examRows = exams || [];
        const examIds = examRows.map((exam) => exam.id);
        const { data: scoreRows, error: scoreError } = examIds.length
          ? await supabase
            .from('student_scores')
            .select('exam_id, student_id, score, max_score')
            .in('exam_id', examIds)
          : { data: [], error: null };
        if (scoreError) throw scoreError;

        const sectionMap = new Map(sectionRows.map((section) => [section.id, section]));
        const courseMap = new Map((courses || []).map((course) => [course.id, course]));
        const examMap = new Map(examRows.map((exam) => [exam.id, exam]));
        const scoresByStudent = new Map();

        (scoreRows || []).forEach((row) => {
          const exam = examMap.get(row.exam_id);
          if (!exam) return;
          const historyRow = {
            examId: exam.id,
            examName: exam.name,
            examDate: exam.exam_date || exam.created_at,
            score: Number(row.score || 0),
            maxScore: Number(row.max_score || exam.max_score || 0),
          };
          const studentHistory = scoresByStudent.get(row.student_id) || [];
          studentHistory.push(historyRow);
          scoresByStudent.set(row.student_id, studentHistory);
        });

        const rows = (students || []).flatMap((student) => {
          const section = sectionMap.get(student.section_id);
          const course = section && courseMap.get(section.course_id);
          const history = (scoresByStudent.get(student.id) || [])
            .sort((first, second) => scoreDate(first) - scoreDate(second));
          if (!section || !course || !history.length) return [];

          const latest = history[history.length - 1];
          const studentThreshold = Number(settings?.threshold ?? 60);
          if (scorePercent(latest) >= studentThreshold) return [];

          return [{
            student,
            section,
            course,
            history,
            latest,
            trend: getTrend(history),
          }];
        }).sort((first, second) => (
          first.course.name.localeCompare(second.course.name, 'ar')
          || first.section.name.localeCompare(second.section.name, 'ar')
          || first.student.name.localeCompare(second.student.name, 'ar')
        ));

        if (!cancelled) {
          setFollowUpRows(rows);
          setThreshold(Number(settings?.threshold ?? 60));
          setReportSettings(settings || null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'تعذر تحميل متابعة المتعثرات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFollowUpData();
    return () => { cancelled = true; };
  }, []);

  const selectedRecord = useMemo(
    () => followUpRows.find((row) => row.student.id === studentId),
    [followUpRows, studentId]
  );

  async function downloadReport() {
    if (!selectedRecord) return;
    try {
      const { exportElementsAsPDF } = await import('../utils/pdf');
      await exportElementsAsPDF(reportPageRefs.current, `student-follow-up-${selectedRecord.student.code || selectedRecord.student.id}.pdf`);
      toast.success('تم تنزيل ملف المتابعة');
    } catch (exportError) {
      toast.error(exportError.message || 'تعذر تصدير الملف');
    }
  }

  useEffect(() => {
    if (!selectedRecord || !location.search.includes('download=1') || autoDownloadStarted.current) return;
    autoDownloadStarted.current = true;
    const timer = window.setTimeout(downloadReport, 500);
    return () => window.clearTimeout(timer);
  }, [selectedRecord, location.search]);

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري تحميل متابعة المتعثرات...</div>;
  if (error) return <div className="card p-6 text-red-700">{error}</div>;

  if (!studentId) {
    return (
      <div>
        <PageHeader title="متابعة المتعثرات" subtitle={`${followUpRows.length} متدربة حسب أحدث اختبار مسجل`} />
        {followUpRows.length === 0 ? (
          <EmptyState icon={Activity} title="لا توجد متعثرات حاليًا" description="تظهر هنا المتدربات اللاتي تقل درجاتهن عن حد الدعم في أحدث اختبار مسجل لهن." />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>اسم المتدربة</th>
                    <th>الرقم التدريبي</th>
                    <th>المقرر</th>
                    <th>الشعبة</th>
                    <th>أحدث اختبار</th>
                    <th>الدرجة</th>
                    <th>التحسن</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {followUpRows.map((row) => (
                    <tr key={`${row.student.id}-${row.section.id}`}>
                      <td className="font-semibold">{row.student.name}</td>
                      <td className="font-mono text-xs text-slate-600">{row.student.code || '—'}</td>
                      <td>{row.course.name}</td>
                      <td>{row.section.name}</td>
                      <td>{row.latest.examName}</td>
                      <td className="font-bold text-red-600">{row.latest.score} / {row.latest.maxScore}</td>
                      <td className={row.trend.delta > 0 ? 'font-semibold text-emerald-700' : row.trend.delta < 0 ? 'font-semibold text-red-600' : 'text-slate-500'}>
                        {row.trend.delta == null ? '—' : `${row.trend.delta > 0 ? '+' : ''}${row.trend.delta.toFixed(1)} نقطة`}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link to={`/follow-up/${row.student.id}`} className="btn-primary text-xs">فتح</Link>
                          <Link
                            to={`/follow-up/${row.student.id}?download=1`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-ghost text-xs"
                          >
                            <Download size={14} /> تحميل ملفها
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!selectedRecord) {
    return (
      <div className="space-y-4">
        <PageHeader title="ملف المتابعة" backTo="/follow-up" backLabel="العودة للمتعثرات" />
        <EmptyState icon={FileText} title="ملف المتدربة غير موجود ضمن المتعثرات الحالية" description="قد تكون تحسنت في أحدث اختبار، أو لم تعد تملك درجات مسجلة." action={<Link to="/follow-up" className="btn-primary">متابعة المتعثرات</Link>} />
      </div>
    );
  }

  const { student, section, course, history, latest, trend } = selectedRecord;
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const chartData = history.map((item) => ({
    examName: item.examName,
    percentage: Number(scorePercent(item).toFixed(1)),
  }));

  return (
    <div>
      <PageHeader
        title={student.name}
        subtitle={`${student.code || '—'} · ${course.name} · ${section.name}`}
        backTo="/follow-up"
        backLabel="العودة للمتعثرات"
        action={<button onClick={downloadReport} className="btn-primary"><Download size={16} /> تحميل ملف PDF</button>}
      />

      <div className="space-y-5">
        <section ref={(element) => { reportPageRefs.current[0] = element; }} className="card mx-auto max-w-4xl space-y-5 bg-white p-7">
          {reportSettings?.header_url && (
            <img crossOrigin="anonymous" src={reportSettings.header_url} alt="ترويسة التقرير" className="mx-auto max-h-28 max-w-full object-contain" />
          )}
          <div className="border-b border-slate-200 pb-4">
            <div className="text-xs font-bold text-brand-700">تمكن بلس · متابعة المتعثرات</div>
            <h2 className="mt-1 text-2xl font-black">تقرير متابعة المتدربة</h2>
            <div className="mt-2 text-sm text-slate-600">{student.name} · {student.code || '—'} · {course.name} · {section.name}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="أحدث اختبار" value={latest.examName} />
            <Stat label="الدرجة الحالية" value={`${latest.score} / ${latest.maxScore}`} ltr />
            <Stat label="النسبة الحالية" value={`${scorePercent(latest).toFixed(1)}%`} ltr />
            <Stat label="حد الدعم" value={`${threshold}%`} ltr />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="الاختبار السابق" value={previous ? `${previous.score} / ${previous.maxScore}` : 'لا يوجد'} ltr={Boolean(previous)} />
            <Stat label="مقدار التغير" value={trend.delta == null ? '—' : `${trend.delta > 0 ? '+' : ''}${trend.delta.toFixed(1)} نقطة مئوية`} />
            <Stat label="مستوى التحسن" value={trend.label} />
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><Activity size={18} className="text-brand-600" /> تطور المستوى عبر الاختبارات</h2>
            {chartData.length > 1 ? (
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="examName" angle={-15} textAnchor="end" interval={0} height={55} />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => [`${value}%`, 'النتيجة']} />
                    <Line type="monotone" dataKey="percentage" name="النتيجة" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">يظهر الرسم بعد تسجيل درجة اختبار آخر.</p>
            )}
          </div>
        </section>

        <section ref={(element) => { reportPageRefs.current[1] = element; }} className="card mx-auto max-w-4xl space-y-5 bg-white p-7">
          <div className="border-b border-slate-200 pb-3">
            <div className="text-xs font-bold text-brand-700">تمكن بلس · متابعة المتعثرات</div>
            <h2 className="mt-1 text-xl font-black">سجل الدرجات والتحسن</h2>
            <div className="mt-1 text-sm text-slate-600">{student.name} · {student.code || '—'}</div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="table-base report-history-table w-full table-fixed text-xs">
              <colgroup>
                <col style={{ width: '19%' }} />
                <col style={{ width: '19%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead><tr><th>الاختبار</th><th>التاريخ</th><th>الدرجة</th><th>النسبة</th><th>التغير عن السابق</th><th>الحالة</th></tr></thead>
              <tbody>
                {history.map((item, index) => {
                  const prior = index > 0 ? history[index - 1] : null;
                  const delta = prior ? scorePercent(item) - scorePercent(prior) : null;
                  const atRisk = scorePercent(item) < threshold;
                  return (
                    <tr key={item.examId}>
                      <td className="break-words font-semibold">{item.examName}</td>
                      <td className="text-[11px]">{formatReportDate(item.examDate)}</td>
                      <td className="font-bold"><span dir="ltr">{item.score} / {item.maxScore}</span></td>
                      <td><span dir="ltr">{scorePercent(item).toFixed(1)}%</span></td>
                      <td className={delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-600' : 'text-slate-500'}>
                        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} نقطة`}
                      </td>
                      <td className={atRisk ? 'font-semibold text-red-600' : 'font-semibold text-emerald-700'}>
                        {atRisk ? 'تحتاج دعم' : 'اجتازت حد الدعم'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(profile?.full_name || reportSettings?.signature_url) && (
            <div className="border-t border-slate-200 pt-4">
              <div className="font-bold">المدربة: {profile?.full_name || '—'}</div>
              {reportSettings?.signature_url && <img crossOrigin="anonymous" src={reportSettings.signature_url} alt="توقيع المدربة" className="mt-2 max-h-20 max-w-48 object-contain" />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, ltr = false }) {
  return (
    <div className="card min-w-0 p-4">
      <div className="mb-1 text-xs text-slate-500">{label}</div>
      <div dir={ltr ? 'ltr' : undefined} className="break-words text-lg font-bold">{value}</div>
    </div>
  );
}