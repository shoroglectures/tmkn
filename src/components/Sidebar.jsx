import { NavLink } from 'react-router-dom';
import {
  Activity, LayoutDashboard, BookOpen, Users, ClipboardList,
  HeartPulse, Settings, LogOut, GraduationCap, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const links = [
  { to: '/',           label: 'لوحة المعلومات', icon: LayoutDashboard, end: true },
  { to: '/courses',    label: 'المقررات والشعب', icon: BookOpen },
  { to: '/exams',      label: 'الاختبارات', icon: ClipboardList },
  { to: '/students',   label: 'المتدربات', icon: Users },
  { to: '/plans',      label: 'خطط الدعم', icon: HeartPulse },
  { to: '/follow-up',  label: 'متابعة المتعثرات', icon: Activity },
  { to: '/settings',   label: 'الإعدادات', icon: Settings },
];

export default function Sidebar() {
  const { profile, user, signOut } = useAuth();
  const name = profile?.full_name || user?.email || 'مستخدم';
  const visibleLinks = profile?.role === 'admin'
    ? [...links, { to: '/admin', label: 'إدارة الحسابات', icon: ShieldCheck }]
    : links;

  return (
    <aside className="w-64 fixed right-0 top-0 bottom-0 bg-gradient-to-b from-brand-700 to-brand-900 text-white flex flex-col z-30">
      {/* الشعار */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-12 w-12 shrink-0" />
        <div className="leading-tight">
          <div className="font-black text-lg">تمكن بلس</div>
          <div className="text-[11px] text-brand-100/80">مسار التمكّن التدريبي</div>
        </div>
      </div>

      {/* روابط */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-brand-50 hover:bg-white/10'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* المستخدم */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/15 grid place-items-center text-sm font-bold">
            {name.charAt(0)}
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-sm font-semibold truncate">{name}</div>
            <div className="text-[11px] text-brand-100/70 truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-brand-50 hover:bg-red-500/20 transition"
        >
          <LogOut size={18} />
          <span>تسجيل خروج</span>
        </button>
      </div>
    </aside>
  );
}