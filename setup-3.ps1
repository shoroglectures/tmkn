# setup-3.ps1 — الصفحات الأساسية
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function W($path, $content) {
  $dir = Split-Path $path -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, $utf8)
  Write-Host "  ✅ $path" -ForegroundColor Green
}

Write-Host "`n📄 السكربت 3: الصفحات الأساسية...`n" -ForegroundColor Cyan

W "src\App.jsx" @'
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import Section from './pages/Section';
import ExamsList from './pages/ExamsList';
import Exam from './pages/Exam';
import Students from './pages/Students';
import Plans from './pages/Plans';
import PlanDetail from './pages/PlanDetail';
import StudentPortal from './pages/StudentPortal';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/student/:token" element={<StudentPortal />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/section/:id" element={<Section />} />
        <Route path="/exams" element={<ExamsList />} />
        <Route path="/exam/:id" element={<Exam />} />
        <Route path="/students" element={<Students />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/plan/:id" element={<PlanDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
'@

W "src\pages\NotFound.jsx" @'
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card p-10 text-center max-w-md mx-auto mt-10">
      <div className="text-5xl mb-3">🧭</div>
      <h1 className="text-xl font-black mb-2">الصفحة غير موجودة</h1>
      <p className="text-slate-500 text-sm mb-5">الرابط الذي تحاولين الوصول إليه غير متاح.</p>
      <Link to="/" className="btn-primary inline-block">العودة للرئيسية</Link>
    </div>
  );
}
'@

W "src\pages\Login.jsx" @'
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const features = [
  'تشخيص رقمي تلقائي لكل متدربة',
  'وصفة علاجية مخصصة حسب المهارة',
  'رمز QR خاص لكل متدربة',
  'قياس التحسّن بين الاختبارات',
];

export default function Login() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(form.email, form.password);
        toast.success('أهلاً بك مجدداً 👋');
      } else {
        if (!form.name.trim()) throw new Error('أدخلي الاسم');
        await signUp(form.email, form.password, form.name.trim());
        toast.success('تم إنشاء الحساب بنجاح ✅');
      }
      navigate('/');
    } catch (err) {
      const msg = err?.message || 'حدث خطأ';
      if (msg.includes('Invalid login')) toast.error('البريد أو كلمة المرور غير صحيحة');
      else if (msg.includes('already registered')) toast.error('البريد مستخدم مسبقاً');
      else toast.error(msg);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-white text-brand-700 grid place-items-center font-black text-3xl mb-6 shadow-lg">+</div>
          <h1 className="text-4xl font-black mb-3">تمكن بلس</h1>
          <p className="text-brand-100 text-lg leading-relaxed mb-8 max-w-md">مسار التمكّن الأكاديمي — حوّل درجة الاختبار إلى خطة دعم شخصية تقيس أثرها.</p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-brand-50">
                <CheckCircle2 size={20} className="text-gold-400 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="card p-8 w-full max-w-md">
          <div className="lg:hidden text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-xl bg-brand-600 text-white grid place-items-center font-black text-2xl mb-2">+</div>
            <div className="font-black text-xl">تمكن بلس</div>
          </div>

          <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
            <button onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${mode === 'login' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
              تسجيل الدخول
            </button>
            <button onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${mode === 'signup' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
              حساب جديد
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">الاسم الكامل</label>
                <input className="input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: أ. نورة العتيبي" />
              </div>
            )}
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input type="email" className="input" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pl-10" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••" minLength={6} required />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'جاري...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
            </button>
          </form>
          <p className="text-xs text-slate-400 text-center mt-6">© {new Date().getFullYear()} تمكن بلس</p>
        </div>
      </div>
    </div>
  );
}
'@

