import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Plus, Trash2, Users as UsersIcon } from 'lucide-react';
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

  useEffect(() => { if (user) load(); }, [user]);

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
    (sts || []).forEach((s) => {
      countMap[s.section_id] = (countMap[s.section_id] || 0) + 1;
    });

    setCourses(cs || []);
    setSections(secs || []);
    setStudentsCount(countMap);
    setLoading(false);
  }

  async function saveCourse(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('أدخلي اسم المقرر');

    const { error } = await supabase.from('courses').insert({
      user_id: user.id,
      name: form.name.trim(),
      code: form.code.trim() || null,
    });
    if (error) return toast.error(error.message);

    toast.success('تم إنشاء المقرر');
    setModalCourse(false);
    setForm({ name: '', code: '' });
    load();
  }

  async function saveSection(e) {
    e.preventDefault();
    if (!sectionForm.name.trim()) return toast.error('أدخلي اسم الشعبة');

    const { error } = await supabase.from('sections').insert({
      course_id: modalSection,
      name: sectionForm.name.trim(),
    });
    if (error) return toast.error(error.message);

    toast.success('تمت إضافة الشعبة');
    setModalSection(null);
    setSectionForm({ name: '' });
    load();
  }

  async function deleteCourse(id) {
    if (!confirm('سيتم حذف المقرر وكل شعبه ومتدرباته ودرجاتهن واختباراتهن وخطط الدعم نهائيًا. متأكدة؟')) return;
    const { data, error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (!data) return toast.error('لم يتم حذف المقرر؛ ربما حُذف مسبقًا أو لا تملكين صلاحية حذفه');
    toast.success('تم الحذف');
    await load();
  }

  async function deleteSection(section) {
    if (!confirm(`سيتم حذف الشعبة «${section.name}» مع متدرباتها ودرجاتهن واختباراتهن وخطط الدعم نهائيًا. متأكدة؟`)) return;
    const { data, error } = await supabase
      .from('sections')
      .delete()
      .eq('id', section.id)
      .select('id')
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (!data) return toast.error('لم يتم حذف الشعبة؛ ربما حُذفت مسبقًا أو لا تملكين صلاحية حذفها');
    toast.success('تم حذف الشعبة وبياناتها المرتبطة');
    await load();
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <div>
      <PageHeader
        title="المقررات والشعب"
        subtitle="أديري مقرراتك وشعبك"
        action={
          <button onClick={() => setModalCourse(true)} className="btn-primary">
            <Plus size={16} /> مقرر جديد
          </button>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="لا توجد مقررات بعد"
          description="ابدئي بإنشاء أول مقرر ثم أضيفي إليه الشعب."
          action={
            <button onClick={() => setModalCourse(true)} className="btn-primary">
              <Plus size={16} /> إضافة أول مقرر
            </button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            const courseSecs = sections.filter((s) => s.course_id === c.id);
            const totalStudents = courseSecs.reduce((sum, s) => sum + (studentsCount[s.id] || 0), 0);

            return (
              <div key={c.id} className="card p-5 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0">
                    {c.code && (
                      <div className="text-xs text-brand-600 font-bold mb-1">{c.code}</div>
                    )}
                    <h3 className="font-black text-lg truncate">{c.name}</h3>
                  </div>
                  <button
                    onClick={() => deleteCourse(c.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="text-xs text-slate-500 mb-4">
                  {courseSecs.length} شعبة · {totalStudents} متدربة
                </div>

                <div className="space-y-1.5 mb-3 flex-1">
                  {courseSecs.map((s) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <Link
                        to={'/section/' + s.id}
                        className="flex min-w-0 flex-1 justify-between items-center bg-slate-50 hover:bg-brand-50 px-3 py-2 rounded-lg text-sm transition"
                      >
                        <span className="font-semibold truncate">{s.name}</span>
                        <span className="text-slate-500 text-xs flex items-center gap-1">
                          <UsersIcon size={13} /> {studentsCount[s.id] || 0}
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteSection(s)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                        aria-label={`حذف الشعبة ${s.name}`}
                        title="حذف الشعبة وبياناتها المرتبطة"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {courseSecs.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-3">
                      لا توجد شعب بعد
                    </div>
                  )}
                </div>

                <Link
                  to={`/course/${c.id}/plan`}
                  state={{ returnTo: '/courses' }}
                  className="btn-ghost w-full text-sm mb-2"
                >
                  <FileText size={14} /> نموذج الدعم للمقرر
                </Link>

                <button
                  onClick={() => setModalSection(c.id)}
                  className="btn-ghost w-full text-sm"
                >
                  <Plus size={14} /> شعبة جديدة
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalCourse}
        onClose={() => setModalCourse(false)}
        title="مقرر جديد"
        size="sm"
      >
        <form onSubmit={saveCourse} className="space-y-4">
          <div>
            <label className="label">اسم المقرر</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="label">الرمز (اختياري)</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">حفظ</button>
            <button type="button" onClick={() => setModalCourse(false)} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!modalSection}
        onClose={() => setModalSection(null)}
        title="شعبة جديدة"
        size="sm"
      >
        <form onSubmit={saveSection} className="space-y-4">
          <div>
            <label className="label">اسم الشعبة</label>
            <input
              className="input"
              value={sectionForm.name}
              onChange={(e) => setSectionForm({ name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">حفظ</button>
            <button type="button" onClick={() => setModalSection(null)} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}