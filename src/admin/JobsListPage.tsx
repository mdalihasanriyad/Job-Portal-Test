import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from './api';
import ConfirmDialog from './ConfirmDialog';
import { StatusPill } from './labels';
import type { CategoryOption, JobListItem, JobListResponse } from './types';
import { formatDate, formatNumber } from '../lib/format';
import { useSeo } from '../lib/seo';

const STATUS_OPTIONS = [
  { value: '', label: 'সব স্ট্যাটাস' },
  { value: 'published', label: 'প্রকাশিত' },
  { value: 'draft', label: 'খসড়া' },
  { value: 'pending_review', label: 'রিভিউ অপেক্ষমাণ' },
  { value: 'expired', label: 'মেয়াদোত্তীর্ণ' },
];

export default function JobsListPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const [search, setSearch] = useState(q);
  const [data, setData] = useState<JobListResponse | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [toDelete, setToDelete] = useState<JobListItem | null>(null);
  const [busy, setBusy] = useState(false);

  useSeo({ title: 'সব চাকরি — অ্যাডমিন', description: 'চাকরি ব্যবস্থাপনা', path: '/admin/jobs', noindex: true });

  useEffect(() => setSearch(q), [q]);

  useEffect(() => {
    api<{ categories: CategoryOption[] }>('GET', '/api/admin/categories')
      .then((response) => setCategories(response.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ page: String(page), pageSize: '10' });
    if (q) query.set('q', q);
    if (status) query.set('status', status);
    if (category) query.set('category', category);
    api<JobListResponse>('GET', `/api/admin/jobs?${query.toString()}`)
      .then((response) => active && setData(response))
      .catch((caught: unknown) => active && setError(caught instanceof ApiError ? caught.message : 'তালিকা লোড করা যায়নি।'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [q, status, category, page, reloadKey]);

  const update = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!('page' in changes)) next.delete('page');
      setParams(next);
    },
    [params, setParams],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ q: search.trim() });
  }

  async function changeStatus(job: JobListItem, next: 'draft' | 'published') {
    setNotice('');
    setError('');
    try {
      await api('POST', `/api/admin/jobs/${job.id}/status`, { status: next });
      setNotice(next === 'published' ? 'চাকরিটি প্রকাশ করা হয়েছে।' : 'চাকরিটি আনপাবলিশ করে খসড়ায় রাখা হয়েছে।');
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'স্ট্যাটাস পরিবর্তন করা যায়নি।');
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    setError('');
    try {
      await api('DELETE', `/api/admin/jobs/${toDelete.id}`);
      setNotice('চাকরিটি মুছে ফেলা হয়েছে।');
      setToDelete(null);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'মুছে ফেলা যায়নি।');
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">সব চাকরি</h1>
        <Link to="/admin/jobs/new" className="btn btn-primary">+ নতুন চাকরি</Link>
      </div>

      <div className="card mt-6 grid gap-3 p-4 md:grid-cols-[1fr_200px_240px]">
        <form onSubmit={handleSearch} role="search" className="flex gap-2">
          <label htmlFor="job-search" className="sr-only">শিরোনাম বা প্রতিষ্ঠান খুঁজুন</label>
          <input id="job-search" className="input" placeholder="শিরোনাম বা প্রতিষ্ঠান খুঁজুন" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
          <button type="submit" className="btn btn-primary">খুঁজুন</button>
        </form>
        <div>
          <label htmlFor="status-filter" className="sr-only">স্ট্যাটাস</label>
          <select id="status-filter" className="input" value={status} onChange={(e) => update({ status: e.target.value })}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="category-filter" className="sr-only">ক্যাটাগরি</label>
          <select id="category-filter" className="input" value={category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">সব ক্যাটাগরি</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div aria-live="polite">
        {notice && <div className="mt-4 rounded-lg border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">{notice}</div>}
        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      </div>

      <div className="card mt-4 overflow-x-auto">
        {loading && !data ? (
          <p className="p-6 text-slate-600">লোড হচ্ছে…</p>
        ) : data && data.items.length === 0 ? (
          <p className="p-6 text-slate-600">কোনো চাকরি পাওয়া যায়নি।</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">শিরোনাম</th>
                <th scope="col" className="px-4 py-3 font-medium">স্ট্যাটাস</th>
                <th scope="col" className="px-4 py-3 font-medium">শেষ তারিখ</th>
                <th scope="col" className="px-4 py-3 font-medium">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-60' : ''}>
              {data?.items.map((job) => (
                <tr key={job.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <Link to={`/admin/jobs/${job.id}/edit`} className="font-semibold text-slate-900 hover:text-brand-700">{job.title}</Link>
                    <p className="text-xs text-slate-500">{job.organization} · {job.category}</p>
                    {(job.imported || job.possibleDuplicate) && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {job.imported && <span className="badge bg-brand-50 text-brand-700">আমদানিকৃত — যাচাই দরকার</span>}
                        {job.possibleDuplicate && <span className="badge bg-red-100 text-red-700">সম্ভাব্য ডুপ্লিকেট</span>}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={job.status} deadline={job.deadline} /></td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(job.deadline)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/admin/jobs/${job.id}/edit`} className="btn btn-outline !px-3 !py-1.5">সম্পাদনা</Link>
                      {job.status === 'published' ? (
                        <button type="button" className="btn btn-outline !px-3 !py-1.5" onClick={() => changeStatus(job, 'draft')}>আনপাবলিশ</button>
                      ) : (
                        <button type="button" className="btn btn-accent !px-3 !py-1.5" onClick={() => changeStatus(job, 'published')}>প্রকাশ</button>
                      )}
                      <button type="button" className="btn btn-outline !px-3 !py-1.5 !text-red-700" onClick={() => setToDelete(job)}>মুছুন</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 && (
        <nav aria-label="পৃষ্ঠা" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>মোট {formatNumber(data.total)}টি · পৃষ্ঠা {formatNumber(data.page)} / {formatNumber(data.totalPages)}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline" disabled={data.page <= 1} onClick={() => update({ page: String(data.page - 1) })}>← আগের</button>
            <button type="button" className="btn btn-outline" disabled={data.page >= data.totalPages} onClick={() => update({ page: String(data.page + 1) })}>পরের →</button>
          </div>
        </nav>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="চাকরি মুছে ফেলবেন?"
        message={toDelete ? `"${toDelete.title}" স্থায়ীভাবে মুছে যাবে। এই কাজ আর ফেরানো যাবে না।` : ''}
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
