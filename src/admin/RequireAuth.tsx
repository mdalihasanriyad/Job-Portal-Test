import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AdminShell from './AdminShell';

export default function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="p-8 text-center text-slate-600">যাচাই করা হচ্ছে…</p>;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <AdminShell />;
}
