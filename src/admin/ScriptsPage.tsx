import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api } from './api';
import ConfirmDialog from './ConfirmDialog';
import { FORMAT_LABEL, ScriptStatusPill } from './scriptLabels';
import type { AdminScript, JobListResponse, ScriptFormat, ScriptListResponse } from './types';
import { formatDate, formatNumber } from '../lib/format';
import { useSeo } from '../lib/seo';

export default function ScriptsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const format = params.get('format') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const [data, setData] = useState<ScriptListResponse | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [toDelete, setToDelete] = useState<AdminScript | null>(null);
  const [busy, setBusy] = useState(false);

  // "new script" panel
  const [showNew, setShowNew] = useState(false);
  const [jobQuery, setJobQuery] = useState('');
  const [jobResults, setJobResults] = useState<JobListResponse['items'] | null>(null);
  const [searching, setSearching] = useState(false);

  useSeo({ title: 'ইউটিউব স্ক্রিপ্ট — অ্যাডমিন', description: 'ইউটিউব স্ক্রিপ্ট ব্যবস্থাপনা', path: '/admin/scripts', noindex: true });

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (q) query.set('q', q);
    if (format) query.set('format', format);
    if (status) query.set('status', status);
    api<ScriptListResponse>('GET', `/api/admin/scripts?${query.toString()}`)
      .then((response) => active && (setData(response), setError('')))
      .catch((caught: unknown) => active && setError(caught instanceof ApiError ? caught.message : 'তালিকা লোড করা যায়নি।'));
    return () => {
      active = false;
    };
  }, [q, format, status, page, reloadKey]);

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  }

  async function searchJobs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    try {
      const response = await api<JobListResponse>('GET', `/api/admin/jobs?pageSize=5&q=${encodeURIComponent(jobQuery.trim())}`);
      setJobResults(response.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'চাকরি খোঁজা যায়নি।');
    } finally {
      setSearching(false);
    }
  }

  async function createFor(jobId: string, selected: ScriptFormat) {
    setBusy(true);
    setError('');
    try {
      const response = await api<{ script: AdminScript }>('POST', '/api/admin/scripts', { jobId, format: selected });
      navigate(`/admin/scripts/${response.script.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'প্রম্পট তৈরি করা যায়নি।');
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api('DELETE', `/api/admin/scripts/${toDelete.id}`);
      setNotice('স্ক্রিপ্ট মুছে ফেলা হয়েছে।');
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
        <h1 className="text-2xl font-bold text-slate-900">ইউটিউব স্ক্রিপ্ট</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'বন্ধ করুন' : '+ নতুন স্ক্রিপ্ট'}
        </button>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">
        প্রতিটি স্ক্রিপ্টে একটি চাকরির তথ্য থেকে তৈরি AI প্রম্পট থাকে। প্রম্পট কপি করে বাইরের AI-তে চালান, তারপর ফলাফল পেস্ট করে সংরক্ষণ করুন।
      </p>

      {showNew && (
        <section className="card mt-5 space-y-4 p-5" aria-label="নতুন স্ক্রিপ্ট">
          <form onSubmit={searchJobs} role="search" className="flex gap-2">
            <label htmlFor="new-job-q" className="sr-only">চাকরি খুঁজুন</label>
            <input id="new-job-q" className="input" placeholder="চাকরির শিরোনাম বা প্রতিষ্ঠান লিখে খুঁজুন" value={jobQuery} onChange={(e) => setJobQuery(e.target.value)} maxLength={100} />
            <button type="submit" className="btn btn-primary" disabled={searching}>{searching ? 'খোঁজা হচ্ছে…' : 'খুঁজুন'}</button>
          </form>
          {jobResults && (jobResults.length === 0 ? (
            <p className="text-sm text-slate-600">কোনো চাকরি পাওয়া যায়নি।</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {jobResults.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-medium text-slate-900">{job.title}</p>
                    <p className="text-xs text-slate-500">{job.organization}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-accent !px-3 !py-1.5" disabled={busy} onClick={() => createFor(job.id, 'short')}>শর্ট</button>
                    <button type="button" className="btn btn-accent !px-3 !py-1.5" disabled={busy} onClick={() => createFor(job.id, 'full')}>পূর্ণ</button>
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </section>
      )}

      <div className="card mt-6 grid gap-3 p-4 md:grid-cols-[1fr_180px_180px]">
        <form onSubmit={(e) => { e.preventDefault(); update({ q: String(new FormData(e.currentTarget).get('q') ?? '').trim() }); }} role="search" className="flex gap-2" key={q}>
          <label htmlFor="script-q" className="sr-only">স্ক্রিপ্ট খুঁজুন</label>
          <input id="script-q" name="q" className="input" placeholder="চাকরি বা স্ক্রিপ্টের শিরোনাম" defaultValue={q} maxLength={100} />
          <button type="submit" className="btn btn-primary">খুঁজুন</button>
        </form>
        <div>
          <label htmlFor="script-format" className="sr-only">ধরন</label>
          <select id="script-format" className="input" value={format} onChange={(e) => update({ format: e.target.value })}>
            <option value="">সব ধরন</option>
            <option value="short">শর্ট</option>
            <option value="full">পূর্ণ</option>
          </select>
        </div>
        <div>
          <label htmlFor="script-status" className="sr-only">স্ট্যাটাস</label>
          <select id="script-status" className="input" value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">সব স্ট্যাটাস</option>
            <option value="prompt">শুধু প্রম্পট</option>
            <option value="draft">খসড়া</option>
            <option value="final">চূড়ান্ত</option>
          </select>
        </div>
      </div>

      <div aria-live="polite">
        {notice && <div className="mt-4 rounded-lg border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">{notice}</div>}
        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      </div>

      <div className="card mt-4 overflow-x-auto">
        {!data ? (
          !error && <p className="p-6 text-slate-600">লোড হচ্ছে…</p>
        ) : data.items.length === 0 ? (
          <p className="p-6 text-slate-600">কোনো স্ক্রিপ্ট নেই। "নতুন স্ক্রিপ্ট" দিয়ে শুরু করুন।</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">স্ক্রিপ্ট / চাকরি</th>
                <th scope="col" className="px-4 py-3 font-medium">ধরন</th>
                <th scope="col" className="px-4 py-3 font-medium">স্ট্যাটাস</th>
                <th scope="col" className="px-4 py-3 font-medium">শব্দ</th>
                <th scope="col" className="px-4 py-3 font-medium">হালনাগাদ</th>
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">কার্যক্রম</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((script) => (
                <tr key={script.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <Link to={`/admin/scripts/${script.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{script.title || script.jobTitle}</Link>
                    {script.title && <p className="text-xs text-slate-500">{script.jobTitle}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{FORMAT_LABEL[script.format]}</td>
                  <td className="px-4 py-3"><ScriptStatusPill status={script.status} /></td>
                  <td className="px-4 py-3 text-slate-700">{formatNumber(script.wordCount)}</td>
                  <td className="px-4 py-3 text-slate-700">{script.updatedAt ? formatDate(script.updatedAt.slice(0, 10)) : ''}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link to={`/admin/scripts/${script.id}`} className="btn btn-outline !px-3 !py-1.5">খুলুন</Link>
                      <button type="button" className="btn btn-outline !px-3 !py-1.5 !text-red-700" onClick={() => setToDelete(script)}>মুছুন</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <nav aria-label="পৃষ্ঠা" className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <p>মোট {formatNumber(data.total)}টি · পৃষ্ঠা {formatNumber(data.page)} / {formatNumber(data.totalPages)}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline" disabled={data.page <= 1} onClick={() => update({ page: String(data.page - 1) })}>← আগের</button>
            <button type="button" className="btn btn-outline" disabled={data.page >= data.totalPages} onClick={() => update({ page: String(data.page + 1) })}>পরের →</button>
          </div>
        </nav>
      )}

      <ConfirmDialog open={toDelete !== null} title="স্ক্রিপ্ট মুছে ফেলবেন?" message="প্রম্পট ও পেস্ট করা স্ক্রিপ্ট স্থায়ীভাবে মুছে যাবে।" confirmLabel="হ্যাঁ, মুছে ফেলুন" busy={busy} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
