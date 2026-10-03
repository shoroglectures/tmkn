import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, ClipboardList, HeartPulse, CheckCircle2, GraduationCap, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { analyzeExam } from '../utils/analyze';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ courses: 0, sections: 0, students: 0, scoreSources: 0, plans: 0, submitted: 0 });
  const [lastScoreSource, setLastScoreSource] = useState(null);
  const [analysis, setAnalysis] = useState([]);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const { data: courses } = await supabase.from('courses').select('id');
    const courseIds = (courses || []).map((c) => c.id);
    const { data: sections } = courseIds.length
      ? await supabase.from('sections').select('id').in('course_id', courseIds)
      : { data: [] };
    const sectionIds = (sections || []).map((s) => s.id);
    const { data: students } = sectionIds.length
      ? await supabase.from('students').select('id').in('section_id', sectionIds)
      : { data: [] };
    const { data: scoreSources } = sectionIds.length
      ? await supabase.from('exams').select('*').in('section_id', sectionIds).eq('score_type', 'direct').order('created_at', { ascending: false })
      : { data: [] };
    const { data: plans } = await supabase.from('plan_instances').select('status');

    setCounts({
      courses: courses?.length || 0,
      sections: sections?.length || 0,
      students: students?.length || 0,
      scoreSources: scoreSources?.length || 0,
      plans: plans?.length || 0,
      submitted: (plans || []).filter((plan) => plan.status === 'submitted').length,
    });

    if (scoreSources?.length) {
      const scoreSource = scoreSources[0];
      const { data: examStudents } = await supabase.from('students').select('*').eq('section_id', scoreSource.section_id);
      const { data: directScores } = await supabase.from('student_scores').select('*').eq('exam_id', scoreSource.id);
      const { data: settings } = await supabase.from('user_settings').select('*').maybeSingle();
      setLastScoreSource(scoreSource);
      setAnalysis(analyzeExam({
        mode: 'direct',
        students: examStudents || [],
        scores: directScores || [],
        threshold: settings?.threshold ?? 60,
        caseStudyThreshold: settings?.case_study_threshold ?? 12,
      }));
    } else {
      setLastScoreSource(null);
      setAnalysis([]);
    }
    setLoading(false);
  }

  const name = profile?.full_name?.split(' ')[0] || 'بك';
  const below = analysis.filter((a) => a.needsPlan).length;
  const avgScore = analysis.length
    ? (analysis.reduce((sum, item) => sum + item.score, 0) / analysis.length).toFixed(1)
    : '0';

  return (
    <div>
      <PageHeader title={'مرحباً، ' + name} subtitle="نظرة سريعة على مسار التمكّن التدريبي" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={BookOpen} value={counts.courses} label="المقررات" />
        <StatCard icon={GraduationCap} value={counts.sections} label="الشعب" />
        <StatCard icon={Users} value={counts.students} label="المتدربات" />
        <StatCard icon={ClipboardList} value={counts.scoreSources} label="مصادر الدرجات" />
        <StatCard icon={HeartPulse} value={counts.plans} label="خطط الدعم" color="gold" />
        <StatCard icon={CheckCircle2} value={counts.approved} label="خطط معتمدة" color="green" />
        <StatCard icon={CheckCircle2} value={counts.submitted} label="خطط مقدمة" color="green" />
      </div>

      {loading ? (
        <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>
      ) : lastScoreSource ? (
        <div className="card p-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div>
              <div className="text-xs text-slate-500 font-semibold">آخر مصدر درجات</div>
              <h3 className="font-black text-lg">{lastScoreSource.name}</h3>
            </div>
            <Link to={'/section/' + lastScoreSource.section_id} className="btn-primary">فتح الشعبة</Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard value={analysis.length} label="متدربة" />
            <StatCard value={below} label="بحاجة دعم" color="red" />
            <StatCard value={`${avgScore} / ${lastScoreSource.max_score}`} label="متوسط الدرجات" color="green" />
          </div>
          <div className="space-y-2.5">
            {analysis.slice(0, 6).map((r) => (
              <div key={r.student.id} className="flex items-center gap-3">
                <div className="w-28 text-sm font-semibold truncate">{r.student.name}</div>
                <div className="flex-1 progress">
                  <div style={{
                    width: r.pct + '%',
                    background: r.pct < 60 ? '#ef4444' : r.pct < 80 ? '#f59e0b' : '#10b981'
                  }} />
                </div>
                <div className="w-20 text-sm font-bold text-left">{r.score} / {r.total}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="لا توجد درجات مستوردة بعد"
          description="أنشئي مقررًا وشعبة، ثم استوردي ملف درجات Blackboard لبدء إعداد خطط الدعم."
          action={<Link to="/courses" className="btn-primary"><BookOpen size={16} /> ابدئي الآن</Link>}
        />
      )}
    </div>
  );
}