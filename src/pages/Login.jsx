import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DateTimeBar from '../components/DateTimeBar';

const features = [
  'تحليل درجات المتدربات تلقائياً',
  'خطة تدريبية مناسبة لكل متدربة',
  'رابط متابعة خاص لكل متدربة',
  'قياس التحسن عبر مصادر الدرجات',
];

export default function Login() {
  const { user, profile, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login | signup
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  if (user) {
    return <Navigate to={profile?.access_status === 'approved' ? '/' : '/access-pending'} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(form.email, form.password);
        toast.success('أهلاً بك مجدداً');
      } else {
        if (!form.name.trim()) throw new Error('أدخلي الاسم');
        await signUp(form.email, form.password, form.name.trim());
        setRequestSubmitted(true);
        toast.success('تم إرسال طلب تفعيل الحساب');
      }
      if (mode === 'login') navigate('/');
    } catch (err) {
      const msg = err?.message || 'حدث خطأ';
      if (msg.includes('Invalid login')) toast.error('البريد أو كلمة المرور غير صحيحة');
      else if (msg.includes('already registered')) toast.error('البريد مستخدم مسبقاً');
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <DateTimeBar />
      <div className="min-h-[calc(100vh-3.5rem)] grid lg:grid-cols-2">
      {/* الجهة الترويجية */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="relative z-10">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="w-20 h-20 mb-6" />
          <h1 className="text-4xl font-black mb-3">تمكن بلس</h1>
          <p className="text-brand-100 text-lg leading-relaxed mb-8 max-w-md">
            مسار التمكّن التدريبي — حوّلي درجات المتدربات إلى خطط دعم عملية قابلة للمتابعة.
          </p>
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

      {/* النموذج */}
      <div className="flex items-center justify-center p-6">
        <div className="card p-8 w-full max-w-md">
          <div className="lg:hidden text-center mb-6">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="w-16 h-16 mx-auto mb-2" />
            <div className="font-black text-xl">تمكن بلس</div>
          </div>

          <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => {
                setMode('login');
                setRequestSubmitted(false);
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                mode === 'login' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setRequestSubmitted(false);
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                mode === 'signup' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              طلب تفعيل حساب
            </button>
          </div>

          {requestSubmitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <h2 className="font-bold text-emerald-800">وصل طلبك بنجاح</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-700">
                لن تتمكني من دخول النظام حتى تراجعي الطلب وتتم الموافقة عليه من الإدارة.
                بعد الموافقة، سجّلي الدخول بالبريد وكلمة المرور اللذين أدخلتهما.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRequestSubmitted(false);
                  setMode('login');
                  setForm({ name: '', email: '', password: '' });
                }}
                className="btn-ghost mt-4"
              >
                العودة لتسجيل الدخول
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">الاسم الكامل</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: أ. نورة العتيبي"
                />
              </div>
            )}

            <div>
              <label className="label">البريد الإلكتروني</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pl-10"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'جاري...' : mode === 'login' ? 'دخول' : 'إرسال طلب التفعيل'}
            </button>
            {mode === 'signup' && (
              <p className="text-xs text-slate-500 text-center leading-5">
                سيُنشأ الحساب بحالة معلّقة حتى يتم الموافقة وتفعيل الحساب من قبل المسؤول.
              </p>
            )}
          </form>
          )}

          <p className="text-xs text-slate-400 text-center mt-6">
            © {new Date().getFullYear()} تمكن بلس — جميع الحقوق محفوظة
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}