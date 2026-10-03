# setup-2.ps1 — المكونات المشتركة والصفحات الأساسية
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function W($path, $content) {
  $dir = Split-Path $path -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, $utf8)
  Write-Host "  ✅ $path" -ForegroundColor Green
}

Write-Host "`n🧩 السكربت 2: المكونات...`n" -ForegroundColor Cyan

W "src\utils\format.js" @'
export function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('ar-SA-u-nu-latn', { year:'numeric', month:'short', day:'numeric' });
}
export function fmtPct(n) { return `${Math.round(Number(n) || 0)}%`; }
'@

W "src\utils\analyze.js" @'
const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function analyzeExam({ questions = [], students = [], answers = [], threshold = 60 }) {
  if (!questions.length || !students.length) return [];

  return students.map((st) => {
    const stAnswers = answers.filter((a) => a.student_id === st.id);
    let score = 0, total = 0;
    const skillStats = {};

    questions.forEach((q) => {
      const pts = Number(q.points) || 1;
      total += pts;
      const ans = stAnswers.find((a) => a.question_id === q.id);
      const ok = ans && normalize(ans.answer) === normalize(q.correct_answer);
      if (ok) score += pts;

      const sk = q.skill || 'عام';
      if (!skillStats[sk]) skillStats[sk] = { correct: 0, total: 0 };
      skillStats[sk].total += pts;
      if (ok) skillStats[sk].correct += pts;
    });

    const pct = total ? Math.round((score / total) * 100) : 0;
    const weakSkills = Object.entries(skillStats)
      .filter(([, v]) => v.total > 0 && v.correct / v.total < 0.7)
      .map(([skill, v]) => ({ skill, pct: Math.round((v.correct / v.total) * 100) }))
      .sort((a, b) => a.pct - b.pct);

    return { student: st, score, total, pct, weakSkills, needsPlan: pct < threshold };
  }).sort((a, b) => a.pct - b.pct);
}

export function levelOf(pct, threshold = 60) {
  if (pct >= threshold + 20) return { emoji: '🟢', label: 'ممتاز', color: '#10b981' };
  if (pct >= threshold)      return { emoji: '🟡', label: 'جيد',   color: '#f59e0b' };
  return                       { emoji: '🔴', label: 'يحتاج دعم', color: '#ef4444' };
}
'@

W "src\utils\excel.js" @'
import * as XLSX from 'xlsx';

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function parseStudentsFile(file) {
  const rows = await readFile(file);
  return rows.slice(1)
    .filter((r) => String(r[0] || '').trim())
    .map((r) => ({
      name: String(r[0]).trim(),
      code: String(r[1] || '').trim(),
      email: String(r[2] || '').trim(),
    }));
}

export async function parseQuestionsFile(file) {
  const rows = await readFile(file);
  return rows.slice(1)
    .filter((r) => String(r[1] || '').trim())
    .map((r, i) => ({
      number: parseInt(r[0]) || i + 1,
      text: String(r[1]).trim(),
      skill: String(r[2] || 'عام').trim(),
      topic: String(r[3] || '').trim(),
      correct_answer: String(r[4] || '').trim(),
      points: parseInt(r[5]) || 1,
    }));
}

export async function parseAnswersFile(file) {
  return await readFile(file);
}

