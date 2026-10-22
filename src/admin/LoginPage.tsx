import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from './api';
import { useAuth } from './AuthContext';
import { useSeo } from '../lib/seo';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useSeo({ title: 'অ্যাডমিন লগইন', description: 'GovtJob.bd অ্যাডমিন লগইন', path: '/admin/login', noindex: true });

  const target = (location.state as { from?: string } | null)?.from ?? '/admin';

  useEffect(() => {
    if (!loading && user) navigate(target.startsWith('/admin') ? target : '/admin', { replace: true });
  }, [loading, user, navigate, target]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'লগইন করা যায়নি। আবার চেষ্টা করুন।');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-slate-900">অ্যাডমিন লগইন</h1>
        <p className="mt-1 text-sm text-slate-600">শুধু অনুমোদিত অ্যাডমিনদের জন্য।</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">ইমেইল</label>
            <input id="email" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">পাসওয়ার্ড</label>
            <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={submitting || !email || !password}>
            {submitting ? 'অপেক্ষা করুন…' : 'লগইন করুন'}
          </button>
        </form>
      </div>
    </div>
  );
}
