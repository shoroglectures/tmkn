import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('students')
      .select('*, section:sections(name, course:courses(name))')
      .order('name');
    setStudents(data || []);
    setLoading(false);
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="المتدربات" subtitle="كل المتدربات في جميع المقررات" />
      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا توجد متدربات بعد"
          description="أضيفي المتدربات من داخل الشعبة."
          action={<Link to="/courses" className="btn-primary">اذهبي للمقررات</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>اسم المتدربة</th>
                  <th>الرقم التدريبي</th>
                  <th>البريد</th>
                  <th>الشعبة</th>
                  <th>المقرر</th>
                </tr>
              </thead>
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