import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';

export default function Admin() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState(null);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: requestError } = await supabase.rpc('admin_list_access_requests');
    if (requestError) {
      setError(requestError.message);
      setLoading(false);
      return;
    }
    setRequests(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function reviewRequest(request, approved) {
    const action = approved ? 'تفعيل الحساب' : 'رفض الطلب';
    if (!window.confirm(`${action} للبريد ${request.email}؟`)) return;

    setBusyUserId(request.user_id);
    try {
      const { error: reviewError } = await supabase.rpc('admin_review_access_request', {
        p_user_id: request.user_id,
        p_approved: approved,
      });
      if (reviewError) throw reviewError;
      toast.success(approved ? 'تم تفعيل الحساب. يمكن لصاحبته تسجيل الدخول الآن.' : 'تم رفض الطلب');
      await loadRequests();
    } catch (reviewError) {
      toast.error(reviewError.message || 'تعذرت مراجعة الطلب');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="إدارة طلبات الحسابات"
        subtitle="راجعي الطلبات وفعّلي الحسابات المسموح لها باستخدام الموقع."
        action={
          <button type="button" className="btn-ghost" onClick={loadRequests} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        }
      />

      {error && (
        <div role="alert" className="card mb-4 border border-red-200 p-4 text-sm text-red-700">
          تعذر تحميل طلبات التسجيل: {error}
        </div>
      )}

      <section className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-500">جارٍ تحميل الطلبات...</p>
        ) : requests.length === 0 ? (
          <p className="p-8 text-center text-slate-500">لا توجد طلبات معلّقة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-right text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">الاسم</th>
                  <th className="px-4 py-3 font-semibold">البريد الإلكتروني</th>
                  <th className="px-4 py-3 font-semibold">تاريخ الطلب</th>
                  <th className="px-4 py-3 font-semibold">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.user_id}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{request.full_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600" dir="ltr">{request.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(request.requested_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary !px-3 !py-2 text-xs"
                          disabled={busyUserId === request.user_id}
                          onClick={() => reviewRequest(request, true)}
                        >
                          <Check size={15} /> موافقة
                        </button>
                        <button
                          type="button"
                          className="btn-ghost !px-3 !py-2 text-xs text-red-700"
                          disabled={busyUserId === request.user_id}
                          onClick={() => reviewRequest(request, false)}
                        >
                          <X size={15} /> رفض
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