export function downloadExcel(rows, filename = 'export.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

export function downloadStudentsTemplate() {
  downloadExcel([
    ['الاسم', 'الرقم', 'البريد الإلكتروني'],
    ['سارة أحمد', 'S1001', 'sara@example.com'],
  ], 'قالب-المتدربات.xlsx');
}

export function downloadQuestionsTemplate() {
  downloadExcel([
    ['الرقم', 'نص السؤال', 'المهارة', 'الموضوع', 'الإجابة الصحيحة', 'الدرجة'],
    [1, 'ما ناتج 2 + 2؟', 'حل المسائل', 'الجبر', 'د', 1],
  ], 'قالب-الأسئلة.xlsx');
}
'@

W "src\utils\pdf.js" @'
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportElementAsPDF(element, filename = 'file.pdf') {
  if (!element) throw new Error('العنصر غير موجود');

  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let y = 10;
  let remaining = imgHeight;

  while (remaining > 0) {
    pdf.addImage(imgData, 'PNG', 10, y - (imgHeight - remaining), imgWidth, imgHeight);
    remaining -= pageHeight - 20;
    if (remaining > 0) pdf.addPage();
  }
  pdf.save(filename);
}
'@

W "src\components\Layout.jsx" @'
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <main className="mr-64 p-6 lg:p-8 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
'@

W "src\components\Sidebar.jsx" @'
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Users, ClipboardList, HeartPulse, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const links = [
  { to: '/',           label: 'لوحة المعلومات', icon: LayoutDashboard, end: true },
  { to: '/courses',    label: 'المقررات والشعب', icon: BookOpen },
  { to: '/students',   label: 'المتدربات', icon: Users },
  { to: '/exams',      label: 'الاختبارات', icon: ClipboardList },
  { to: '/plans',      label: 'خطط الدعم', icon: HeartPulse },
  { to: '/settings',   label: 'الإعدادات', icon: Settings },
];

export default function Sidebar() {
  const { profile, user, signOut } = useAuth();
  const name = profile?.full_name || user?.email || 'مستخدم';

  return (
    <aside className="w-64 fixed right-0 top-0 bottom-0 bg-gradient-to-b from-brand-700 to-brand-900 text-white flex flex-col z-30">
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <div className="w-11 h-11 rounded-xl bg-white text-brand-700 grid place-items-center font-black text-2xl shrink-0">+</div>
        <div className="leading-tight">
          <div className="font-black text-lg">تمكن بلس</div>
          <div className="text-[11px] text-brand-100/80">مسار التمكّن الأكاديمي</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-50 hover:bg-white/10'
              }`
            }>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/15 grid place-items-center text-sm font-bold">{name.charAt(0)}</div>
          <div className="leading-tight min-w-0">
            <div className="text-sm font-semibold truncate">{name}</div>
            <div className="text-[11px] text-brand-100/70 truncate">{user?.email}</div>
          </div>
        </div>
        <button onClick={signOut}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-brand-50 hover:bg-red-500/20 transition">
          <LogOut size={18} />
          <span>تسجيل خروج</span>
        </button>
      </div>
    </aside>
  );
}
'@

W "src\components\Modal.jsx" @'
import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm:'max-w-md', md:'max-w-xl', lg:'max-w-3xl', xl:'max-w-5xl' };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col shadow-2xl`}
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
'@

W "src\components\PageHeader.jsx" @'
export default function PageHeader({ title, subtitle, action, backTo, backLabel }) {
  return (
    <div className="mb-6">
      {backTo && (
        <a href={backTo} className="text-brand-600 text-sm font-semibold hover:underline inline-block mb-2">
          ← {backLabel || 'العودة'}
        </a>
      )}
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800">{title}</h1>
          {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
'@

W "src\components\StatCard.jsx" @'
export default function StatCard({ emoji, icon: Icon, value, label, color = 'brand' }) {
  const colorMap = {
    brand:'border-brand-600 text-brand-700', gold:'border-gold-500 text-gold-600',
    red:'border-red-500 text-red-600', green:'border-emerald-500 text-emerald-600',
  };
  return (
    <div className={`card p-4 border-r-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {emoji && <span className="text-lg">{emoji}</span>}
        {Icon && <Icon size={18} />}
      </div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs text-slate-500 font-semibold">{label}</div>
    </div>
  );
}
'@

W "src\components\EmptyState.jsx" @'
export default function EmptyState({ icon: Icon, emoji, title, description, action }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-5xl mb-3">
        {emoji || (Icon && <Icon className="mx-auto text-brand-300" size={48} />)}
      </div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      {description && <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">{description}</p>}
      {action}
    </div>
  );
}
'@

W "src\components\FileUploadButton.jsx" @'
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';

export default function FileUploadButton({ onFile, accept = '.xlsx,.xls,.csv', label = 'استيراد', className = 'btn-ghost' }) {
  const ref = useRef(null);
  const [loading, setLoading] = useState(false);

  async function handle(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try { await onFile(file); }
    finally { setLoading(false); if (ref.current) ref.current.value = ''; }
  }

  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className={className} disabled={loading}>
        <Upload size={16} />
        {loading ? 'جاري...' : label}
      </button>
      <input ref={ref} type="file" accept={accept} onChange={handle} className="hidden" />
    </>
  );
}
'@

Write-Host "`n🎉 السكربت 2 انتهى`n" -ForegroundColor Cyan