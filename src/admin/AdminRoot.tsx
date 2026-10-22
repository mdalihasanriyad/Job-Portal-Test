import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AuthProvider } from './AuthContext';

export default function AdminRoot() {
  return (
    <AuthProvider>
      <Suspense fallback={<p className="p-8 text-center text-slate-600">লোড হচ্ছে…</p>}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  );
}
