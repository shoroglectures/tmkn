import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="card p-10 text-center max-w-md mx-auto mt-10">
      <Compass className="mx-auto text-brand-600 mb-3" size={40} strokeWidth={1.8} />
      <h1 className="text-xl font-black mb-2">الصفحة غير موجودة</h1>
      <p className="text-slate-500 text-sm mb-5">
        الرابط الذي تحاولين الوصول إليه غير متاح.
      </p>
      <Link to="/" className="btn-primary inline-block">العودة للرئيسية</Link>
    </div>
  );
}