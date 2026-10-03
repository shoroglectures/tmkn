import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, ClipboardList, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../utils/format';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function ExamsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCourseId = searchParams.get('course');
  const selectedSectionId = searchParams.get('section');
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: cs } = await supabase.from('courses').select('id');
    const courseIds = (cs || []).map((c) => c.id);
    const { data: courseRows } = courseIds.length
      ? await supabase.from('courses').select('id, name, code').in('id', courseIds).order('name')
      : { data: [] };
    const { data: secs } = courseIds.length
      ? await supabase.from('sections').select('id, name, course_id').in('course_id', courseIds)
      : { data: [] };
    const sectionIds = (secs || []).map((s) => s.id);

    const { data: exs } = sectionIds.length
      ? await supabase.from('exams').select('*').in('section_id', sectionIds).order('created_at', { ascending: false })
      : { data: [] };

    setCourses(courseRows || []);
    setSections(secs || []);
    setExams(exs || []);
    setLoading(false);
  }

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const selectedSection = sections.find((section) => section.id === selectedSectionId);
  const courseSections = sections.filter((section) => section.course_id === selectedCourseId);
  const sectionExams = exams.filter((exam) => exam.section_id === selectedSectionId);

  function selectCourse(courseId) {
    setSearchParams({ course: courseId });
  }

  function selectSection(sectionId) {
    setSearchParams({ course: selectedCourseId, section: sectionId });
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <div>
      <PageHeader
        title={selectedSection ? `اختبارات ${selectedSection.name}` : selectedCourse ? `شعب ${selectedCourse.name}` : 'المقررات'}
        subtitle={selectedSection ? 'اختاري اختبارًا لعرض الدرجات والتحليل' : selectedCourse ? 'اختاري شعبة لعرض اختبارات المقرر' : 'اختاري مقررًا للبدء'}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setSearchParams({})} className={!selectedCourseId ? 'font-bold text-brand-700' : 'text-slate-500 hover:text-brand-700'}>المقررات</button>
        {selectedCourse && <>
          <span className="text-slate-300">/</span>
          <button type="button" onClick={() => selectCourse(selectedCourse.id)} className={!selectedSectionId ? 'font-bold text-brand-700' : 'text-slate-500 hover:text-brand-700'}>{selectedCourse.name}</button>
        </>}
        {selectedSection && <><span className="text-slate-300">/</span><span className="font-bold text-brand-700">{selectedSection.name}</span></>}
      </div>

      {!selectedCourseId ? courses.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <button key={course.id} type="button" onClick={() => selectCourse(course.id)} className="card p-5 text-right hover:border-brand-300">
              <BookOpen size={20} className="mb-3 text-brand-600" />
              <div className="font-bold">{course.name}</div>
              {course.code && <div className="mt-1 text-xs text-slate-500">{course.code}</div>}
              <div className="mt-3 text-xs text-brand-700">{sections.filter((section) => section.course_id === course.id).length} شعبة</div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="لا توجد مقررات" description="أنشئي مقررًا وشعبة أولاً لبدء إدارة الاختبارات." action={<Link to="/courses" className="btn-primary">المقررات والشعب</Link>} />
      ) : !selectedCourse ? (
        <EmptyState icon={BookOpen} title="المقرر غير موجود" description="اختاري مقررًا من القائمة." action={<button onClick={() => setSearchParams({})} className="btn-primary">عرض المقررات</button>} />
      ) : !selectedSectionId ? (
        courseSections.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {courseSections.map((section) => (
              <button key={section.id} type="button" onClick={() => selectSection(section.id)} className="card p-5 text-right hover:border-brand-300">
                <Users size={20} className="mb-3 text-brand-600" />
                <div className="font-bold">{section.name}</div>
                <div className="mt-3 text-xs text-brand-700">{exams.filter((exam) => exam.section_id === section.id).length} اختبار</div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={Users} title="لا توجد شعب" description="أضيفي شعبة لهذا المقرر من صفحة المقررات." action={<Link to="/courses" className="btn-primary">المقررات والشعب</Link>} />
        )
      ) : !selectedSection ? (
        <EmptyState icon={Users} title="الشعبة غير موجودة" description="اختاري شعبة من المقرر." action={<button onClick={() => selectCourse(selectedCourse.id)} className="btn-primary">عرض الشعب</button>} />
      ) : sectionExams.length ? (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>الاختبار</th>
                <th>الدرجة القصوى</th>
                <th>تاريخ الإضافة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sectionExams.map((e) => (
                <tr key={e.id}>
                  <td className="font-semibold">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={16} className="text-brand-600" />
                      {e.name}
                    </div>
                  </td>
                  <td className="text-slate-500 text-sm">{e.max_score}</td>
                  <td className="text-slate-500 text-sm">{fmtDate(e.created_at)}</td>
                  <td className="text-left">
                    <Link to={`/exam/${e.id}`} className="btn-primary text-xs">
                      فتح التحليل
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="لا توجد اختبارات في هذه الشعبة"
          description="أضيفي الاختبار من صفحة الشعبة أو استوردي درجاته من Blackboard."
          action={<Link to={`/section/${selectedSection.id}`} className="btn-primary">فتح الشعبة</Link>}
        />
      )}
    </div>
  );
}