import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../utils/format';
import { HeartPulse, ExternalLink, Clock3, Send, CircleAlert } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

const statusMap = {
  pending: { Icon: Clock3, label: 'بانتظار المتدربة', color: '#f59e0b' },
  submitted: { Icon: Send, label: 'تم الإرسال', color: '#3b82f6' },
  expired: { Icon: CircleAlert, label: 'منتهي', color: '#ef4444' },
};

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('plan_instances')
      .select(`
        *,
        student:students(name, code, email),
        exam:exams(name, max_score)
      `)
      .order('created_at', { ascending: false });

    setPlans(data || []);
    setLoading(false);
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <div>
      <PageHeader
        title="خطط الدعم"
        subtitle="جميع خطط التمكّن التدريبي المُولّدة"
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="لا توجد خطط بعد"
          description="استوردي درجات المتدربات من Blackboard داخل الشعبة، ثم أنشئي خطط الدعم."
          action={<Link to="/courses" className="btn-primary">الذهاب إلى المقررات</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>اسم المتدربة</th>
                  <th>مصدر الدرجة</th>
                  <th>الدرجة</th>
                  <th>الحالة</th>
                  <th>الرابط</th>
                  <th>التاريخ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const st = statusMap[p.status] || statusMap.pending;
                  const StatusIcon = st.Icon;
                  const publicUrl = `${window.location.origin}/plan/${p.token}`;
                  return (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.student?.name || '—'}</td>
                      <td className="text-slate-500 text-sm">{p.exam?.name || '—'}</td>
                      <td>
                        <span className="font-black text-red-500">{p.score ?? 0} / {p.max_score ?? p.exam?.max_score ?? '—'}</span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: `${st.color}20`, color: st.color }}
                        >
                          <StatusIcon size={14} strokeWidth={2} /> {st.label}
                        </span>
                      </td>
                      <td>
                        <a href={publicUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-700 underline">
                          {p.token?.slice(0, 12) || 'رابط'}
                        </a>
                      </td>
                      <td className="text-xs text-slate-500">{fmtDate(p.created_at)}</td>
                      <td className="text-left">
                        <div className="flex items-center gap-2">
                          <Link to={`/plans/${p.id}`} className="btn-primary text-xs">
                            <HeartPulse size={12} /> فتح
                          </Link>
                          <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                            <ExternalLink size={12} /> رابط
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}