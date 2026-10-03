import { Navigate } from 'react-router-dom';
import { LogOut, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import DateTimeBar from '../components/DateTimeBar';

export default function AccessPending() {
  const { user, profile, profileError, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (profile?.access_status === 'approved') return <Navigate to="/" replace />;

  async function checkStatus() {
    setChecking(true);
    try {
      const { data, error } = await refreshProfile(user.id);
      if (error) throw error;
      if (data?.access_status === 'approved') {
        toast.success('تم تفعيل حسابك');
      } else {
        toast('لم يتغير وضع الطلب بعد');
      }
    } catch (error) {
      toast.error(error.message || 'تعذر التحقق من حالة الطلب');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <DateTimeBar />
      <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center p-6">
        <section className="card w-full max-w-lg p-8 text-center">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-2xl font-black text-slate-800">
            {profile?.access_status === 'rejected' ? 'لم تتم الموافقة على الطلب' : 'طلبك قيد المراجعة'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {profileError
              ? 'تعذر التحقق من حالة الحساب. حاولي التحقق مرة أخرى.'
              : profile?.access_status === 'rejected'
                ? 'لم يُفعّل هذا الحساب. إذا كنتِ تعتقدين أن ذلك حدث بالخطأ، تواصلي مع إدارة الموقع.'
                : 'بإنتظار موافقة المسؤول وتفعيل حسابك. يمكنك العودة لاحقًا للتحقق من حالة طلبك.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {profile?.access_status !== 'rejected' && (
              <button type="button" className="btn-primary" onClick={checkStatus} disabled={checking}>
                <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
                {checking ? 'جارٍ التحقق...' : 'تحقق من حالة الطلب'}
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={signOut}>
              <LogOut size={16} /> تسجيل الخروج
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
