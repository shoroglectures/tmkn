# setup-4.ps1 — الصفحات المتبقية
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function W($path, $content) {
  $dir = Split-Path $path -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, $utf8)
  Write-Host "  ✅ $path" -ForegroundColor Green
}

Write-Host "`n📄 السكربت 4: الصفحات المتبقية...`n" -ForegroundColor Cyan

W "src\pages\Courses.jsx" @'
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';

export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [studentsCount, setStudentsCount] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalCourse, setModalCourse] = useState(false);
  const [modalSection, setModalSection] = useState(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [sectionForm, setSectionForm] = useState({ name: '' });

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  async function load() {
    setLoading(true);
    const { data: cs } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    const courseIds = (cs || []).map((c) => c.id);
    const { data: secs } = courseIds.length
      ? await supabase.from('sections').select('*').in('course_id', courseIds)
      : { data: [] };
    const sectionIds = (secs || []).map((s) => s.id);
    const { data: sts } = sectionIds.length
      ? await supabase.from('students').select('id, section_id').in('section_id', sectionIds)
      : { data: [] };
    const countMap = {};
    (sts || []).forEach((s) => { countMap[s.section_id] = (countMap[s.section_id] || 0) + 1; });
    setCourses(cs || []);
    setSections(secs || []);
    setStudentsCount(countMap);
    setLoading(false);
  }

  async function saveCourse(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('أدخلي اسم المقرر');
    const { error } = await supabase.from('courses').insert({
      user_id: user.id, name: form.name.trim(), code: form.code.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success('تم إنشاء المقرر ✅');
    setModalCourse(false); setForm({ name: '', code: '' }); load();
  }

  async function saveSection(e) {
    e.preventDefault();
    if (!sectionForm.name.trim()) return toast.error('أدخلي اسم الشعبة');
    const { error } = await supabase.from('sections').insert({
      course_id: modalSection, name: sectionForm.name.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success('تمت إضافة الشعبة ✅');
    setModalSection(null); setSectionForm({ name: '' }); load();
  }

  async function deleteCourse(id) {
    if (!confirm('سيتم حذف المقرر وكل شعبه ومتدرباته. متأكدة؟')) return;
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('تم الحذف'); load();
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="المقررات والشعب" subtitle="أديري مقرراتك وشعبك"
        action={<button onClick={() => setModalCourse(true)} className="btn-primary"><Plus size={16} /> مقرر جديد</button>} />

      {courses.length === 0 ? (
        <EmptyState emoji="📚" title="لا توجد مقررات بعد" description="ابدئي بإنشاء أول مقرر ثم أضيفي إليه الشعب."
          action={<button onClick={() => setModalCourse(true)} className="btn-primary"><Plus size={16} /> إضافة أول مقرر</button>} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            const courseSecs = sections.filter((s) => s.course_id === c.id);
            const totalStudents = courseSecs.reduce((sum, s) => sum + (studentsCount[s.id] || 0), 0);
            return (
              <div key={c.id} className="card p-5 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0">
                    {c.code && <div className="text-xs text-brand-600 font-bold mb-1">{c.code}</div>}
                    <h3 className="font-black text-lg truncate">{c.name}</h3>
                  </div>
                  <button onClick={() => deleteCourse(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="text-xs text-slate-500 mb-4">{courseSecs.length} شعبة · {totalStudents} متدربة</div>
                <div className="space-y-1.5 mb-3 flex-1">
                  {courseSecs.map((s) => (
                    <Link key={s.id} to={`/section/${s.id}`}
                      className="flex justify-between items-center bg-slate-50 hover:bg-brand-50 px-3 py-2 rounded-lg text-sm transition">
                      <span className="font-semibold truncate">{s.name}</span>
                      <span className="text-slate-500 text-xs flex items-center gap-1">
                        <UsersIcon size={13} /> {studentsCount[s.id] || 0}
                      </span>
                    </Link>
                  ))}
                  {courseSecs.length === 0 && <div className="text-xs text-slate-400 text-center py-3">لا توجد شعب بعد</div>}
                </div>
                <button onClick={() => setModalSection(c.id)} className="btn-ghost w-full text-sm">
                  <Plus size={14} /> شعبة جديدة
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalCourse} onClose={() => setModalCourse(false)} title="مقرر جديد" size="sm">
        <form onSubmit={saveCourse} className="space-y-4">
          <div><label className="label">اسم المقرر</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
          <div><label className="label">الرمز (اختياري)</label>
            <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">حفظ</button>
            <button type="button" onClick={() => setModalCourse(false)} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!modalSection} onClose={() => setModalSection(null)} title="شعبة جديدة" size="sm">
        <form onSubmit={saveSection} className="space-y-4">
          <div><label className="label">اسم الشعبة</label>
            <input className="input" value={sectionForm.name} onChange={(e) => setSectionForm({ name: e.target.value })} autoFocus /></div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">حفظ</button>
            <button type="button" onClick={() => setModalSection(null)} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
'@

W "src\pages\Section.jsx" @'
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { parseStudentsFile, downloadStudentsTemplate } from '../utils/excel';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import FileUploadButton from '../components/FileUploadButton';

export default function Section() {
  const { id } = useParams();
  const [section, setSection] = useState(null);
  const [course, setCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalStudent, setModalStudent] = useState(false);
  const [modalExam, setModalExam] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: '', code: '', email: '' });
  const [examForm, setExamForm] = useState({ name: '' });

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    setLoading(true);
    const { data: sec } = await supabase.from('sections').select('*').eq('id', id).single();
    if (sec) {
      const { data: c } = await supabase.from('courses').select('*').eq('id', sec.course_id).single();
      setCourse(c);
    }
    const { data: sts } = await supabase.from('students').select('*').eq('section_id', id).order('name');
    const { data: exs } = await supabase.from('exams').select('*').eq('section_id', id).order('created_at', { ascending: false });
    setSection(sec); setStudents(sts || []); setExams(exs || []); setLoading(false);
  }

  async function importStudents(file) {
    try {
      const parsed = await parseStudentsFile(file);
      if (!parsed.length) return toast.error('الملف فارغ');
      const rows = parsed.map((s) => ({
        section_id: id, name: s.name, code: s.code || null, email: s.email || null,
      }));
      const { error } = await supabase.from('students').insert(rows);
      if (error) throw error;
      toast.success(`تم استيراد ${rows.length} متدربة ✅`);
      load();
    } catch (err) { toast.error(err.message); }
  }

  async function saveStudent(e) {
    e.preventDefault();
    if (!studentForm.name.trim()) return toast.error('أدخلي اسم المتدربة');
    const { error } = await supabase.from('students').insert({
      section_id: id, name: studentForm.name.trim(),
      code: studentForm.code.trim() || null, email: studentForm.email.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success('تمت الإضافة ✅');
    setModalStudent(false); setStudentForm({ name: '', code: '', email: '' }); load();
  }

  async function deleteStudent(sid) {
    if (!confirm('حذف المتدربة؟')) return;
    await supabase.from('students').delete().eq('id', sid);
    toast.success('تم الحذف'); load();
  }

  async function saveExam(e) {
    e.preventDefault();
    if (!examForm.name.trim()) return toast.error('أدخلي اسم الاختبار');
    const { error } = await supabase.from('exams').insert({ section_id: id, name: examForm.name.trim() });
    if (error) return toast.error(error.message);
    toast.success('تم إنشاء الاختبار ✅');
    setModalExam(false); setExamForm({ name: '' }); load();
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;
  if (!section) return <div className="card p-6">الشعبة غير موجودة</div>;

  return (
    <div>
      <PageHeader title={`${course?.name || ''} · ${section.name}`} subtitle="أديري المتدربات والاختبارات"
        backTo="/courses" backLabel="العودة للمقررات" />

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h3 className="font-bold">👩‍🎓 المتدربات <span className="text-slate-400">({students.length})</span></h3>
            <div className="flex gap-2">
              <FileUploadButton onFile={importStudents} label="Excel" className="btn-ghost text-sm" />
              <button onClick={() => setModalStudent(true)} className="btn-primary text-sm"><Plus size={14} /> إضافة</button>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span>صيغة: الاسم · الرقم · البريد</span>
            <button onClick={downloadStudentsTemplate} className="text-brand-600 hover:underline font-semibold">⬇️ القالب</button>
          </div>
          <div className="max-h-96 overflow-auto">
            {students.length === 0 ? (
              <div className="text-center text-slate-400 py-10 text-sm">لا توجد متدربات بعد</div>
            ) : (
              <table className="table-base">
                <thead><tr><th>الاسم</th><th>الرقم</th><th></th></tr></thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="font-semibold">{s.name}</td>
                      <td className="text-slate-500">{s.code || '—'}</td>
                      <td className="text-left">
                        <button onClick={() => deleteStudent(s.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg">
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

        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">📝 الاختبارات <span className="text-slate-400">({exams.length})</span></h3>
            <button onClick={() => setModalExam(true)} className="btn-primary text-sm"><Plus size={14} /> اختبار</button>
          </div>
          {exams.length === 0 ? (
            <div className="text-center text-slate-400 py-10 text-sm">لا توجد اختبارات بعد</div>
          ) : (
            <div className="space-y-2">
              {exams.map((e) => (
                <Link key={e.id} to={`/exam/${e.id}`}
                  className="flex justify-between items-center bg-slate-50 hover:bg-brand-50 p-3 rounded-lg transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <ClipboardList size={18} className="text-brand-600 shrink-0" />
                    <span className="font-semibold truncate">{e.name}</span>
                  </div>
                  <span className="text-xs text-slate-400">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={modalStudent} onClose={() => setModalStudent(false)} title="إضافة متدربة" size="sm">
        <form onSubmit={saveStudent} className="space-y-4">
          <div><label className="label">الاسم</label>
            <input className="input" value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} autoFocus /></div>
          <div><label className="label">الرقم</label>
            <input className="input" value={studentForm.code} onChange={(e) => setStudentForm({ ...studentForm, code: e.target.value })} /></div>
          <div><label className="label">البريد (اختياري)</label>
            <input type="email" className="input" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} /></div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">حفظ</button>
            <button type="button" onClick={() => setModalStudent(false)} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      </Modal>

      <Modal open={modalExam} onClose={() => setModalExam(false)} title="اختبار جديد" size="sm">
        <form onSubmit={saveExam} className="space-y-4">
          <div><label className="label">اسم الاختبار</label>
            <input className="input" value={examForm.name} onChange={(e) => setExamForm({ name: e.target.value })} autoFocus /></div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">حفظ</button>
            <button type="button" onClick={() => setModalExam(false)} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
'@

W "src\pages\ExamsList.jsx" @'
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../utils/format';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function ExamsList() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: cs } = await supabase.from('courses').select('id');
    const courseIds = (cs || []).map((c) => c.id);
    const { data: secs } = courseIds.length
      ? await supabase.from('sections').select('id, name, course_id').in('course_id', courseIds)
      : { data: [] };
    const sectionIds = (secs || []).map((s) => s.id);
    const { data: exs } = sectionIds.length
      ? await supabase.from('exams').select('*').in('section_id', sectionIds).order('created_at', { ascending: false })
      : { data: [] };
    const sectionMap = Object.fromEntries((secs || []).map((s) => [s.id, s.name]));
    setExams((exs || []).map((e) => ({ ...e, section_name: sectionMap[e.section_id] })));
    setLoading(false);
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="الاختبارات" subtitle="جميع اختباراتك مع إمكانية فتح التحليل"
        action={<Link to="/courses" className="btn-primary"><Plus size={16} /> اختبار من الشعبة</Link>} />

      {exams.length === 0 ? (
        <EmptyState emoji="📝" title="لا توجد اختبارات بعد"
          description="افتحي شعبة وأضيفي اختباراً."
          action={<Link to="/courses" className="btn-primary">اذهبي للمقررات</Link>} />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead><tr><th>الاختبار</th><th>الشعبة</th><th>التاريخ</th><th></th></tr></thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id}>
                  <td className="font-semibold">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={16} className="text-brand-600" />
                      {e.name}
                    </div>
                  </td>
                  <td className="text-slate-500 text-sm">{e.section_name || '—'}</td>
                  <td className="text-slate-500 text-sm">{fmtDate(e.created_at)}</td>
                  <td className="text-left">
                    <Link to={`/exam/${e.id}`} className="btn-primary text-xs">فتح التحليل</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
'@

Write-Host "`n🎉 السكربت 4 انتهى`n" -ForegroundColor Cyan