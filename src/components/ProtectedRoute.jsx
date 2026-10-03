import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, profile, profileError, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profileError) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="card max-w-lg p-6 text-center">
          <p className="font-bold text-red-700">تعذر التحقق من صلاحية الحساب.</p>
          <p className="mt-2 text-sm text-slate-600">{profileError.message}</p>
        </div>
      </div>
    );
  }

  if (!profile || profile.access_status !== 'approved') {
    return <Navigate to="/access-pending" replace />;
  }

  return children;
}