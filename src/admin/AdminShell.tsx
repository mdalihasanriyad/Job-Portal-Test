import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'}`;

export default function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      navigate('/admin/login', { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-lg font-bold text-brand-800">
              Govt<span className="text-accent-600">Job</span>.bd <span className="text-sm font-medium text-slate-500">অ্যাডমিন</span>
            </Link>
            <nav aria-label="অ্যাডমিন নেভিগেশন" className="flex flex-wrap gap-1">
              <NavLink to="/admin" end className={linkClass}>ড্যাশবোর্ড</NavLink>
              <NavLink to="/admin/jobs" end className={linkClass}>সব চাকরি</NavLink>
              <NavLink to="/admin/jobs/new" className={linkClass}>নতুন চাকরি</NavLink>
              <NavLink to="/admin/imports" className={linkClass}>আমদানি</NavLink>
              <NavLink to="/admin/categories" className={linkClass}>ক্যাটাগরি</NavLink>
              <NavLink to="/admin/scripts" className={linkClass}>স্ক্রিপ্ট</NavLink>
              <NavLink to="/admin/comments" className={linkClass}>মন্তব্য</NavLink>
              <NavLink to="/admin/messages" className={linkClass}>বার্তা</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="text-slate-600 hover:text-brand-700" target="_blank" rel="noopener noreferrer">সাইট দেখুন ↗</Link>
            <span className="hidden text-slate-500 sm:inline">{user?.email}</span>
            <button type="button" className="btn btn-outline !py-1.5" onClick={handleLogout} disabled={busy}>
              লগআউট
            </button>
          </div>
        </div>
      </header>
      <main className="container-page py-8">
        <Outlet />
      </main>
    </div>
  );
}