W "src\pages\Dashboard.jsx" @'
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, ClipboardList, HeartPulse, CheckCircle2, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { analyzeExam } from '../utils/analyze';
import { fmtPct } from '../utils/format';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ courses:0, sections:0, students:0, exams:0, plans:0, approved:0 });
  const [lastExam, setLastExam] = useState(null);
  const [analysis, setAnalysis] = useState([]);

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

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
    const { data: exams } = sectionIds.length
      ? await supabase.from('exams').select('*').in('section_id', sectionIds).order('created_at', { ascending: false })
      : { data: [] };
    const { data: plans } = await supabase.from('plans').select('*');

    setCounts({
      courses: courses?.length || 0,
      sections: sections?.length || 0,
      students: students?.length || 0,
      exams: exams?.length || 0,
      plans: plans?.length || 0,
      approved: (plans || []).filter((p) => p.status === 'approved').length,
    });

    if (exams?.length) {
      const exam = exams[0];
      const { data: questions } = await supabase.from('questions').select('*').eq('exam_id', exam.id);
      const { data: examStudents } = await supabase.from('students').select('*').eq('section_id', exam.section_id);
      const { data: answers } = await supabase.from('answers').select('*').eq('exam_id', exam.id);
      const { data: settings } = await supabase.from('user_settings').select('threshold').maybeSingle();
      setLastExam(exam);
      setAnalysis(analyzeExam({
        questions: questions || [], students: examStudents || [],
        answers: answers || [], threshold: settings?.threshold ?? 60,
      }));
    } else {
      setLastExam(null); setAnalysis([]);
    }
    setLoading(false);
  }

  const name = profile?.full_name?.split(' ')[0] || 'بك';
  const below = analysis.filter((a) => a.needsPlan).length;
  const avg = analysis.length ? Math.round(analysis.reduce((s, x) => s + x.pct, 0) / analysis.length) : 0;

  return (
    <div>
      <PageHeader title={`مرحباً، ${name} 👋`} subtitle="نظرة سريعة على مسار التمكّن الأكاديمي" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={BookOpen}      value={counts.courses}   label="المقررات" />
        <StatCard icon={GraduationCap} value={counts.sections}  label="الشعب" />
        <StatCard icon={Users}         value={counts.students}  label="المتدربات" />
        <StatCard icon={ClipboardList} value={counts.exams}     label="الاختبارات" />
        <StatCard icon={HeartPulse}    value={counts.plans}     label="خطط الدعم" color="gold" />
        <StatCard icon={CheckCircle2}  value={counts.approved}  label="خطط معتمدة" color="green" />
      </div>

      {loading ? (
        <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>
      ) : lastExam ? (
        <div className="card p-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div>
              <div className="text-xs text-slate-500 font-semibold">آخر اختبار</div>
              <h3 className="font-black text-lg">{lastExam.name}</h3>
            </div>
            <Link to={`/exam/${lastExam.id}`} className="btn-primary">فتح التحليل</Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard value={analysis.length} label="متدربة" />
            <StatCard value={below} label="بحاجة دعم" color="red" />
            <StatCard value={fmtPct(avg)} label="متوسط الدرجات" color="green" />
          </div>
          <div className="space-y-2.5">
            {analysis.slice(0, 6).map((r) => (
              <div key={r.student.id} className="flex items-center gap-3">
                <div className="w-28 text-sm font-semibold truncate">{r.student.name}</div>
                <div className="flex-1 progress">
                  <div style={{ width: `${r.pct}%`, background: r.pct < 60 ? '#ef4444' : r.pct < 80 ? '#f59e0b' : '#10b981' }} />
                </div>
                <div className="w-12 text-sm font-bold text-left">{r.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState emoji="📊" title="لا توجد اختبارات بعد"
          description="ابدئي بإنشاء مقرر ثم شعبة ثم استيراد المتدربات وإضافة اختبار."
          action={<Link to="/courses" className="btn-primary">📚 ابدئي الآن</Link>} />
      )}
    </div>
  );
}
'@

W "src\pages\Students.jsx" @'
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('students').select('*, section:sections(name, course:courses(name))').order('name');
    setStudents(data || []);
    setLoading(false);
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="المتدربات" subtitle="كل المتدربات في جميع المقررات" />
      {students.length === 0 ? (
        <EmptyState emoji="👩‍🎓" title="لا توجد متدربات بعد"
          description="أضيفي المتدربات من داخل الشعبة."
          action={<Link to="/courses" className="btn-primary">اذهبي للمقررات</Link>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>الاسم</th><th>الرقم</th><th>البريد</th><th>الشعبة</th><th>المقرر</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.name}</td>
                    <td className="text-slate-500">{s.code || '—'}</td>
                    <td className="text-slate-500 text-xs">{s.email || '—'}</td>
                    <td className="text-slate-500 text-sm">{s.section?.name || '—'}</td>
                    <td className="text-slate-500 text-sm">{s.section?.course?.name || '—'}</td>
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
'@

Write-Host "`n🎉 السكربت 3 انتهى`n" -ForegroundColor Cyan